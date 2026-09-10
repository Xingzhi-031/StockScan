use rusqlite::Connection;

use crate::error::AppError;

pub fn upsert_open(
    conn: &Connection,
    type_: &str,
    severity: &str,
    dedup_key: &str,
    product_id: Option<i64>,
    import_id: Option<i64>,
    details_json: &str,
    now_iso: &str,
) -> Result<(), AppError> {
    let updated = conn.execute(
        "
        UPDATE exceptions
           SET occurrences = occurrences + 1,
               last_seen_at = ?2,
               details_json = ?3
         WHERE status = 'OPEN' AND dedup_key = ?1
        ",
        rusqlite::params![dedup_key, now_iso, details_json],
    )?;
    if updated == 0 {
        conn.execute(
            "
            INSERT INTO exceptions (
                type, severity, status, dedup_key, product_id, import_id,
                occurrences, details_json, first_seen_at, last_seen_at
            ) VALUES (?1, ?2, 'OPEN', ?3, ?4, ?5, 1, ?6, ?7, ?7)
            ",
            rusqlite::params![
                type_,
                severity,
                dedup_key,
                product_id,
                import_id,
                details_json,
                now_iso
            ],
        )?;
    }
    Ok(())
}

pub fn insert_negative(
    conn: &Connection,
    transaction_id: i64,
    product_id: i64,
    stock_before: i64,
    stock_after: i64,
    now_iso: &str,
) -> Result<(), AppError> {
    let details = serde_json::json!({ "stockBefore": stock_before, "stockAfter": stock_after });
    conn.execute(
        "
        INSERT INTO exceptions (
            type, severity, status, transaction_id, product_id,
            occurrences, details_json, first_seen_at, last_seen_at
        ) VALUES ('NEGATIVE_STOCK', 'WARNING', 'OPEN', ?1, ?2, 1, ?3, ?4, ?4)
        ",
        rusqlite::params![transaction_id, product_id, details.to_string(), now_iso],
    )?;
    Ok(())
}

pub fn resolve_open_dedup(
    conn: &Connection,
    dedup_key: &str,
    operator_id: i64,
    note: &str,
    now_iso: &str,
) -> Result<(), AppError> {
    conn.execute(
        "
        UPDATE exceptions
           SET status = 'RESOLVED', resolved_at = ?2, resolved_by = ?3, resolution_note = ?4
         WHERE status = 'OPEN' AND dedup_key = ?1
        ",
        rusqlite::params![dedup_key, now_iso, operator_id, note],
    )?;
    Ok(())
}

pub fn upsert_unknown_barcode(conn: &Connection, code: &str, now_iso: &str) -> Result<(), AppError> {
    let key = format!("UNKNOWN_BARCODE:{code}");
    let details = serde_json::json!({ "code": code }).to_string();
    let updated = conn.execute(
        "
        UPDATE exceptions
           SET occurrences = occurrences + 1, last_seen_at = ?2
         WHERE status = 'OPEN' AND dedup_key = ?1
        ",
        rusqlite::params![key, now_iso],
    )?;
    if updated == 0 {
        conn.execute(
            "
            INSERT INTO exceptions (
                type, severity, status, dedup_key, identifier_code,
                occurrences, details_json, first_seen_at, last_seen_at
            ) VALUES ('UNKNOWN_BARCODE', 'WARNING', 'OPEN', ?1, ?2, 1, ?3, ?4, ?4)
            ",
            rusqlite::params![key, code, details, now_iso],
        )?;
    }
    Ok(())
}
