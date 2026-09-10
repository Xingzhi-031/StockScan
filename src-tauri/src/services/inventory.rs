use rusqlite::Connection;

use crate::dto::{InventoryRow, ProductDetail};
use crate::error::AppError;
use crate::repo;

pub fn list(conn: &Connection) -> Result<Vec<InventoryRow>, AppError> {
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    repo::inventory::list_rows(conn, location_id)
}

pub fn detail(conn: &Connection, product_id: i64) -> Result<ProductDetail, AppError> {
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let location = repo::get_location(conn, location_id)?.ok_or(AppError::NotFound("location"))?;
    repo::inventory::product_detail(conn, location_id, product_id, &location.name)?
        .ok_or(AppError::NotFound("product"))
}

pub fn open_exception_count(conn: &Connection) -> Result<i64, AppError> {
    repo::inventory::count_open_exceptions(conn)
}
