use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};
use std::path::Path;

use crate::error::AppError;

pub mod invariants;

pub fn migrations() -> Migrations<'static> {
    Migrations::new(vec![M::up(include_str!("../../migrations/0001_init.sql"))])
}

pub fn open(path: &Path) -> Result<Connection, AppError> {
    let conn = Connection::open(path)?;
    apply_pragmas(&conn)?;
    Ok(conn)
}

pub fn open_in_memory() -> Result<Connection, AppError> {
    let conn = Connection::open_in_memory()?;
    apply_pragmas(&conn)?;
    Ok(conn)
}

fn apply_pragmas(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = FULL;
        PRAGMA busy_timeout = 5000;
        PRAGMA temp_store = MEMORY;
        ",
    )?;
    Ok(())
}

pub fn migrate(conn: &mut Connection) -> Result<(), AppError> {
    migrations()
        .to_latest(conn)
        .map_err(|e| AppError::internal(e.to_string()))
}

/// Write path: `BEGIN IMMEDIATE` so two writers fail fast instead of converting
/// a deferred transaction into a deadlock.
pub fn write<T, F>(conn: &mut Connection, f: F) -> Result<T, AppError>
where
    F: FnOnce(&rusqlite::Transaction<'_>) -> Result<T, AppError>,
{
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let value = f(&tx)?;
    tx.commit()?;
    Ok(value)
}

#[cfg(test)]
mod tests;

#[cfg(test)]
#[test]
fn migrations_are_valid() {
    migrations().validate().unwrap();
}
