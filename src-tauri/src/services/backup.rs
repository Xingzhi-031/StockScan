use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::state::AppPaths;

/// Daily backup lands in M7. Failure must not block startup.
pub fn daily_if_needed(_conn: &mut Connection, _paths: &AppPaths, _now: DateTime<Utc>) {
    log::info!("daily backup skipped (not implemented until M7)");
}
