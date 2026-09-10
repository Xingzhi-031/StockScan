use chrono::Utc;
use tauri::State;

use crate::dto::{EmployeeDto, EmployeeInput, OperatorContext};
use crate::error::AppError;
use crate::services;
use crate::state::AppState;
use super::with_db;

#[tauri::command]
pub async fn list_employees(
    state: State<'_, AppState>,
    include_inactive: Option<bool>,
) -> Result<Vec<EmployeeDto>, AppError> {
    let include_inactive = include_inactive.unwrap_or(false);
    with_db(&state, move |conn| {
        services::employees::list(conn, include_inactive)
    })
    .await
}

#[tauri::command]
pub async fn upsert_employee(
    state: State<'_, AppState>,
    input: EmployeeInput,
) -> Result<EmployeeDto, AppError> {
    with_db(&state, move |conn| {
        crate::db::write(conn, |tx| services::employees::upsert(tx, &input, Utc::now()))
    })
    .await
}

#[tauri::command]
pub async fn set_employee_active(
    state: State<'_, AppState>,
    id: i64,
    active: bool,
) -> Result<EmployeeDto, AppError> {
    with_db(&state, move |conn| {
        crate::db::write(conn, |tx| {
            services::employees::set_active(tx, id, active, Utc::now())
        })
    })
    .await
}

#[tauri::command]
pub async fn select_operator(
    state: State<'_, AppState>,
    employee_id: i64,
) -> Result<OperatorContext, AppError> {
    with_db(&state, move |conn| {
        crate::db::write(conn, |tx| {
            services::employees::select_operator(tx, employee_id, Utc::now())
        })
    })
    .await
}
