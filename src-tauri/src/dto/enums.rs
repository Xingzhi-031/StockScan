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

impl OperationType {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::StockIn => "STOCK_IN",
            Self::Sale => "SALE",
            Self::Return => "RETURN",
            Self::Adjustment => "ADJUSTMENT",
            Self::Reversal => "REVERSAL",
            Self::ReconciliationAdjustment => "RECONCILIATION_ADJUSTMENT",
        }
    }

    pub fn from_db(s: &str) -> Result<Self, crate::error::AppError> {
        match s {
            "STOCK_IN" => Ok(Self::StockIn),
            "SALE" => Ok(Self::Sale),
            "RETURN" => Ok(Self::Return),
            "ADJUSTMENT" => Ok(Self::Adjustment),
            "REVERSAL" => Ok(Self::Reversal),
            "RECONCILIATION_ADJUSTMENT" => Ok(Self::ReconciliationAdjustment),
            _ => Err(crate::error::AppError::internal(format!("unknown operation {s}"))),
        }
    }
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

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum Role {
    Operator,
    Admin,
}

impl Role {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Operator => "OPERATOR",
            Self::Admin => "ADMIN",
        }
    }

    pub fn from_db(s: &str) -> Result<Self, crate::error::AppError> {
        match s {
            "OPERATOR" => Ok(Self::Operator),
            "ADMIN" => Ok(Self::Admin),
            _ => Err(crate::error::AppError::internal(format!("unknown role {s}"))),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum FileFormat {
    Xls,
    Xlsx,
    Html,
    Spreadsheetml,
    Csv,
}

impl FileFormat {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Xls => "XLS",
            Self::Xlsx => "XLSX",
            Self::Html => "HTML",
            Self::Spreadsheetml => "SPREADSHEETML",
            Self::Csv => "CSV",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum ImportPurpose {
    Baseline,
    Reconcile,
}

impl ImportPurpose {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Baseline => "BASELINE",
            Self::Reconcile => "RECONCILE",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum ColumnTarget {
    Name,
    PackSize,
    Stock,
    KoliCheck,
    Price,
    ExternalCode,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum MatchStatus {
    Matched,
    New,
    Ambiguous,
    Invalid,
}

impl MatchStatus {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Matched => "MATCHED",
            Self::New => "NEW",
            Self::Ambiguous => "AMBIGUOUS",
            Self::Invalid => "INVALID",
        }
    }

    pub fn from_db(s: &str) -> Self {
        match s {
            "MATCHED" => Self::Matched,
            "AMBIGUOUS" => Self::Ambiguous,
            "INVALID" => Self::Invalid,
            _ => Self::New,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum IdentifierType {
    Ean13,
    Ean8,
    Upca,
    Gtin14,
    Code128,
    Internal,
    Other,
}

impl IdentifierType {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Ean13 => "EAN13",
            Self::Ean8 => "EAN8",
            Self::Upca => "UPCA",
            Self::Gtin14 => "GTIN14",
            Self::Code128 => "CODE128",
            Self::Internal => "INTERNAL",
            Self::Other => "OTHER",
        }
    }

    pub fn from_db(s: &str) -> Self {
        match s {
            "EAN13" => Self::Ean13,
            "EAN8" => Self::Ean8,
            "UPCA" => Self::Upca,
            "GTIN14" => Self::Gtin14,
            "CODE128" => Self::Code128,
            "INTERNAL" => Self::Internal,
            _ => Self::Other,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum InputUom {
    Pcs,
    Ctn,
    Count,
}

impl InputUom {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Pcs => "PCS",
            Self::Ctn => "CTN",
            Self::Count => "COUNT",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum TxSource {
    Scan,
    ManualCode,
    ProductPanel,
}

impl TxSource {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Scan => "SCAN",
            Self::ManualCode => "MANUAL_CODE",
            Self::ProductPanel => "PRODUCT_PANEL",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum ReasonCode {
    CountCorrection,
    Damaged,
    DataMismatch,
    Other,
}

impl ReasonCode {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::CountCorrection => "COUNT_CORRECTION",
            Self::Damaged => "DAMAGED",
            Self::DataMismatch => "DATA_MISMATCH",
            Self::Other => "OTHER",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum ReturnDisposition {
    Sellable,
    Damaged,
    Quarantine,
    Other,
}

impl ReturnDisposition {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Sellable => "SELLABLE",
            Self::Damaged => "DAMAGED",
            Self::Quarantine => "QUARANTINE",
            Self::Other => "OTHER",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum BarcodeKind {
    Unit,
    Carton,
}

impl LocationType {
    pub fn as_db(self) -> &'static str {
        match self {
            Self::Warehouse => "WAREHOUSE",
            Self::Online => "ONLINE",
            Self::Damaged => "DAMAGED",
            Self::Other => "OTHER",
        }
    }

    pub fn from_db(s: &str) -> Self {
        match s {
            "WAREHOUSE" => Self::Warehouse,
            "ONLINE" => Self::Online,
            "DAMAGED" => Self::Damaged,
            _ => Self::Other,
        }
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
