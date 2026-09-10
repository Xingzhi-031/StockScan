use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

use crate::error::AppError;

pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub paths: AppPaths,
}

#[derive(Clone)]
pub struct AppPaths {
    pub data_dir: PathBuf,
    pub db_file: PathBuf,
    pub backup_dir: PathBuf,
    pub export_dir: PathBuf,
    pub log_dir: PathBuf,
}

#[derive(Clone)]
pub struct StartupReport {
    pub violations: i64,
}

impl AppPaths {
    pub fn resolve(app: &AppHandle) -> Result<Self, AppError> {
        let data_dir = app.path().app_local_data_dir().map_err(|e| {
            AppError::internal(format!("app local data dir: {e}"))
        })?;
        std::fs::create_dir_all(&data_dir)?;

        let backup_dir = data_dir.join("backups");
        std::fs::create_dir_all(&backup_dir)?;

        let log_dir = data_dir.join("logs");
        std::fs::create_dir_all(&log_dir)?;

        let export_dir = app
            .path()
            .document_dir()
            .map_err(|e| AppError::internal(format!("documents dir: {e}")))?
            .join("StockScan");
        std::fs::create_dir_all(&export_dir)?;

        Ok(Self {
            db_file: data_dir.join("stockscan.db"),
            data_dir,
            backup_dir,
            export_dir,
            log_dir,
        })
    }
}
