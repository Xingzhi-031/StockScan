use chrono::{DateTime, Duration, Utc};
use rusqlite::Connection;

use crate::dto::Settings;
use crate::error::AppError;
use crate::repo;
use crate::time;

pub fn close_stale_on_startup(conn: &mut Connection, now: DateTime<Utc>) -> Result<(), AppError> {
    let now_iso = time::utc_iso(now);
    conn.execute(
        "
        UPDATE sessions
           SET status = 'CLOSED',
               completed_at = ?1,
               close_reason = 'APP_RESTART'
         WHERE status = 'OPEN'
        ",
        [now_iso],
    )?;
    Ok(())
}

pub fn close_on_operator_switch(
    conn: &Connection,
    incoming_operator_id: i64,
    now: DateTime<Utc>,
) -> Result<(), AppError> {
    let now_iso = time::utc_iso(now);
    conn.execute(
        "
        UPDATE sessions
           SET status = 'CLOSED',
               completed_at = ?1,
               close_reason = 'OPERATOR_SWITCH'
         WHERE status = 'OPEN' AND operator_id <> ?2
        ",
        rusqlite::params![now_iso, incoming_operator_id],
    )?;
    Ok(())
}

pub fn ensure_open(
    conn: &Connection,
    operator_id: i64,
    location_id: i64,
    settings: &Settings,
    now: DateTime<Utc>,
) -> Result<i64, AppError> {
    let now_iso = time::utc_iso(now);
    if let Some(open) = repo::sessions::find_open(conn)? {
        let idle = now.signed_duration_since(open.last_activity_at);
        let same_operator = open.operator_id == operator_id;
        if same_operator && idle <= Duration::minutes(settings.session.idle_minutes) {
            return Ok(open.id);
        }
        let reason = if !same_operator {
            "OPERATOR_SWITCH"
        } else {
            "IDLE_TIMEOUT"
        };
        repo::sessions::close(conn, open.id, reason, &now_iso)?;
    }
    let number = repo::take_next_session_number(conn, &now_iso)?;
    repo::sessions::insert_open(conn, number, location_id, operator_id, &now_iso)
}

pub fn current_summary(conn: &Connection, operator_id: i64) -> Result<Option<crate::dto::SessionSummary>, AppError> {
    let Some(open) = repo::sessions::find_open(conn)? else {
        return Ok(None);
    };
    if open.operator_id != operator_id {
        return Ok(None);
    }
    Ok(Some(repo::sessions::summary(conn, open.id)?))
}

pub fn finish(conn: &Connection, operator_id: i64, now: DateTime<Utc>) -> Result<Option<crate::dto::SessionSummary>, AppError> {
    let Some(open) = repo::sessions::find_open(conn)? else {
        return Ok(None);
    };
    if open.operator_id != operator_id {
        return Err(AppError::NothingToUndo);
    }
    let summary = repo::sessions::summary(conn, open.id)?;
    repo::sessions::close(conn, open.id, "FINISHED", &time::utc_iso(now))?;
    Ok(Some(summary))
}
