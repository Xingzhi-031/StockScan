use rusqlite::{Connection, OptionalExtension};

use crate::dto::{FileFormat, ImportPurpose, ImportRowDto, MatchStatus};
use crate::error::{AppError, ImportIssue};

#[derive(Debug, Clone)]
pub struct ImportRecord {
    pub id: i64,
    pub import_type: String,
    pub status: String,
    pub file_name: String,
    pub file_sha256: String,
    pub file_format: String,
    pub source_report_name: Option<String>,
    pub company_name: Option<String>,
    pub source_location_name: Option<String>,
    pub location_id: Option<i64>,
    pub report_as_of_date: Option<String>,
    pub report_cutoff_at: Option<String>,
    pub report_printed_at: Option<String>,
    pub row_count: i64,
    pub warnings_json: String,
    pub notes: Option<String>,
}

pub fn insert_preview(
    conn: &Connection,
    purpose: ImportPurpose,
    file_name: &str,
    sha: &str,
    format: FileFormat,
    report_name: Option<&str>,
    company_name: Option<&str>,
    stock_column: &str,
    location_id: i64,
    as_of: Option<&str>,
    cutoff_at: Option<&str>,
    printed_at: Option<&str>,
    row_count: i64,
    warnings: &[ImportIssue],
    imported_by: i64,
    now_iso: &str,
    notes: &str,
) -> Result<i64, AppError> {
    let warnings_json = serde_json::to_string(warnings).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "
        INSERT INTO imports (
            import_type, status, file_name, file_sha256, file_format, source_system,
            source_report_name, company_name, source_location_name, location_id,
            report_as_of_date, report_cutoff_at, report_printed_at, row_count,
            warnings_json, imported_by, imported_at, notes
        ) VALUES (
            ?1, 'PREVIEWED', ?2, ?3, ?4, 'ACCURATE5',
            ?5, ?6, ?7, ?8,
            ?9, ?10, ?11, ?12,
            ?13, ?14, ?15, ?16
        )
        ",
        rusqlite::params![
            purpose.as_db(),
            file_name,
            sha,
            format.as_db(),
            report_name,
            company_name,
            stock_column,
            location_id,
            as_of,
            cutoff_at,
            printed_at,
            row_count,
            warnings_json,
            imported_by,
            now_iso,
            notes,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn get(conn: &Connection, id: i64) -> Result<Option<ImportRecord>, AppError> {
    conn.query_row(
        "
        SELECT id, import_type, status, file_name, file_sha256, file_format,
               source_report_name, company_name, source_location_name, location_id,
               report_as_of_date, report_cutoff_at, report_printed_at, row_count,
               warnings_json, notes
          FROM imports WHERE id = ?1
        ",
        [id],
        |row| {
            Ok(ImportRecord {
                id: row.get(0)?,
                import_type: row.get(1)?,
                status: row.get(2)?,
                file_name: row.get(3)?,
                file_sha256: row.get(4)?,
                file_format: row.get(5)?,
                source_report_name: row.get(6)?,
                company_name: row.get(7)?,
                source_location_name: row.get(8)?,
                location_id: row.get(9)?,
                report_as_of_date: row.get(10)?,
                report_cutoff_at: row.get(11)?,
                report_printed_at: row.get(12)?,
                row_count: row.get(13)?,
                warnings_json: row.get(14)?,
                notes: row.get(15)?,
            })
        },
    )
    .optional()
    .map_err(AppError::from)
}

pub fn replace_rows(conn: &Connection, import_id: i64, rows: &[ImportRowDto]) -> Result<(), AppError> {
    conn.execute("DELETE FROM import_rows WHERE import_id = ?1", [import_id])?;
    let mut stmt = conn.prepare(
        "
        INSERT INTO import_rows (
            import_id, row_number, raw_name, name_key, external_code, pack_size,
            quantity, koli, price, product_id, match_status, issues_json
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ",
    )?;
    for row in rows {
        let issues = serde_json::to_string(&row.issues).unwrap_or_else(|_| "[]".into());
        stmt.execute(rusqlite::params![
            import_id,
            row.row_number,
            row.raw_name,
            row.name_key,
            row.external_code,
            row.pack_size,
            row.quantity,
            row.koli,
            row.price,
            row.product_id,
            row.match_status.as_db(),
            issues,
        ])?;
    }
    Ok(())
}

pub fn list_rows(conn: &Connection, import_id: i64) -> Result<Vec<ImportRowDto>, AppError> {
    let mut stmt = conn.prepare(
        "
        SELECT row_number, raw_name, name_key, external_code, pack_size, quantity,
               koli, price, product_id, match_status, issues_json
          FROM import_rows WHERE import_id = ?1 ORDER BY row_number
        ",
    )?;
    let mapped = stmt.query_map([import_id], |row| {
        let issues_raw: String = row.get(10)?;
        let issues: Vec<ImportIssue> = serde_json::from_str(&issues_raw).unwrap_or_default();
        let status: String = row.get(9)?;
        Ok(ImportRowDto {
            row_number: row.get(0)?,
            raw_name: row.get(1)?,
            name_key: row.get(2)?,
            external_code: row.get(3)?,
            pack_size: row.get(4)?,
            quantity: row.get(5)?,
            koli: row.get(6)?,
            price: row.get(7)?,
            product_id: row.get(8)?,
            match_status: MatchStatus::from_db(&status),
            issues,
        })
    })?;
    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn update_preview_meta(
    conn: &Connection,
    id: i64,
    stock_column: &str,
    as_of: Option<&str>,
    cutoff_at: Option<&str>,
    printed_at: Option<&str>,
    row_count: i64,
    warnings: &[ImportIssue],
    notes: &str,
) -> Result<(), AppError> {
    let warnings_json = serde_json::to_string(warnings).unwrap_or_else(|_| "[]".into());
    conn.execute(
        "
        UPDATE imports
           SET source_location_name = ?2,
               report_as_of_date = ?3,
               report_cutoff_at = ?4,
               report_printed_at = ?5,
               row_count = ?6,
               warnings_json = ?7,
               notes = ?8
         WHERE id = ?1
        ",
        rusqlite::params![
            id,
            stock_column,
            as_of,
            cutoff_at,
            printed_at,
            row_count,
            warnings_json,
            notes
        ],
    )?;
    Ok(())
}

pub fn mark_applied(conn: &Connection, id: i64, now_iso: &str) -> Result<(), AppError> {
    conn.execute(
        "UPDATE imports SET status = 'APPLIED', applied_at = ?2 WHERE id = ?1",
        rusqlite::params![id, now_iso],
    )?;
    Ok(())
}

pub fn mark_cancelled(conn: &Connection, id: i64) -> Result<(), AppError> {
    conn.execute(
        "UPDATE imports SET status = 'CANCELLED' WHERE id = ?1 AND status = 'PREVIEWED'",
        [id],
    )?;
    Ok(())
}

pub fn latest_applied_as_of(conn: &Connection, location_id: i64) -> Result<Option<String>, AppError> {
    conn.query_row(
        "
        SELECT report_as_of_date FROM imports
         WHERE location_id = ?1 AND status = 'APPLIED' AND report_as_of_date IS NOT NULL
         ORDER BY applied_at DESC LIMIT 1
        ",
        [location_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
}

pub fn as_of_for_import(conn: &Connection, import_id: i64) -> Result<Option<String>, AppError> {
    conn.query_row(
        "SELECT report_as_of_date FROM imports WHERE id = ?1",
        [import_id],
        |row| row.get(0),
    )
    .optional()
    .map_err(AppError::from)
    .map(|v| v.flatten())
}
