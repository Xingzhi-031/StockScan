use rusqlite::Connection;

use crate::dto::{LocationDto, LocationType};
use crate::error::AppError;

pub fn get_location(conn: &Connection, id: i64) -> Result<Option<LocationDto>, AppError> {
    let mut stmt = conn.prepare(
        "SELECT id, code, name, location_type FROM locations WHERE id = ?1 AND is_active = 1",
    )?;
    let mut rows = stmt.query([id])?;
    match rows.next()? {
        Some(row) => {
            let type_raw: String = row.get(3)?;
            let location_type = match type_raw.as_str() {
                "WAREHOUSE" => LocationType::Warehouse,
                "ONLINE" => LocationType::Online,
                "DAMAGED" => LocationType::Damaged,
                _ => LocationType::Other,
            };
            Ok(Some(LocationDto {
                id: row.get(0)?,
                code: row.get(1)?,
                name: row.get(2)?,
                location_type,
            }))
        }
        None => Ok(None),
    }
}

pub fn company_name(conn: &Connection, id: i64) -> Result<Option<String>, AppError> {
    let mut stmt = conn.prepare("SELECT name FROM companies WHERE id = ?1")?;
    let mut rows = stmt.query([id])?;
    match rows.next()? {
        Some(row) => Ok(Some(row.get(0)?)),
        None => Ok(None),
    }
}
