use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum OperationType {
    StockIn,
    Sale,
    Return,
    Adjustment,
    Reversal,
    ReconciliationAdjustment,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum LocationType {
    Warehouse,
    Online,
    Damaged,
    Other,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
#[ts(export)]
pub enum Language {
    En,
    Zh,
    Id,
}

impl Language {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::En => "en",
            Self::Zh => "zh",
            Self::Id => "id",
        }
    }
}

impl Default for Language {
    fn default() -> Self {
        Self::En
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "PascalCase")]
#[ts(export)]
pub enum ScannerSuffix {
    Enter,
    Tab,
    None,
}

impl Default for ScannerSuffix {
    fn default() -> Self {
        Self::Enter
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LocationDto {
    #[ts(type = "number")]
    pub id: i64,
    pub code: String,
    pub name: String,
    pub location_type: LocationType,
}
