use chrono::{DateTime, Utc};
use rusqlite::Connection;

use crate::dto::{Settings, SettingsPatch};
use crate::error::AppError;
use crate::repo;
use crate::time;

fn in_range(value: i64, min: i64, max: i64) -> Result<i64, AppError> {
    if value < min || value > max {
        return Err(AppError::invalid("SETTINGS_RANGE"));
    }
    Ok(value)
}

pub fn update(
    conn: &Connection,
    patch: &SettingsPatch,
    now: DateTime<Utc>,
) -> Result<Settings, AppError> {
    let mut s = repo::load_settings(conn)?;
    apply_patch(&mut s, patch)?;
    repo::save_settings(conn, &s, &time::utc_iso(now))?;
    repo::load_settings(conn)
}

fn apply_patch(s: &mut Settings, patch: &SettingsPatch) -> Result<(), AppError> {
    if let Some(language) = patch.language {
        s.language = language;
    }
    if let Some(scanner) = &patch.scanner {
        let mut next = scanner.clone();
        next.max_gap_ms = in_range(next.max_gap_ms, 5, 200)?;
        next.min_length = in_range(next.min_length, 1, 32)?;
        next.idle_flush_ms = in_range(next.idle_flush_ms, 20, 500)?;
        next.dedup_ms = in_range(next.dedup_ms, 50, 2_000)?;
        s.scanner = next;
    }
    if let Some(scan) = &patch.scan {
        s.scan = scan.clone();
    }
    if let Some(session) = &patch.session {
        if let Some(idle) = session.idle_minutes {
            s.session.idle_minutes = in_range(idle, 5, 240)?;
        }
    }
    if let Some(sound) = &patch.sound {
        s.sound = sound.clone();
    }
    if let Some(backup) = &patch.backup {
        if let Some(dir) = &backup.secondary_dir {
            let trimmed = dir.trim();
            s.backup.secondary_dir = if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            };
        }
        if let Some(days) = backup.stale_warning_days {
            s.backup.stale_warning_days = in_range(days, 1, 30)?;
        }
    }
    if let Some(import) = &patch.import {
        s.import = import.clone();
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::dto::{Language, SoundSettings};
    use crate::test_support::{assert_invariants, test_db};

    #[test]
    fn language_patch_persists() {
        let conn = test_db();
        let now = Utc::now();
        let out = update(
            &conn,
            &SettingsPatch {
                language: Some(Language::Zh),
                ..SettingsPatch::default()
            },
            now,
        )
        .unwrap();
        assert_eq!(out.language, Language::Zh);
        assert_eq!(repo::load_settings(&conn).unwrap().language, Language::Zh);
        assert_invariants(&conn);
    }

    #[test]
    fn idle_minutes_out_of_range_is_rejected() {
        let conn = test_db();
        let err = update(
            &conn,
            &SettingsPatch {
                session: Some(crate::dto::SessionSettingsPatch {
                    idle_minutes: Some(1),
                }),
                ..SettingsPatch::default()
            },
            Utc::now(),
        )
        .unwrap_err();
        assert_eq!(err.code(), "INVALID_INPUT");
        match err {
            AppError::InvalidInput(reason) => assert_eq!(reason, "SETTINGS_RANGE"),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn sound_patch_does_not_reset_language() {
        let conn = test_db();
        let now = Utc::now();
        update(
            &conn,
            &SettingsPatch {
                language: Some(Language::Id),
                ..SettingsPatch::default()
            },
            now,
        )
        .unwrap();
        let out = update(
            &conn,
            &SettingsPatch {
                sound: Some(SoundSettings { enabled: false }),
                ..SettingsPatch::default()
            },
            now,
        )
        .unwrap();
        assert_eq!(out.language, Language::Id);
        assert!(!out.sound.enabled);
    }
}
