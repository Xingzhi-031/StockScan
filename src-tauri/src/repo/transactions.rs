use rusqlite::{Connection, OptionalExtension};

use crate::dto::{OperationType, TxResult, TxRow};
use crate::error::AppError;

pub struct TxRecord {
    pub id: i64,
    pub client_txn_id: String,
    pub location_id: i64,
    pub product_id: i64,
    pub identifier_id: Option<i64>,
    pub identifier_code: Option<String>,
    pub operation: OperationType,
    pub input_quantity: i64,
    pub input_uom: String,
    pub unit_multiplier: i64,
    pub quantity_change: i64,
    pub stock_before: i64,
    pub stock_after: i64,
    pub operator_id: i64,
    pub session_id: Option<i64>,
    pub sync_status: String,
    pub created_at: String,
}

pub fn find_result_by_client_id(
    conn: &Connection,
    client_txn_id: &str,
) -> Result<Option<TxResult>, AppError> {
    let row = conn
        .query_row(
            "
            SELECT id, operation_type, quantity_change, stock_before, stock_after,
                   negative_stock_warning, created_at, sync_status, session_id
              FROM transactions
             WHERE client_txn_id = ?1
            ",
            [client_txn_id],
            |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, i64>(3)?,
                    r.get::<_, i64>(4)?,
                    r.get::<_, i64>(5)?,
                    r.get::<_, String>(6)?,
                    r.get::<_, String>(7)?,
                    r.get::<_, i64>(8)?,
                ))
            },
        )
        .optional()?;
    match row {
        None => Ok(None),
        Some((id, op, change, before, after, neg, created, sync, session_id)) => {
            let session = crate::repo::sessions::summary(conn, session_id)?;
            Ok(Some(TxResult {
                transaction_id: id,
                client_txn_id: client_txn_id.to_string(),
                operation: OperationType::from_db(&op)?,
                quantity_change: change,
                stock_before: before,
                stock_after: after,
                negative_warning: neg == 1,
                session,
                created_at: created,
                idempotent_replay: true,
                was_exported: sync != "LOCAL",
            }))
        }
    }
}

pub fn get(conn: &Connection, id: i64) -> Result<TxRecord, AppError> {
    conn.query_row(
        "
        SELECT id, client_txn_id, location_id, product_id, identifier_id, identifier_code,
               operation_type, input_quantity, input_uom, unit_multiplier, quantity_change,
               stock_before, stock_after, operator_id, session_id, sync_status, created_at
          FROM transactions WHERE id = ?1
        ",
        [id],
        |r| {
            let op: String = r.get(6)?;
            Ok(TxRecord {
                id: r.get(0)?,
                client_txn_id: r.get(1)?,
                location_id: r.get(2)?,
                product_id: r.get(3)?,
                identifier_id: r.get(4)?,
                identifier_code: r.get(5)?,
                operation: OperationType::from_db(&op).unwrap_or(OperationType::Sale),
                input_quantity: r.get(7)?,
                input_uom: r.get(8)?,
                unit_multiplier: r.get(9)?,
                quantity_change: r.get(10)?,
                stock_before: r.get(11)?,
                stock_after: r.get(12)?,
                operator_id: r.get(13)?,
                session_id: r.get(14)?,
                sync_status: r.get(15)?,
                created_at: r.get(16)?,
            })
        },
    )
    .map_err(AppError::from)
}

pub fn latest_undoable(conn: &Connection, session_id: i64, operator_id: i64) -> Result<Option<i64>, AppError> {
    conn.query_row(
        "
        SELECT id FROM transactions t
         WHERE t.session_id = ?1 AND t.operator_id = ?2
           AND t.operation_type IN ('STOCK_IN','SALE','RETURN','ADJUSTMENT')
           AND NOT EXISTS (SELECT 1 FROM transactions r WHERE r.reverses_transaction_id = t.id)
         ORDER BY t.id DESC LIMIT 1
        ",
        rusqlite::params![session_id, operator_id],
        |r| r.get(0),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn list_page(
    conn: &Connection,
    session_id: Option<i64>,
    product_id: Option<i64>,
    cursor: Option<i64>,
    limit: i64,
) -> Result<(Vec<TxRow>, Option<i64>), AppError> {
    let limit = limit.clamp(1, 500);
    let mut sql = String::from(
        "
        SELECT t.id, t.created_at, t.operator_id, e.name, e.employee_code,
               t.product_id, p.name, p.model_code, t.identifier_code,
               t.operation_type, t.input_quantity, t.input_uom, t.unit_multiplier,
               t.quantity_change, t.stock_before, t.stock_after, s.session_number,
               t.negative_stock_warning, t.reason_code, t.reverses_transaction_id, t.sync_status
          FROM transactions t
          JOIN employees e ON e.id = t.operator_id
          JOIN products p ON p.id = t.product_id
          LEFT JOIN sessions s ON s.id = t.session_id
         WHERE 1=1
        ",
    );
    if session_id.is_some() {
        sql.push_str(" AND t.session_id = ?");
    }
    if product_id.is_some() {
        sql.push_str(" AND t.product_id = ?");
    }
    if cursor.is_some() {
        sql.push_str(" AND t.id < ?");
    }
    sql.push_str(" ORDER BY t.id DESC LIMIT ?");

    let mut stmt = conn.prepare(&sql)?;
    let mut params: Vec<rusqlite::types::Value> = Vec::new();
    if let Some(id) = session_id {
        params.push(id.into());
    }
    if let Some(id) = product_id {
        params.push(id.into());
    }
    if let Some(c) = cursor {
        params.push(c.into());
    }
    params.push(limit.into());
    let mapped = stmt.query_map(rusqlite::params_from_iter(params), |r| {
        let op: String = r.get(9)?;
        Ok(TxRow {
            id: r.get(0)?,
            created_at: r.get(1)?,
            operator_id: r.get(2)?,
            operator_name: r.get(3)?,
            operator_code: r.get(4)?,
            product_id: r.get(5)?,
            product_name: r.get(6)?,
            model_code: r.get(7)?,
            identifier_code: r.get(8)?,
            operation: OperationType::from_db(&op).unwrap_or(OperationType::Sale),
            input_quantity: r.get(10)?,
            input_uom: r.get(11)?,
            unit_multiplier: r.get(12)?,
            quantity_change: r.get(13)?,
            stock_before: r.get(14)?,
            stock_after: r.get(15)?,
            session_number: r.get(16)?,
            negative_warning: r.get::<_, i64>(17)? == 1,
            reason_code: r.get(18)?,
            reverses_transaction_id: r.get(19)?,
            sync_status: r.get(20)?,
        })
    })?;
    let mut rows = Vec::new();
    for row in mapped {
        rows.push(row?);
    }
    let next = if rows.len() as i64 == limit {
        rows.last().map(|r| r.id)
    } else {
        None
    };
    Ok((rows, next))
}
