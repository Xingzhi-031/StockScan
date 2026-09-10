use rusqlite::{Connection, OptionalExtension};
use serde::de::DeserializeOwned;
use serde::Serialize;

use crate::dto::Settings;
use crate::error::AppError;

pub fn get_json<T: DeserializeOwned>(conn: &Connection, key: &str) -> Result<Option<T>, AppError> {
    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .optional()?;
    match raw {
        Some(s) => Ok(Some(serde_json::from_str(&s).map_err(|e| {
            AppError::internal(format!("settings {key}: {e}"))
        })?)),
        None => Ok(None),
    }
}

pub fn set_json<T: Serialize>(
    conn: &Connection,
    key: &str,
    value: &T,
    now_iso: &str,
) -> Result<(), AppError> {
    let encoded = serde_json::to_string(value).map_err(|e| AppError::internal(e.to_string()))?;
    conn.execute(
        "
        INSERT INTO settings (key, value, updated_at)
        VALUES (?1, ?2, ?3)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        ",
        rusqlite::params![key, encoded, now_iso],
    )?;
    Ok(())
}

pub fn load_settings(conn: &Connection) -> Result<Settings, AppError> {
    let mut s = Settings::default();
    if let Some(v) = get_json(conn, "company_id")? {
        s.company_id = v;
    }
    if let Some(v) = get_json(conn, "active_location_id")? {
        s.active_location_id = v;
    }
    if let Some(v) = get_json(conn, "language")? {
        s.language = v;
    }
    if let Some(v) = get_json(conn, "setup_completed_at")? {
        s.setup_completed_at = v;
    }
    if let Some(v) = get_json(conn, "scanner.max_gap_ms")? {
        s.scanner.max_gap_ms = v;
    }
    if let Some(v) = get_json(conn, "scanner.min_length")? {
        s.scanner.min_length = v;
    }
    if let Some(v) = get_json(conn, "scanner.idle_flush_ms")? {
        s.scanner.idle_flush_ms = v;
    }
    if let Some(v) = get_json(conn, "scanner.suffix")? {
        s.scanner.suffix = v;
    }
    if let Some(v) = get_json(conn, "scanner.dedup_ms")? {
        s.scanner.dedup_ms = v;
    }
    if let Some(v) = get_json(conn, "scan.quick_scan_enabled")? {
        s.scan.quick_scan_enabled = v;
    }
    if let Some(v) = get_json(conn, "scan.fkeys_enabled")? {
        s.scan.fkeys_enabled = v;
    }
    if let Some(v) = get_json(conn, "scan.auto_commit_on_next_scan")? {
        s.scan.auto_commit_on_next_scan = v;
    }
    if let Some(v) = get_json(conn, "scan.secondary_language")? {
        s.scan.secondary_language = v;
    }
    if let Some(v) = get_json(conn, "session.idle_minutes")? {
        s.session.idle_minutes = v;
    }
    if let Some(v) = get_json(conn, "session.next_number")? {
        s.session.next_number = v;
    }
    if let Some(v) = get_json(conn, "sound.enabled")? {
        s.sound.enabled = v;
    }
    if let Some(v) = get_json(conn, "backup.secondary_dir")? {
        s.backup.secondary_dir = v;
    }
    if let Some(v) = get_json(conn, "backup.last_success_at")? {
        s.backup.last_success_at = v;
    }
    if let Some(v) = get_json(conn, "backup.last_secondary_success_at")? {
        s.backup.last_secondary_success_at = v;
    }
    if let Some(v) = get_json(conn, "backup.stale_warning_days")? {
        s.backup.stale_warning_days = v;
    }
    if let Some(v) = get_json(conn, "import.missing_rows_mean_zero")? {
        s.import.missing_rows_mean_zero = v;
    }
    Ok(s)
}

pub fn save_settings(conn: &Connection, s: &Settings, now_iso: &str) -> Result<(), AppError> {
    set_json(conn, "company_id", &s.company_id, now_iso)?;
    set_json(conn, "active_location_id", &s.active_location_id, now_iso)?;
    set_json(conn, "language", &s.language, now_iso)?;
    set_json(conn, "setup_completed_at", &s.setup_completed_at, now_iso)?;
    set_json(conn, "scanner.max_gap_ms", &s.scanner.max_gap_ms, now_iso)?;
    set_json(conn, "scanner.min_length", &s.scanner.min_length, now_iso)?;
    set_json(conn, "scanner.idle_flush_ms", &s.scanner.idle_flush_ms, now_iso)?;
    set_json(conn, "scanner.suffix", &s.scanner.suffix, now_iso)?;
    set_json(conn, "scanner.dedup_ms", &s.scanner.dedup_ms, now_iso)?;
    set_json(conn, "scan.quick_scan_enabled", &s.scan.quick_scan_enabled, now_iso)?;
    set_json(conn, "scan.fkeys_enabled", &s.scan.fkeys_enabled, now_iso)?;
    set_json(
        conn,
        "scan.auto_commit_on_next_scan",
        &s.scan.auto_commit_on_next_scan,
        now_iso,
    )?;
    set_json(conn, "scan.secondary_language", &s.scan.secondary_language, now_iso)?;
    set_json(conn, "session.idle_minutes", &s.session.idle_minutes, now_iso)?;
    set_json(conn, "session.next_number", &s.session.next_number, now_iso)?;
    set_json(conn, "sound.enabled", &s.sound.enabled, now_iso)?;
    set_json(conn, "backup.secondary_dir", &s.backup.secondary_dir, now_iso)?;
    set_json(conn, "backup.last_success_at", &s.backup.last_success_at, now_iso)?;
    set_json(
        conn,
        "backup.last_secondary_success_at",
        &s.backup.last_secondary_success_at,
        now_iso,
    )?;
    set_json(
        conn,
        "backup.stale_warning_days",
        &s.backup.stale_warning_days,
        now_iso,
    )?;
    set_json(
        conn,
        "import.missing_rows_mean_zero",
        &s.import.missing_rows_mean_zero,
        now_iso,
    )?;
    Ok(())
}
