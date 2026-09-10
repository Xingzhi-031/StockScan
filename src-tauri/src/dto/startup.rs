use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::LocationDto;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct StartupState {
    pub setup_completed: bool,
    #[ts(type = "number")]
    pub invariant_violations: i64,
    pub last_backup_at: Option<String>,
    pub secondary_backup_stale: bool,
    pub active_location: Option<LocationDto>,
    pub company_name: Option<String>,
    pub data_dir: String,
    pub app_version: String,
}
