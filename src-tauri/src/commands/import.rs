use chrono::Utc;
use std::path::PathBuf;
use tauri::State;

use super::with_db;
use crate::dto::{
    BaselineApplyResult, ImportPurpose, InventoryRow, ProductDetail, StockReportPreview,
};
use crate::error::AppError;
use crate::services;
use crate::state::AppState;

#[tauri::command]
pub async fn preview_stock_report(
    state: State<'_, AppState>,
    path: String,
    operator_id: i64,
    purpose: ImportPurpose,
) -> Result<StockReportPreview, AppError> {
    let data_dir = state.paths.data_dir.clone();
    with_db(&state, move |conn| {
        services::import::preview_stock_report(
            conn,
            PathBuf::from(path).as_path(),
            operator_id,
            purpose,
            Some(data_dir.as_path()),
            Utc::now(),
        )
    })
    .await
}

#[tauri::command]
pub async fn set_report_options(
    state: State<'_, AppState>,
    import_id: i64,
    stock_column: Option<String>,
    cutoff_at: Option<String>,
    as_of_date: Option<String>,
) -> Result<StockReportPreview, AppError> {
    with_db(&state, move |conn| {
        services::import::set_report_options(
            conn,
            import_id,
            stock_column,
            cutoff_at,
            as_of_date,
            Utc::now(),
        )
    })
    .await
}

#[tauri::command]
pub async fn apply_baseline_import(
    state: State<'_, AppState>,
    import_id: i64,
    operator_id: i64,
) -> Result<BaselineApplyResult, AppError> {
    with_db(&state, move |conn| {
        let result = services::import::apply_baseline(conn, import_id, operator_id, Utc::now())?;
        let report = crate::db::invariants::check(conn)?;
        if report.violations > 0 {
            log::error!("invariants after baseline: {}", report.violations);
        }
        Ok(result)
    })
    .await
}

#[tauri::command]
pub async fn cancel_import(state: State<'_, AppState>, import_id: i64) -> Result<(), AppError> {
    with_db(&state, move |conn| {
        crate::db::write(conn, |tx| services::import::cancel_import(tx, import_id))
    })
    .await
}

#[tauri::command]
pub async fn list_inventory(state: State<'_, AppState>) -> Result<Vec<InventoryRow>, AppError> {
    with_db(&state, move |conn| services::inventory::list(conn)).await
}

#[tauri::command]
pub async fn get_product_detail(
    state: State<'_, AppState>,
    product_id: i64,
) -> Result<ProductDetail, AppError> {
    with_db(&state, move |conn| services::inventory::detail(conn, product_id)).await
}

#[tauri::command]
pub async fn count_open_exceptions(state: State<'_, AppState>) -> Result<i64, AppError> {
    with_db(&state, move |conn| services::inventory::open_exception_count(conn)).await
}

#[tauri::command]
pub async fn dev_write_sample_report(
    state: State<'_, AppState>,
    rows: Option<i64>,
) -> Result<String, AppError> {
    let dir = state.paths.export_dir.clone();
    let n = rows.unwrap_or(1284).clamp(1, 5000) as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let path = services::import::write_sample_xlsx(&dir, n)?;
        Ok(path.to_string_lossy().into_owned())
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}
