mod commands;
mod db;
pub mod dto;
mod error;
mod repo;
mod services;
mod state;
mod time;

#[cfg(test)]
mod test_support;

use std::sync::{Arc, Mutex};

use chrono::Utc;
use tauri::Manager;

use crate::state::{AppPaths, AppState, StartupReport};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .max_file_size(5_000_000)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let paths = AppPaths::resolve(app.handle())?;
            let mut conn = db::open(&paths.db_file)?;
            db::migrate(&mut conn)?;
            services::sessions::close_stale_on_startup(&mut conn, Utc::now())?;
            let report = db::invariants::check(&conn)?;
            if report.violations > 0 {
                log::error!("startup invariant violations: {}", report.violations);
            }
            services::backup::daily_if_needed(&mut conn, &paths, Utc::now());
            app.manage(AppState {
                db: Arc::new(Mutex::new(conn)),
                paths,
            });
            app.manage(StartupReport {
                violations: report.violations,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_startup_state,
            commands::get_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running StockScan");
}
