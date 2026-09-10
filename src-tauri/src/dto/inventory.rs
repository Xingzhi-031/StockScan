use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::IdentifierType;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct InventoryRow {
    #[ts(type = "number")]
    pub product_id: i64,
    pub name: String,
    pub model_code: Option<String>,
    pub external_code: Option<String>,
    #[ts(type = "number | null")]
    pub pack_size: Option<i64>,
    #[ts(type = "number | null")]
    pub reference_price: Option<i64>,
    #[ts(type = "number")]
    pub baseline_quantity: i64,
    #[ts(type = "number")]
    pub current_quantity: i64,
    #[ts(type = "number")]
    pub barcode_count: i64,
    pub barcodes: Vec<String>,
    pub last_changed_at: Option<String>,
    pub baseline_as_of: Option<String>,
    #[ts(type = "number")]
    pub open_exception_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct IdentifierDto {
    #[ts(type = "number")]
    pub id: i64,
    pub code: String,
    pub identifier_type: IdentifierType,
    #[ts(type = "number")]
    pub unit_multiplier: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ProductDetail {
    #[ts(type = "number")]
    pub product_id: i64,
    pub name: String,
    pub model_code: Option<String>,
    pub external_code: Option<String>,
    #[ts(type = "number | null")]
    pub pack_size: Option<i64>,
    #[ts(type = "number | null")]
    pub reference_price: Option<i64>,
    pub location_name: String,
    #[ts(type = "number")]
    pub baseline_quantity: i64,
    #[ts(type = "number")]
    pub current_quantity: i64,
    pub baseline_as_of: Option<String>,
    pub identifiers: Vec<IdentifierDto>,
    pub last_changed_at: Option<String>,
    #[ts(type = "number")]
    pub open_exception_count: i64,
}
