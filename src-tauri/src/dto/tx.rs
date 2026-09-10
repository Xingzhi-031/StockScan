use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{
    IdentifierType, InputUom, OperationType, ReasonCode, ReturnDisposition, TxSource,
};
use crate::dto::IdentifierDto;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProductCard {
    #[ts(type = "number")]
    pub product_id: i64,
    pub name: String,
    pub model_code: Option<String>,
    #[ts(type = "number | null")]
    pub pack_size: Option<i64>,
    #[ts(type = "number | null")]
    pub reference_price: Option<i64>,
    #[ts(type = "number")]
    pub location_id: i64,
    #[ts(type = "number")]
    pub baseline_quantity: i64,
    #[ts(type = "number")]
    pub current_quantity: i64,
    pub baseline_as_of: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(tag = "kind", rename_all = "SCREAMING_SNAKE_CASE")]
#[ts(export)]
pub enum ResolveResult {
    Found {
        card: ProductCard,
        identifier: IdentifierDto,
    },
    Unknown {
        code: String,
    },
    ProductInactive {
        code: String,
        #[serde(rename = "productName")]
        product_name: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CommitTxInput {
    pub client_txn_id: String,
    #[ts(type = "number")]
    pub operator_id: i64,
    #[ts(type = "number")]
    pub product_id: i64,
    pub identifier_code: Option<String>,
    pub operation: OperationType,
    #[ts(type = "number")]
    pub input_quantity: i64,
    pub input_uom: InputUom,
    pub reason_code: Option<ReasonCode>,
    pub return_disposition: Option<ReturnDisposition>,
    pub acknowledge_negative: bool,
    pub source: TxSource,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct OpCount {
    pub operation: OperationType,
    #[ts(type = "number")]
    pub count: i64,
    #[ts(type = "number")]
    pub net_change: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct SessionSummary {
    #[ts(type = "number")]
    pub id: i64,
    #[ts(type = "number")]
    pub session_number: i64,
    #[ts(type = "number")]
    pub operator_id: i64,
    pub operator_name: String,
    pub started_at: String,
    pub last_activity_at: String,
    #[ts(type = "number")]
    pub tx_count: i64,
    #[ts(type = "number")]
    pub product_count: i64,
    #[ts(type = "number")]
    pub total_units: i64,
    #[ts(type = "number")]
    pub net_change: i64,
    pub by_operation: Vec<OpCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TxResult {
    #[ts(type = "number")]
    pub transaction_id: i64,
    pub client_txn_id: String,
    pub operation: OperationType,
    #[ts(type = "number")]
    pub quantity_change: i64,
    #[ts(type = "number")]
    pub stock_before: i64,
    #[ts(type = "number")]
    pub stock_after: i64,
    pub negative_warning: bool,
    pub session: SessionSummary,
    pub created_at: String,
    pub idempotent_replay: bool,
    pub was_exported: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BarcodeCoverage {
    #[ts(type = "number")]
    pub products: i64,
    #[ts(type = "number")]
    pub linked: i64,
    #[ts(type = "number")]
    pub unlinked: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct UsedByProduct {
    #[ts(type = "number")]
    pub product_id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct CheckBarcodeResult {
    pub available: bool,
    pub detected_type: IdentifierType,
    pub check_digit_valid: Option<bool>,
    pub used_by: Option<UsedByProduct>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct LinkBarcodeInput {
    #[ts(type = "number")]
    pub product_id: i64,
    pub code: String,
    pub kind: super::BarcodeKind,
    #[ts(type = "number | null")]
    pub unit_multiplier: Option<i64>,
    #[ts(type = "number")]
    pub operator_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct RecentLink {
    #[ts(type = "number")]
    pub identifier_id: i64,
    pub code: String,
    #[ts(type = "number")]
    pub product_id: i64,
    pub product_name: String,
    pub action: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BarcodeImportLine {
    #[ts(type = "number | null")]
    pub product_id: Option<i64>,
    pub product_name: String,
    pub unit_code: Option<String>,
    pub carton_code: Option<String>,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BarcodeImportPreview {
    #[ts(type = "number")]
    pub import_id: i64,
    pub file_name: String,
    pub lines: Vec<BarcodeImportLine>,
    #[ts(type = "number")]
    pub linked: i64,
    #[ts(type = "number")]
    pub skipped: i64,
    #[ts(type = "number")]
    pub conflicts: i64,
    pub can_apply: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BarcodeImportApplyResult {
    #[ts(type = "number")]
    pub linked: i64,
    #[ts(type = "number")]
    pub skipped: i64,
    #[ts(type = "number")]
    pub conflicts: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ExportResult {
    #[ts(type = "number")]
    pub row_count: i64,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TxRow {
    #[ts(type = "number")]
    pub id: i64,
    pub created_at: String,
    #[ts(type = "number")]
    pub operator_id: i64,
    pub operator_name: String,
    pub operator_code: String,
    #[ts(type = "number")]
    pub product_id: i64,
    pub product_name: String,
    pub model_code: Option<String>,
    pub identifier_code: Option<String>,
    pub operation: OperationType,
    #[ts(type = "number")]
    pub input_quantity: i64,
    pub input_uom: String,
    #[ts(type = "number")]
    pub unit_multiplier: i64,
    #[ts(type = "number")]
    pub quantity_change: i64,
    #[ts(type = "number")]
    pub stock_before: i64,
    #[ts(type = "number")]
    pub stock_after: i64,
    #[ts(type = "number | null")]
    pub session_number: Option<i64>,
    pub negative_warning: bool,
    pub reason_code: Option<String>,
    #[ts(type = "number | null")]
    pub reverses_transaction_id: Option<i64>,
    pub sync_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct TxPage {
    pub rows: Vec<TxRow>,
    #[ts(type = "number | null")]
    pub next_cursor: Option<i64>,
}
