use chrono::Utc;
use tauri::State;

use super::with_db;
use crate::dto::{CommitTxInput, SessionSummary, TxPage, TxResult};
use crate::error::AppError;
use crate::services;
use crate::state::AppState;

#[tauri::command]
pub async fn commit_transaction(
    state: State<'_, AppState>,
    input: CommitTxInput,
) -> Result<TxResult, AppError> {
    with_db(&state, move |conn| services::transactions::commit(conn, &input, Utc::now())).await
}

#[tauri::command]
pub async fn undo_last(
    state: State<'_, AppState>,
    operator_id: i64,
    client_txn_id: String,
) -> Result<TxResult, AppError> {
    with_db(&state, move |conn| {
        services::transactions::undo_last(conn, operator_id, &client_txn_id, Utc::now())
    })
    .await
}

#[tauri::command]
pub async fn get_current_session(
    state: State<'_, AppState>,
    operator_id: i64,
) -> Result<Option<SessionSummary>, AppError> {
    with_db(&state, move |conn| services::sessions::current_summary(conn, operator_id)).await
}

#[tauri::command]
pub async fn finish_session(
    state: State<'_, AppState>,
    operator_id: i64,
) -> Result<Option<SessionSummary>, AppError> {
    with_db(&state, move |conn| services::sessions::finish(conn, operator_id, Utc::now())).await
}

#[tauri::command]
pub async fn list_transactions(
    state: State<'_, AppState>,
    session_id: Option<i64>,
    product_id: Option<i64>,
    cursor: Option<i64>,
    limit: Option<i64>,
) -> Result<TxPage, AppError> {
    let limit = limit.unwrap_or(100);
    with_db(&state, move |conn| {
        let (rows, next_cursor) =
            crate::repo::transactions::list_page(conn, session_id, product_id, cursor, limit)?;
        Ok(TxPage { rows, next_cursor })
    })
    .await
}
