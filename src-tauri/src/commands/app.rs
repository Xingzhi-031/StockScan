use tauri::State;

use crate::dto::{Settings, StartupState};
use crate::error::AppError;
use crate::repo;
use crate::services;
use crate::state::{AppState, StartupReport};

#[tauri::command]
pub async fn get_startup_state(
    state: State<'_, AppState>,
    report: State<'_, StartupReport>,
) -> Result<StartupState, AppError> {
    let db = state.db.clone();
    let paths = state.paths.clone();
    let violations = report.violations;
    let version = env!("CARGO_PKG_VERSION").to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::internal("db lock poisoned"))?;
        services::setup::startup_state(&conn, &paths, violations, &version)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> Result<Settings, AppError> {
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = db
            .lock()
            .map_err(|_| AppError::internal("db lock poisoned"))?;
        repo::load_settings(&conn)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}
