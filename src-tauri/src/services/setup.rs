use chrono::{Duration, Utc};
use rusqlite::Connection;

use crate::dto::StartupState;
use crate::error::AppError;
use crate::repo;
use crate::state::AppPaths;
use crate::time;

pub fn startup_state(
    conn: &Connection,
    paths: &AppPaths,
    invariant_violations: i64,
    app_version: &str,
) -> Result<StartupState, AppError> {
    let settings = repo::load_settings(conn)?;
    let active_location = match settings.active_location_id {
        Some(id) => repo::get_location(conn, id)?,
        None => None,
    };
    let company_name = match settings.company_id {
        Some(id) => repo::company_name(conn, id)?,
        None => None,
    };

    let secondary_backup_stale = match (
        &settings.backup.secondary_dir,
        &settings.backup.last_secondary_success_at,
    ) {
        (None, _) => true,
        (Some(_), None) => true,
        (Some(_), Some(at)) => match time::parse_utc(at) {
            Ok(ts) => {
                let days = settings.backup.stale_warning_days.max(0);
                Utc::now() - ts > Duration::days(days)
            }
            Err(_) => true,
        },
    };

    Ok(StartupState {
        setup_completed: settings.setup_completed_at.is_some(),
        invariant_violations,
        last_backup_at: settings.backup.last_success_at,
        secondary_backup_stale,
        active_location,
        company_name,
        data_dir: paths.data_dir.to_string_lossy().into_owned(),
        app_version: app_version.to_string(),
    })
}
