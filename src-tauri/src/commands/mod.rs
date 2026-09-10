use rusqlite::Connection;

use crate::error::AppError;
use crate::state::AppState;

pub mod app;
pub mod employees;

pub use app::*;
pub use employees::*;

pub async fn with_db<T, F>(state: &AppState, f: F) -> Result<T, AppError>
where
    T: Send + 'static,
    F: FnOnce(&mut Connection) -> Result<T, AppError> + Send + 'static,
{
    let db = state.db.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = db
            .lock()
            .map_err(|_| AppError::internal("db lock poisoned"))?;
        f(&mut conn)
    })
    .await
    .map_err(|e| AppError::internal(e.to_string()))?
}
