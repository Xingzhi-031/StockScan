use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{Language, ScannerSuffix};

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct Settings {
    #[ts(type = "number | null")]
    pub company_id: Option<i64>,
    #[ts(type = "number | null")]
    pub active_location_id: Option<i64>,
    pub language: Language,
    pub setup_completed_at: Option<String>,
    pub scanner: ScannerSettings,
    pub scan: ScanSettings,
    pub session: SessionSettings,
    pub sound: SoundSettings,
    pub backup: BackupSettings,
    pub import: ImportSettings,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            company_id: None,
            active_location_id: None,
            language: Language::En,
            setup_completed_at: None,
            scanner: ScannerSettings::default(),
            scan: ScanSettings::default(),
            session: SessionSettings::default(),
            sound: SoundSettings::default(),
            backup: BackupSettings::default(),
            import: ImportSettings::default(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ScannerSettings {
    #[ts(type = "number")]
    pub max_gap_ms: i64,
    #[ts(type = "number")]
    pub min_length: i64,
    #[ts(type = "number")]
    pub idle_flush_ms: i64,
    pub suffix: ScannerSuffix,
    #[ts(type = "number")]
    pub dedup_ms: i64,
}

impl Default for ScannerSettings {
    fn default() -> Self {
        Self {
            max_gap_ms: 35,
            min_length: 6,
            idle_flush_ms: 60,
            suffix: ScannerSuffix::Enter,
            dedup_ms: 300,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ScanSettings {
    pub quick_scan_enabled: bool,
    pub fkeys_enabled: bool,
    pub auto_commit_on_next_scan: bool,
    pub secondary_language: Option<Language>,
}

impl Default for ScanSettings {
    fn default() -> Self {
        Self {
            quick_scan_enabled: false,
            fkeys_enabled: true,
            auto_commit_on_next_scan: false,
            secondary_language: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SessionSettings {
    #[ts(type = "number")]
    pub idle_minutes: i64,
    #[ts(type = "number")]
    pub next_number: i64,
}

impl Default for SessionSettings {
    fn default() -> Self {
        Self {
            idle_minutes: 30,
            next_number: 1,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SoundSettings {
    pub enabled: bool,
}

impl Default for SoundSettings {
    fn default() -> Self {
        Self { enabled: true }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BackupSettings {
    pub secondary_dir: Option<String>,
    pub last_success_at: Option<String>,
    pub last_secondary_success_at: Option<String>,
    #[ts(type = "number")]
    pub stale_warning_days: i64,
}

impl Default for BackupSettings {
    fn default() -> Self {
        Self {
            secondary_dir: None,
            last_success_at: None,
            last_secondary_success_at: None,
            stale_warning_days: 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportSettings {
    pub missing_rows_mean_zero: bool,
}

impl Default for ImportSettings {
    fn default() -> Self {
        Self {
            missing_rows_mean_zero: false,
        }
    }
}

/// Partial update for `update_settings`. Omitted fields stay as they are.
#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct SettingsPatch {
    #[ts(optional)]
    pub language: Option<Language>,
    #[ts(optional)]
    pub scanner: Option<ScannerSettings>,
    #[ts(optional)]
    pub scan: Option<ScanSettings>,
    #[ts(optional)]
    pub session: Option<SessionSettingsPatch>,
    #[ts(optional)]
    pub sound: Option<SoundSettings>,
    #[ts(optional)]
    pub backup: Option<BackupSettingsPatch>,
    #[ts(optional)]
    pub import: Option<ImportSettings>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct SessionSettingsPatch {
    #[ts(optional, type = "number")]
    pub idle_minutes: Option<i64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase", default)]
#[ts(export)]
pub struct BackupSettingsPatch {
    #[ts(optional)]
    pub secondary_dir: Option<String>,
    #[ts(optional, type = "number")]
    pub stale_warning_days: Option<i64>,
}
