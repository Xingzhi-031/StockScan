use serde::{Deserialize, Serialize};
use ts_rs::TS;

use super::{ColumnTarget, FileFormat, ImportPurpose, MatchStatus};
use crate::error::ImportIssue;

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportColumnMap {
    pub source: String,
    pub target: ColumnTarget,
    pub first_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportCounts {
    #[ts(type = "number")]
    pub data_rows: i64,
    #[ts(type = "number")]
    pub matched: i64,
    #[ts(type = "number")]
    pub new: i64,
    #[ts(type = "number")]
    pub ambiguous: i64,
    #[ts(type = "number")]
    pub invalid: i64,
    #[ts(type = "number")]
    pub pack_size_missing: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct ImportRowDto {
    #[ts(type = "number")]
    pub row_number: i64,
    pub raw_name: String,
    pub name_key: String,
    pub external_code: Option<String>,
    #[ts(type = "number | null")]
    pub pack_size: Option<i64>,
    #[ts(type = "number | null")]
    pub quantity: Option<i64>,
    pub koli: Option<f64>,
    #[ts(type = "number | null")]
    pub price: Option<i64>,
    #[ts(type = "number | null")]
    pub product_id: Option<i64>,
    pub match_status: MatchStatus,
    pub issues: Vec<ImportIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct StockReportPreview {
    #[ts(type = "number")]
    pub import_id: i64,
    pub purpose: ImportPurpose,
    pub file_name: String,
    pub file_format: FileFormat,
    pub company_name: Option<String>,
    pub report_name: Option<String>,
    pub as_of_date: Option<String>,
    pub printed_at: Option<String>,
    pub cutoff_at: Option<String>,
    pub stock_column: String,
    pub stock_column_candidates: Vec<String>,
    pub columns: Vec<ImportColumnMap>,
    pub counts: ImportCounts,
    pub file_issues: Vec<ImportIssue>,
    pub sample_rows: Vec<ImportRowDto>,
    pub problem_rows: Vec<ImportRowDto>,
    pub can_apply: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
#[ts(export)]
pub struct BaselineApplyResult {
    #[ts(type = "number")]
    pub products: i64,
    #[ts(type = "number")]
    pub balances: i64,
}
