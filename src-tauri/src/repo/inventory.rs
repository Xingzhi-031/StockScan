use std::collections::HashMap;

use rusqlite::Connection;

use crate::dto::{IdentifierDto, InventoryRow, ProductDetail};
use crate::error::AppError;

pub fn has_balances(conn: &Connection, location_id: i64) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_balances WHERE location_id = ?1",
        [location_id],
        |row| row.get(0),
    )?;
    Ok(n > 0)
}

pub fn insert_balance(
    conn: &Connection,
    location_id: i64,
    product_id: i64,
    qty: i64,
    import_id: i64,
    now_iso: &str,
) -> Result<(), AppError> {
    conn.execute(
        "
        INSERT INTO inventory_balances (
            location_id, product_id, baseline_quantity, baseline_import_id,
            current_quantity, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?3, ?5)
        ",
        rusqlite::params![location_id, product_id, qty, import_id, now_iso],
    )?;
    Ok(())
}

pub fn list_rows(conn: &Connection, location_id: i64) -> Result<Vec<InventoryRow>, AppError> {
    let mut stmt = conn.prepare(
        "
        SELECT p.id, p.name, p.model_code, p.external_code, p.pack_size, p.reference_price,
               b.baseline_quantity, b.current_quantity, b.updated_at,
               (SELECT COUNT(*) FROM identifiers i WHERE i.product_id = p.id AND i.is_active = 1),
               (SELECT MAX(t.created_at) FROM transactions t WHERE t.product_id = p.id AND t.location_id = b.location_id),
               (SELECT COUNT(*) FROM exceptions e WHERE e.product_id = p.id AND e.status = 'OPEN'),
               (SELECT i.report_as_of_date FROM imports i WHERE i.id = b.baseline_import_id)
          FROM inventory_balances b
          JOIN products p ON p.id = b.product_id
         WHERE b.location_id = ?1
         ORDER BY p.name COLLATE NOCASE
        ",
    )?;
    let mut rows: Vec<InventoryRow> = stmt
        .query_map([location_id], |row| {
            Ok(InventoryRow {
                product_id: row.get(0)?,
                name: row.get(1)?,
                model_code: row.get(2)?,
                external_code: row.get(3)?,
                pack_size: row.get(4)?,
                reference_price: row.get(5)?,
                baseline_quantity: row.get(6)?,
                current_quantity: row.get(7)?,
                barcode_count: row.get(9)?,
                barcodes: Vec::new(),
                last_changed_at: row.get(10)?,
                baseline_as_of: row.get(12)?,
                open_exception_count: row.get(11)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    drop(stmt);
    let codes = all_active_codes(conn)?;
    for row in &mut rows {
        row.barcodes = codes.get(&row.product_id).cloned().unwrap_or_default();
    }
    Ok(rows)
}

fn all_active_codes(conn: &Connection) -> Result<HashMap<i64, Vec<String>>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT product_id, code FROM identifiers WHERE is_active = 1 ORDER BY id",
    )?;
    let mapped = stmt.query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))?;
    let mut map: HashMap<i64, Vec<String>> = HashMap::new();
    for item in mapped {
        let (id, code) = item?;
        map.entry(id).or_default().push(code);
    }
    Ok(map)
}

fn list_identifiers(conn: &Connection, product_id: i64) -> Result<Vec<IdentifierDto>, AppError> {
    let mut stmt = conn.prepare(
        "
        SELECT id, code, identifier_type, unit_multiplier
          FROM identifiers
         WHERE product_id = ?1 AND is_active = 1
         ORDER BY id
        ",
    )?;
    let mapped = stmt.query_map([product_id], |r| {
        Ok(IdentifierDto {
            id: r.get(0)?,
            code: r.get(1)?,
            identifier_type: r.get(2)?,
            unit_multiplier: r.get(3)?,
        })
    })?;
    let mut identifiers = Vec::new();
    for id in mapped {
        identifiers.push(id?);
    }
    Ok(identifiers)
}

pub fn product_detail(
    conn: &Connection,
    location_id: i64,
    product_id: i64,
    location_name: &str,
) -> Result<Option<ProductDetail>, AppError> {
    let mut stmt = conn.prepare(
        "
        SELECT p.id, p.name, p.model_code, p.external_code, p.pack_size, p.reference_price,
               b.baseline_quantity, b.current_quantity,
               (SELECT MAX(t.created_at) FROM transactions t WHERE t.product_id = p.id AND t.location_id = b.location_id),
               (SELECT COUNT(*) FROM exceptions e WHERE e.product_id = p.id AND e.status = 'OPEN'),
               (SELECT i.report_as_of_date FROM imports i WHERE i.id = b.baseline_import_id)
          FROM inventory_balances b
          JOIN products p ON p.id = b.product_id
         WHERE b.location_id = ?1 AND p.id = ?2
        ",
    )?;
    let row = stmt.query_row(rusqlite::params![location_id, product_id], |row| {
        Ok(ProductDetail {
            product_id: row.get(0)?,
            name: row.get(1)?,
            model_code: row.get(2)?,
            external_code: row.get(3)?,
            pack_size: row.get(4)?,
            reference_price: row.get(5)?,
            location_name: location_name.to_string(),
            baseline_quantity: row.get(6)?,
            current_quantity: row.get(7)?,
            baseline_as_of: row.get(10)?,
            identifiers: Vec::new(),
            last_changed_at: row.get(8)?,
            open_exception_count: row.get(9)?,
        })
    });
    match row {
        Ok(mut detail) => {
            detail.identifiers = list_identifiers(conn, product_id)?;
            Ok(Some(detail))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

pub fn count_open_exceptions(conn: &Connection) -> Result<i64, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM exceptions WHERE status = 'OPEN'",
        [],
        |row| row.get(0),
    )?;
    Ok(n)
}
