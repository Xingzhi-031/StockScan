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
