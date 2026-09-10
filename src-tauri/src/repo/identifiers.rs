use rusqlite::{Connection, OptionalExtension};

use crate::dto::{IdentifierDto, IdentifierType};
use crate::error::AppError;

pub struct IdentifierRecord {
    pub id: i64,
    pub product_id: i64,
    pub code: String,
    pub identifier_type: IdentifierType,
    pub unit_multiplier: i64,
}

impl IdentifierRecord {
    pub fn to_dto(&self) -> IdentifierDto {
        IdentifierDto {
            id: self.id,
            code: self.code.clone(),
            identifier_type: self.identifier_type,
            unit_multiplier: self.unit_multiplier,
        }
    }
}

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<IdentifierRecord> {
    let ty: String = row.get(3)?;
    Ok(IdentifierRecord {
        id: row.get(0)?,
        product_id: row.get(1)?,
        code: row.get(2)?,
        identifier_type: IdentifierType::from_db(&ty),
        unit_multiplier: row.get(4)?,
    })
}

pub fn find_active_by_code(conn: &Connection, code: &str) -> Result<Option<IdentifierRecord>, AppError> {
    conn.query_row(
        "
        SELECT id, product_id, code, identifier_type, unit_multiplier
          FROM identifiers
         WHERE code = ?1 AND is_active = 1
        ",
        [code],
        map_row,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn insert(
    conn: &Connection,
    product_id: i64,
    code: &str,
    ty: IdentifierType,
    unit_multiplier: i64,
    created_by: i64,
    now_iso: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "
        INSERT INTO identifiers (
            product_id, code, identifier_type, unit_multiplier, is_active, created_by, created_at
        ) VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)
        ",
        rusqlite::params![product_id, code, ty.as_db(), unit_multiplier, created_by, now_iso],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn deactivate(
    conn: &Connection,
    id: i64,
    operator_id: i64,
    now_iso: &str,
) -> Result<(), AppError> {
    let n = conn.execute(
        "
        UPDATE identifiers
           SET is_active = 0, deactivated_at = ?2, deactivated_by = ?3
         WHERE id = ?1 AND is_active = 1
        ",
        rusqlite::params![id, now_iso, operator_id],
    )?;
    if n == 0 {
        return Err(AppError::NotFound("identifier"));
    }
    Ok(())
}

pub fn get(conn: &Connection, id: i64) -> Result<Option<IdentifierRecord>, AppError> {
    conn.query_row(
        "SELECT id, product_id, code, identifier_type, unit_multiplier FROM identifiers WHERE id = ?1",
        [id],
        map_row,
    )
    .optional()
    .map_err(AppError::from)
}

pub fn record_pairing(
    conn: &Connection,
    identifier_id: i64,
    product_id: i64,
    action: &str,
    operator_id: i64,
    import_id: Option<i64>,
    now_iso: &str,
    notes: Option<&str>,
) -> Result<(), AppError> {
    conn.execute(
        "
        INSERT INTO barcode_pairing_events (
            identifier_id, product_id, action, operator_id, import_id, created_at, notes
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
        ",
        rusqlite::params![identifier_id, product_id, action, operator_id, import_id, now_iso, notes],
    )?;
    Ok(())
}
