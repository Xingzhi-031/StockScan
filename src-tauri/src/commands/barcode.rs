use chrono::Utc;
use std::path::PathBuf;
use tauri::State;

use super::with_db;
use crate::dto::{
    BarcodeCoverage, BarcodeImportApplyResult, BarcodeImportPreview, CheckBarcodeResult,
    ExportResult, IdentifierDto, LinkBarcodeInput, ProductCard, RecentLink, ResolveResult,
};
use crate::error::AppError;
use crate::services;
use crate::state::AppState;

#[tauri::command]
pub async fn resolve_barcode(state: State<'_, AppState>, code: String) -> Result<ResolveResult, AppError> {
    with_db(&state, move |conn| services::barcode::resolve(conn, &code, Utc::now())).await
}

#[tauri::command]
pub async fn get_product_card(
    state: State<'_, AppState>,
    product_id: i64,
) -> Result<ProductCard, AppError> {
    with_db(&state, move |conn| services::barcode::product_card(conn, product_id)).await
}

#[tauri::command]
pub async fn get_barcode_coverage(state: State<'_, AppState>) -> Result<BarcodeCoverage, AppError> {
    with_db(&state, move |conn| services::barcode::coverage(conn)).await
}

#[tauri::command]
pub async fn next_unlinked_product(
    state: State<'_, AppState>,
    after_product_id: Option<i64>,
) -> Result<Option<ProductCard>, AppError> {
    with_db(&state, move |conn| services::barcode::next_unlinked(conn, after_product_id)).await
}

#[tauri::command]
pub async fn check_barcode(state: State<'_, AppState>, code: String) -> Result<CheckBarcodeResult, AppError> {
    with_db(&state, move |conn| services::barcode::check(conn, &code)).await
}

#[tauri::command]
pub async fn link_barcode(
    state: State<'_, AppState>,
    input: LinkBarcodeInput,
) -> Result<IdentifierDto, AppError> {
    with_db(&state, move |conn| services::barcode::link(conn, &input, Utc::now())).await
}

#[tauri::command]
pub async fn deactivate_barcode(
    state: State<'_, AppState>,
    identifier_id: i64,
    operator_id: i64,
    note: String,
) -> Result<(), AppError> {
    with_db(&state, move |conn| {
        services::barcode::deactivate(conn, identifier_id, operator_id, note, Utc::now())
    })
    .await
}

#[tauri::command]
pub async fn list_recent_links(
    state: State<'_, AppState>,
    limit: Option<i64>,
) -> Result<Vec<RecentLink>, AppError> {
    let limit = limit.unwrap_or(20);
    with_db(&state, move |conn| services::barcode::recent_links(conn, limit)).await
}

#[tauri::command]
pub async fn export_barcode_template(
    state: State<'_, AppState>,
    path: String,
    only_unlinked: bool,
) -> Result<ExportResult, AppError> {
    with_db(&state, move |conn| {
        services::barcode::export_template(conn, PathBuf::from(path).as_path(), only_unlinked)
    })
    .await
}

#[tauri::command]
pub async fn preview_barcode_import(
    state: State<'_, AppState>,
    path: String,
    operator_id: i64,
) -> Result<BarcodeImportPreview, AppError> {
    with_db(&state, move |conn| {
        services::barcode::preview_import(conn, PathBuf::from(path).as_path(), operator_id, Utc::now())
    })
    .await
}

#[tauri::command]
pub async fn apply_barcode_import(
    state: State<'_, AppState>,
    import_id: i64,
    operator_id: i64,
) -> Result<BarcodeImportApplyResult, AppError> {
    with_db(&state, move |conn| {
        services::barcode::apply_import(conn, import_id, operator_id, Utc::now())
    })
    .await
}
