use chrono::{DateTime, Duration, Utc};
use rusqlite::Connection;

use crate::dto::{Role, SetupInput, StartupState};
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

pub fn complete_setup(
    conn: &mut Connection,
    input: &SetupInput,
    now: DateTime<Utc>,
) -> Result<(), AppError> {
    let company_name = input.company_name.split_whitespace().collect::<Vec<_>>().join(" ");
    if company_name.is_empty() || company_name.chars().count() > 120 {
        return Err(AppError::invalid("COMPANY_NAME_INVALID"));
    }
    let loc_code = input.location.code.trim();
    let loc_name = input.location.name.split_whitespace().collect::<Vec<_>>().join(" ");
    if loc_code.is_empty()
        || loc_code.len() > 32
        || loc_name.is_empty()
        || loc_name.chars().count() > 80
    {
        return Err(AppError::invalid("WAREHOUSE_INVALID"));
    }
    if repo::company_count(conn)? > 0 {
        return Err(AppError::invalid("SETUP_ALREADY_DONE"));
    }

    let now_iso = time::utc_iso(now);
    let tx = conn.transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)?;
    let company_id = repo::insert_company(&tx, &company_name, &now_iso)?;
    let location_id = repo::insert_location(
        &tx,
        company_id,
        loc_code,
        &loc_name,
        input.location.location_type,
        &now_iso,
    )?;

    let mut admin = input.admin.clone();
    admin.role = Role::Admin;
    crate::services::employees::upsert(&tx, &admin, now)?;
    for extra in &input.employees {
        let mut row = extra.clone();
        if row.role != Role::Admin {
            row.role = Role::Operator;
        }
        crate::services::employees::upsert(&tx, &row, now)?;
    }

    write_setup_settings(&tx, company_id, location_id, input, &now_iso)?;
    tx.commit()?;
    Ok(())
}

fn write_setup_settings(
    conn: &Connection,
    company_id: i64,
    location_id: i64,
    input: &SetupInput,
    now_iso: &str,
) -> Result<(), AppError> {
    repo::set_json(conn, "company_id", &company_id, now_iso)?;
    repo::set_json(conn, "active_location_id", &location_id, now_iso)?;
    repo::set_json(conn, "language", &input.language, now_iso)?;
    repo::set_json(conn, "setup_completed_at", &Some(now_iso.to_string()), now_iso)?;
    Ok(())
}

#[allow(dead_code)]
pub fn mark_setup_completed(
    conn: &Connection,
    company_id: i64,
    location_id: i64,
    language: crate::dto::Language,
    now_iso: &str,
) -> Result<(), AppError> {
    repo::set_json(conn, "company_id", &company_id, now_iso)?;
    repo::set_json(conn, "active_location_id", &location_id, now_iso)?;
    repo::set_json(conn, "language", &language, now_iso)?;
    repo::set_json(conn, "setup_completed_at", &Some(now_iso.to_string()), now_iso)?;
    Ok(())
}
