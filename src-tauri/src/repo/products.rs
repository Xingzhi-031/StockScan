use rusqlite::{Connection, OptionalExtension};

use crate::error::AppError;

pub fn find_by_external(
    conn: &Connection,
    company_id: i64,
    code: &str,
) -> Result<Option<i64>, AppError> {
    conn.query_row(
        "SELECT id FROM products WHERE company_id = ?1 AND external_code = ?2",
        rusqlite::params![company_id, code],
        |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn find_by_name_key(
    conn: &Connection,
    company_id: i64,
    name_key: &str,
) -> Result<Option<i64>, AppError> {
    conn.query_row(
        "SELECT id FROM products WHERE company_id = ?1 AND name_key = ?2",
        rusqlite::params![company_id, name_key],
        |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn insert_product(
    conn: &Connection,
    company_id: i64,
    external_code: Option<&str>,
    name: &str,
    name_key: &str,
    model_code: Option<&str>,
    pack_size: Option<i64>,
    price: Option<i64>,
    import_id: i64,
    now_iso: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "
        INSERT INTO products (
            company_id, external_code, name, name_key, model_code, pack_size,
            reference_price, currency, is_active, created_import_id, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'IDR', 1, ?8, ?9, ?9)
        ",
        rusqlite::params![
            company_id,
            external_code,
            name,
            name_key,
            model_code,
            pack_size,
            price,
            import_id,
            now_iso
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_from_report(
    conn: &Connection,
    id: i64,
    pack_size: Option<i64>,
    price: Option<i64>,
    now_iso: &str,
) -> Result<(), AppError> {
    if pack_size.is_some() {
        conn.execute(
            "UPDATE products SET pack_size = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![id, pack_size, now_iso],
        )?;
    }
    if price.is_some() {
        conn.execute(
            "UPDATE products SET reference_price = ?2, updated_at = ?3 WHERE id = ?1",
            rusqlite::params![id, price, now_iso],
        )?;
    }
    Ok(())
}
