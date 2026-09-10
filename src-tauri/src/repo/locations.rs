use rusqlite::{Connection, OptionalExtension};

use crate::dto::{LocationDto, LocationType};
use crate::error::AppError;

pub fn get_location(conn: &Connection, id: i64) -> Result<Option<LocationDto>, AppError> {
    conn.query_row(
        "SELECT id, code, name, location_type FROM locations WHERE id = ?1 AND is_active = 1",
        [id],
        |row| {
            let type_raw: String = row.get(3)?;
            Ok(LocationDto {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                location_type: LocationType::from_db(&type_raw),
            })
        },
    )
    .optional()
    .map_err(AppError::from)
}

pub fn insert_location(
    conn: &Connection,
    company_id: i64,
    code: &str,
    name: &str,
    location_type: LocationType,
    now_iso: &str,
) -> Result<i64, AppError> {
    conn.execute(
        "
        INSERT INTO locations (company_id, code, name, location_type, is_active, created_at, updated_at)
        VALUES (?1, ?2, ?3, ?4, 1, ?5, ?5)
        ",
        rusqlite::params![company_id, code, name, location_type.as_db(), now_iso],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn insert_company(conn: &Connection, name: &str, now_iso: &str) -> Result<i64, AppError> {
    conn.execute(
        "INSERT INTO companies (name, created_at) VALUES (?1, ?2)",
        rusqlite::params![name, now_iso],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn company_name(conn: &Connection, id: i64) -> Result<Option<String>, AppError> {
    conn.query_row("SELECT name FROM companies WHERE id = ?1", [id], |row| {
        row.get(0)
    })
    .optional()
    .map_err(AppError::from)
}

pub fn company_count(conn: &Connection) -> Result<i64, AppError> {
    let n: i64 = conn.query_row("SELECT COUNT(*) FROM companies", [], |row| row.get(0))?;
    Ok(n)
}
