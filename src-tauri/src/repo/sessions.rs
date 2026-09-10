use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};

use crate::dto::{OpCount, OperationType, SessionSummary};
use crate::error::AppError;
use crate::time;

pub struct OpenSession {
    pub id: i64,
    pub operator_id: i64,
    pub last_activity_at: DateTime<Utc>,
}

pub fn find_open(conn: &Connection) -> Result<Option<OpenSession>, AppError> {
    let row = conn
        .query_row(
            "SELECT id, operator_id, last_activity_at FROM sessions WHERE status = 'OPEN'",
            [],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, i64>(1)?,
                    r.get::<_, String>(2)?,
                ))
            },
        )
        .optional()?;
    match row {
        None => Ok(None),
        Some((id, operator_id, last)) => {
            let last_activity_at = time::parse_utc(&last).unwrap_or_else(|_| Utc::now());
            Ok(Some(OpenSession {
                id,
                operator_id,
                last_activity_at,
            }))
        }
    }
}

pub fn close(conn: &Connection, id: i64, reason: &str, now_iso: &str) -> Result<(), AppError> {
    conn.execute(
        "
        UPDATE sessions
           SET status = 'CLOSED', completed_at = ?2, close_reason = ?3
         WHERE id = ?1 AND status = 'OPEN'
        ",
        rusqlite::params![id, now_iso, reason],
    )?;
    Ok(())
}

pub fn insert_open(
    conn: &Connection,
    number: i64,
    location_id: i64,
    operator_id: i64,
    now_iso: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "
        INSERT INTO sessions (
            session_number, location_id, operator_id, status, started_at, last_activity_at
        ) VALUES (?1, ?2, ?3, 'OPEN', ?4, ?4)
        ",
        rusqlite::params![number, location_id, operator_id, now_iso],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn touch(conn: &Connection, id: i64, now_iso: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE sessions SET last_activity_at = ?2 WHERE id = ?1",
        rusqlite::params![id, now_iso],
    )?;
    Ok(())
}

pub fn summary(conn: &Connection, session_id: i64) -> Result<SessionSummary, AppError> {
    let (number, operator_id, operator_name, started_at, last_activity_at): (
        i64,
        i64,
        String,
        String,
        String,
    ) = conn.query_row(
        "
        SELECT s.session_number, s.operator_id, e.name, s.started_at, s.last_activity_at
          FROM sessions s
          JOIN employees e ON e.id = s.operator_id
         WHERE s.id = ?1
        ",
        [session_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
    )?;
    let (tx_count, product_count, total_units, net_change): (i64, i64, i64, i64) = conn.query_row(
        "
        SELECT COUNT(*),
               COUNT(DISTINCT product_id),
               COALESCE(SUM(ABS(quantity_change)), 0),
               COALESCE(SUM(quantity_change), 0)
          FROM transactions
         WHERE session_id = ?1
        ",
        [session_id],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
    )?;
    let mut stmt = conn.prepare(
        "
        SELECT operation_type, COUNT(*), COALESCE(SUM(quantity_change), 0)
          FROM transactions
         WHERE session_id = ?1
         GROUP BY operation_type
        ",
    )?;
    let mapped = stmt.query_map([session_id], |r| {
        let op: String = r.get(0)?;
        Ok(OpCount {
            operation: OperationType::from_db(&op).unwrap_or(OperationType::Sale),
            count: r.get(1)?,
            net_change: r.get(2)?,
        })
    })?;
    let mut by_operation = Vec::new();
    for row in mapped {
        by_operation.push(row?);
    }
    Ok(SessionSummary {
        id: session_id,
        session_number: number,
        operator_id,
        operator_name,
        started_at,
        last_activity_at,
        tx_count,
        product_count,
        total_units,
        net_change,
        by_operation,
    })
}
