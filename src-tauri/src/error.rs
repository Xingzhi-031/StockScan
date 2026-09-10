use serde::ser::{Serialize, SerializeStruct, Serializer};
use serde_json::{json, Value};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIssue {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("invalid quantity")]
    InvalidQuantity,
    #[error("quantity too large")]
    QuantityTooLarge,
    #[error("no change")]
    NoChange,
    #[error("needs acknowledgement")]
    NeedsAck { stock_before: i64, stock_after: i64 },
    #[error("pack size missing")]
    PackSizeMissing { product_id: i64 },
    #[error("carton barcode with CTN")]
    CartonBarcodeWithCtn,
    #[error("barcode in use")]
    BarcodeInUse { product_id: i64, product_name: String },
    #[error("not found: {0}")]
    NotFound(&'static str),
    #[error("operator inactive")]
    OperatorInactive,
    #[error("setup incomplete")]
    SetupIncomplete,
    #[error("nothing to undo")]
    NothingToUndo,
    #[error("baseline exists")]
    BaselineExists,
    #[error("import: {0}")]
    Import(String),
    #[error("reconcile has pending lines")]
    ReconcilePending { pending: i64 },
    #[error("preview expired")]
    PreviewStale,
    #[error("backup: {0}")]
    Backup(String),
    #[error("database: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("internal: {0}")]
    Internal(String),
}

impl AppError {
    pub fn internal(s: impl Into<String>) -> Self {
        Self::Internal(s.into())
    }

    pub fn import(kind: impl Into<String>, message: impl Into<String>) -> Self {
        let issue = ImportIssue {
            kind: kind.into(),
            message: Some(message.into()),
        };
        Self::Import(serde_json::to_string(&issue).unwrap_or_else(|_| "import error".into()))
    }

    pub fn code(&self) -> &'static str {
        match self {
            Self::InvalidInput(_) => "INVALID_INPUT",
            Self::InvalidQuantity => "INVALID_QUANTITY",
            Self::QuantityTooLarge => "QUANTITY_TOO_LARGE",
            Self::NoChange => "NO_CHANGE",
            Self::NeedsAck { .. } => "NEEDS_ACK",
            Self::PackSizeMissing { .. } => "PACK_SIZE_MISSING",
            Self::CartonBarcodeWithCtn => "CARTON_BARCODE_WITH_CTN",
            Self::BarcodeInUse { .. } => "BARCODE_IN_USE",
            Self::NotFound(_) => "NOT_FOUND",
            Self::OperatorInactive => "OPERATOR_INACTIVE",
            Self::SetupIncomplete => "SETUP_INCOMPLETE",
            Self::NothingToUndo => "NOTHING_TO_UNDO",
            Self::BaselineExists => "BASELINE_EXISTS",
            Self::Import(_) => "IMPORT_ERROR",
            Self::ReconcilePending { .. } => "RECONCILE_PENDING",
            Self::PreviewStale => "PREVIEW_STALE",
            Self::Backup(_) => "BACKUP_ERROR",
            Self::Db(_) => "DB_ERROR",
            Self::Io(_) => "IO_ERROR",
            Self::Internal(_) => "INTERNAL",
        }
    }

    fn details(&self) -> Value {
        match self {
            Self::NeedsAck {
                stock_before,
                stock_after,
            } => json!({ "stockBefore": stock_before, "stockAfter": stock_after }),
            Self::PackSizeMissing { product_id } => json!({ "productId": product_id }),
            Self::BarcodeInUse {
                product_id,
                product_name,
            } => json!({ "productId": product_id, "productName": product_name }),
            Self::ReconcilePending { pending } => json!({ "pending": pending }),
            Self::NotFound(what) => json!({ "entity": what }),
            Self::Import(raw) => serde_json::from_str(raw).unwrap_or(Value::Null),
            Self::InvalidInput(msg) => json!({ "reason": msg }),
            Self::Backup(msg) => json!({ "reason": msg }),
            _ => Value::Null,
        }
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        let mut st = s.serialize_struct("AppError", 3)?;
        st.serialize_field("code", self.code())?;
        st.serialize_field("message", &self.to_string())?;
        st.serialize_field("details", &self.details())?;
        st.end()
    }
}
