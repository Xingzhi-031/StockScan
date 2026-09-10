use chrono::{DateTime, Utc};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::dto::{
    BaselineApplyResult, ColumnTarget, FileFormat, ImportColumnMap, ImportCounts, ImportPurpose,
    ImportRowDto, MatchStatus, StockReportPreview,
};
use crate::error::{AppError, ImportIssue};
use crate::importers::{self, names};
use crate::repo;
use crate::time;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct ImportNotes {
    stored_path: Option<String>,
    source_path: Option<String>,
}

fn file_name_of(path: &Path) -> String {
    path.file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("report.xls")
        .to_string()
}

fn store_copy(data_dir: Option<&Path>, sha: &str, bytes: &[u8], source: &Path) -> Result<PathBuf, AppError> {
    if let Some(dir) = data_dir {
        let folder = dir.join("imports");
        std::fs::create_dir_all(&folder)?;
        let dest = folder.join(sha);
        if !dest.exists() {
            std::fs::write(&dest, bytes)?;
        }
        Ok(dest)
    } else {
        Ok(source.to_path_buf())
    }
}

fn match_row(
    conn: &Connection,
    company_id: i64,
    row: &importers::parse::ParsedRow,
) -> (MatchStatus, Option<i64>, bool) {
    if row.skipped || row.quantity.is_none() {
        let ambiguous = row.issues.iter().any(|i| i.kind == "AMBIGUOUS");
        return (
            if ambiguous {
                MatchStatus::Ambiguous
            } else {
                MatchStatus::Invalid
            },
            None,
            false,
        );
    }
    if let Some(code) = &row.external_code {
        if let Ok(Some(id)) = repo::products::find_by_external(conn, company_id, code) {
            return (MatchStatus::Matched, Some(id), false);
        }
    }
    if let Ok(Some(id)) = repo::products::find_by_name_key(conn, company_id, &row.name_key) {
        return (MatchStatus::Matched, Some(id), false);
    }
    (MatchStatus::New, None, false)
}

fn to_dto(
    conn: &Connection,
    company_id: i64,
    row: &importers::parse::ParsedRow,
) -> ImportRowDto {
    let (match_status, product_id, _) = match_row(conn, company_id, row);
    ImportRowDto {
        row_number: row.row_number as i64,
        raw_name: row.raw_name.clone(),
        name_key: row.name_key.clone(),
        external_code: row.external_code.clone(),
        pack_size: row.pack_size,
        quantity: row.quantity,
        koli: row.koli,
        price: row.price,
        product_id,
        match_status,
        issues: row.issues.clone(),
    }
}

fn column_maps(parsed: &importers::parse::ParsedReport, first: Option<&ImportRowDto>) -> Vec<ImportColumnMap> {
    let headers = &parsed.columns.headers;
    let mut out = Vec::new();
    let push = |out: &mut Vec<ImportColumnMap>, idx: usize, target: ColumnTarget, first_value: Option<String>| {
        out.push(ImportColumnMap {
            source: headers.get(idx).cloned().unwrap_or_default(),
            target,
            first_value,
        });
    };
    push(&mut out, parsed.columns.name, ColumnTarget::Name, first.map(|r| r.raw_name.clone()));
    if let Some(i) = parsed.columns.pack_size {
        push(
            &mut out,
            i,
            ColumnTarget::PackSize,
            first.and_then(|r| r.pack_size.map(|n| n.to_string())),
        );
    }
    push(
        &mut out,
        parsed.columns.stock,
        ColumnTarget::Stock,
        first.and_then(|r| r.quantity.map(|n| n.to_string())),
    );
    if let Some(i) = parsed.columns.koli {
        push(
            &mut out,
            i,
            ColumnTarget::KoliCheck,
            first.and_then(|r| r.koli.map(|n| format!("{n:.2}"))),
        );
    }
    if let Some(i) = parsed.columns.price {
        push(
            &mut out,
            i,
            ColumnTarget::Price,
            first.and_then(|r| r.price.map(|n| n.to_string())),
        );
    } else {
        out.push(ImportColumnMap {
            source: "HARGA".into(),
            target: ColumnTarget::Price,
            first_value: None,
        });
    }
    if let Some(i) = parsed.columns.external_code {
        push(
            &mut out,
            i,
            ColumnTarget::ExternalCode,
            first.and_then(|r| r.external_code.clone()),
        );
    }
    out
}

fn counts(rows: &[ImportRowDto]) -> ImportCounts {
    let mut c = ImportCounts {
        data_rows: rows.len() as i64,
        matched: 0,
        new: 0,
        ambiguous: 0,
        invalid: 0,
        pack_size_missing: 0,
    };
    for r in rows {
        match r.match_status {
            MatchStatus::Matched => c.matched += 1,
            MatchStatus::New => c.new += 1,
            MatchStatus::Ambiguous => c.ambiguous += 1,
            MatchStatus::Invalid => c.invalid += 1,
        }
        if r.issues.iter().any(|i| i.kind == "PACK_SIZE_MISSING") {
            c.pack_size_missing += 1;
        }
    }
    c
}

fn build_preview(
    rec: &repo::imports::ImportRecord,
    purpose: ImportPurpose,
    format: FileFormat,
    parsed: &importers::parse::ParsedReport,
    rows: &[ImportRowDto],
    extra_issues: Vec<ImportIssue>,
) -> StockReportPreview {
    let mut file_issues = parsed.issues.clone();
    file_issues.extend(extra_issues);
    if parsed.columns.external_code.is_none() {
        file_issues.push(ImportIssue::new(
            "NO_BARCODE_COLUMN",
            "No barcode column found. Link barcodes later in Barcode Setup.",
        ));
    }
    let c = counts(rows);
    let sample: Vec<_> = rows.iter().take(20).cloned().collect();
    let problem: Vec<_> = rows
        .iter()
        .filter(|r| matches!(r.match_status, MatchStatus::Ambiguous | MatchStatus::Invalid))
        .cloned()
        .collect();
    let can_apply = rec.report_as_of_date.is_some()
        && (c.matched + c.new) > 0
        && !file_issues.iter().any(|i| i.kind == "BASELINE_EXISTS");
    StockReportPreview {
        import_id: rec.id,
        purpose,
        file_name: rec.file_name.clone(),
        file_format: format,
        company_name: rec.company_name.clone(),
        report_name: rec.source_report_name.clone(),
        as_of_date: rec.report_as_of_date.clone(),
        printed_at: rec.report_printed_at.clone(),
        cutoff_at: rec.report_cutoff_at.clone(),
        stock_column: rec.source_location_name.clone().unwrap_or_default(),
        stock_column_candidates: parsed
            .columns
            .stock_candidates
            .iter()
            .map(|(_, h)| h.clone())
            .collect(),
        columns: column_maps(parsed, rows.first()),
        counts: c,
        file_issues,
        sample_rows: sample,
        problem_rows: problem,
        can_apply,
    }
}

fn parse_bytes(
    bytes: &[u8],
    location_name: Option<&str>,
    stock_override: Option<&str>,
    now: DateTime<Utc>,
) -> Result<(FileFormat, importers::parse::ParsedReport), AppError> {
    let (format, grid) = importers::grid_from_bytes(bytes)?;
    let parsed = importers::parse_report(format, &grid, location_name, stock_override, now)?;
    Ok((format, parsed))
}

pub fn preview_stock_report(
    conn: &mut Connection,
    path: &Path,
    operator_id: i64,
    purpose: ImportPurpose,
    data_dir: Option<&Path>,
    now: DateTime<Utc>,
) -> Result<StockReportPreview, AppError> {
    let employee = repo::employees::get(conn, operator_id)?.ok_or(AppError::NotFound("employee"))?;
    if !employee.is_active {
        return Err(AppError::OperatorInactive);
    }
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let company_id = settings.company_id.ok_or(AppError::SetupIncomplete)?;
    let location = repo::get_location(conn, location_id)?.ok_or(AppError::NotFound("location"))?;

    let bytes = importers::read_path(path)?;
    let sha = importers::sha256_hex(&bytes);
    let stored = store_copy(data_dir, &sha, &bytes, path)?;
    let (format, parsed) = parse_bytes(&bytes, Some(&location.name), None, now)?;

    let mut extra = Vec::new();
    if purpose == ImportPurpose::Baseline && repo::inventory::has_balances(conn, location_id)? {
        extra.push(ImportIssue::new(
            "BASELINE_EXISTS",
            "Stock is already imported for this warehouse. Use Reconcile for a new report.",
        ));
    }
    if let (Some(as_of), Ok(Some(prev))) = (
        parsed.as_of_date.map(|d| d.to_string()),
        repo::imports::latest_applied_as_of(conn, location_id),
    ) {
        if as_of < prev {
            extra.push(ImportIssue::new(
                "OLDER_THAN_LAST_IMPORT",
                "This report is older than the last imported snapshot.",
            ));
        }
    }

    let rows: Vec<_> = parsed.rows.iter().map(|r| to_dto(conn, company_id, r)).collect();
    let as_of = parsed.as_of_date.map(|d| d.to_string());
    let printed = parsed.printed_at.map(|p| time::utc_iso(importers::dates::wib_datetime_utc(p)));
    let cutoff = parsed
        .as_of_date
        .map(|d| time::utc_iso(importers::dates::wib_end_of_day_utc(d)));
    let notes = serde_json::to_string(&ImportNotes {
        stored_path: Some(stored.to_string_lossy().into_owned()),
        source_path: Some(path.to_string_lossy().into_owned()),
    })
    .unwrap_or_else(|_| "{}".into());
    let now_iso = time::utc_iso(now);
    let mut warnings = parsed.issues.clone();
    warnings.extend(extra.clone());

    crate::db::write(conn, |tx| {
        let id = repo::imports::insert_preview(
            tx,
            purpose,
            &file_name_of(path),
            &sha,
            format,
            parsed.report_name.as_deref(),
            parsed.company_name.as_deref(),
            &parsed.columns.stock_header,
            location_id,
            as_of.as_deref(),
            cutoff.as_deref(),
            printed.as_deref(),
            rows.len() as i64,
            &warnings,
            operator_id,
            &now_iso,
            &notes,
        )?;
        repo::imports::replace_rows(tx, id, &rows)?;
        let rec = repo::imports::get(tx, id)?.ok_or(AppError::NotFound("import"))?;
        Ok(build_preview(&rec, purpose, format, &parsed, &rows, extra))
    })
}

pub fn set_report_options(
    conn: &mut Connection,
    import_id: i64,
    stock_column: Option<String>,
    cutoff_at: Option<String>,
    as_of_date: Option<String>,
    now: DateTime<Utc>,
) -> Result<StockReportPreview, AppError> {
    let rec = repo::imports::get(conn, import_id)?.ok_or(AppError::NotFound("import"))?;
    if rec.status != "PREVIEWED" {
        return Err(AppError::PreviewStale);
    }
    let notes: ImportNotes = rec
        .notes
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();
    let path = notes
        .stored_path
        .or(notes.source_path)
        .ok_or(AppError::PreviewStale)?;
    let settings = repo::load_settings(conn)?;
    let location_id = rec.location_id.or(settings.active_location_id).ok_or(AppError::SetupIncomplete)?;
    let company_id = settings.company_id.ok_or(AppError::SetupIncomplete)?;
    let location = repo::get_location(conn, location_id)?.ok_or(AppError::NotFound("location"))?;
    let bytes = importers::read_path(Path::new(&path))?;
    let override_col = stock_column.as_deref().or(rec.source_location_name.as_deref());
    let (format, mut parsed) = parse_bytes(&bytes, Some(&location.name), override_col, now)?;
    if let Some(as_of) = &as_of_date {
        parsed.as_of_date = chrono::NaiveDate::parse_from_str(as_of, "%Y-%m-%d").ok();
    }
    let rows: Vec<_> = parsed.rows.iter().map(|r| to_dto(conn, company_id, r)).collect();
    let as_of = as_of_date
        .or_else(|| parsed.as_of_date.map(|d| d.to_string()))
        .or(rec.report_as_of_date.clone());
    let cutoff = cutoff_at.or_else(|| {
        parsed
            .as_of_date
            .map(|d| time::utc_iso(importers::dates::wib_end_of_day_utc(d)))
    });
    let printed = parsed
        .printed_at
        .map(|p| time::utc_iso(importers::dates::wib_datetime_utc(p)))
        .or(rec.report_printed_at.clone());
    let purpose = if rec.import_type == "RECONCILE" {
        ImportPurpose::Reconcile
    } else {
        ImportPurpose::Baseline
    };
    let extra = if purpose == ImportPurpose::Baseline && repo::inventory::has_balances(conn, location_id)? {
        vec![ImportIssue::new(
            "BASELINE_EXISTS",
            "Stock is already imported for this warehouse. Use Reconcile for a new report.",
        )]
    } else {
        vec![]
    };
    let mut warnings = parsed.issues.clone();
    warnings.extend(extra.clone());
    crate::db::write(conn, |tx| {
        repo::imports::replace_rows(tx, import_id, &rows)?;
        repo::imports::update_preview_meta(
            tx,
            import_id,
            &parsed.columns.stock_header,
            as_of.as_deref(),
            cutoff.as_deref(),
            printed.as_deref(),
            rows.len() as i64,
            &warnings,
            rec.notes.as_deref().unwrap_or("{}"),
        )?;
        let rec = repo::imports::get(tx, import_id)?.ok_or(AppError::NotFound("import"))?;
        Ok(build_preview(&rec, purpose, format, &parsed, &rows, extra))
    })
}

pub fn apply_baseline(
    conn: &mut Connection,
    import_id: i64,
    operator_id: i64,
    now: DateTime<Utc>,
) -> Result<BaselineApplyResult, AppError> {
    let employee = repo::employees::get(conn, operator_id)?.ok_or(AppError::NotFound("employee"))?;
    if !employee.is_active {
        return Err(AppError::OperatorInactive);
    }
    let rec = repo::imports::get(conn, import_id)?.ok_or(AppError::NotFound("import"))?;
    let location_id = rec.location_id.ok_or(AppError::SetupIncomplete)?;
    if repo::inventory::has_balances(conn, location_id)? {
        return Err(AppError::BaselineExists);
    }
    if rec.status != "PREVIEWED" || rec.import_type != "BASELINE" {
        return Err(AppError::PreviewStale);
    }
    if rec.report_as_of_date.is_none() {
        return Err(AppError::import(
            "AS_OF_MISSING",
            "Report date is required before importing.",
        ));
    }
    let settings = repo::load_settings(conn)?;
    let company_id = settings.company_id.ok_or(AppError::SetupIncomplete)?;
    let rows = repo::imports::list_rows(conn, import_id)?;
    let now_iso = time::utc_iso(now);
    log::info!("pre-op backup skipped until M7 (before-baseline import {import_id})");

    crate::db::write(conn, |tx| {
        let mut products = 0i64;
        let mut balances = 0i64;
        for row in &rows {
            if !matches!(row.match_status, MatchStatus::Matched | MatchStatus::New) {
                continue;
            }
            let Some(qty) = row.quantity else { continue };
            let product_id = if row.match_status == MatchStatus::New {
                products += 1;
                repo::products::insert_product(
                    tx,
                    company_id,
                    row.external_code.as_deref(),
                    &row.raw_name,
                    &row.name_key,
                    names::model_code(&row.name_key).as_deref(),
                    row.pack_size,
                    row.price,
                    import_id,
                    &now_iso,
                )?
            } else {
                let id = row
                    .product_id
                    .or(repo::products::find_by_name_key(tx, company_id, &row.name_key)?)
                    .ok_or(AppError::NotFound("product"))?;
                repo::products::update_from_report(tx, id, row.pack_size, row.price, &now_iso)?;
                products += 1;
                id
            };
            repo::inventory::insert_balance(tx, location_id, product_id, qty, import_id, &now_iso)?;
            balances += 1;
            if row.pack_size.is_none() {
                repo::exceptions::upsert_open(
                    tx,
                    "PACK_SIZE_MISSING",
                    "WARNING",
                    &format!("PACK_SIZE_MISSING:{product_id}"),
                    Some(product_id),
                    Some(import_id),
                    "{}",
                    &now_iso,
                )?;
            }
        }
        let warnings: Vec<ImportIssue> =
            serde_json::from_str(&rec.warnings_json).unwrap_or_default();
        if warnings.iter().any(|i| {
            matches!(
                i.kind.as_str(),
                "DATE_IN_FUTURE" | "AS_OF_AFTER_PRINTED" | "OLDER_THAN_LAST_IMPORT"
            )
        }) {
            repo::exceptions::upsert_open(
                tx,
                "IMPORT_DATE_WARNING",
                "WARNING",
                &format!("IMPORT_DATE:{import_id}"),
                None,
                Some(import_id),
                &rec.warnings_json,
                &now_iso,
            )?;
        }
        repo::imports::mark_applied(tx, import_id, &now_iso)?;
        Ok(BaselineApplyResult { products, balances })
    })
}

pub fn cancel_import(conn: &Connection, import_id: i64) -> Result<(), AppError> {
    repo::imports::mark_cancelled(conn, import_id)
}

pub fn write_sample_xlsx(dir: &Path, n: usize) -> Result<PathBuf, AppError> {
    std::fs::create_dir_all(dir)?;
    let path = dir.join(format!("accurate_stock_{n}.xlsx"));
    importers::synthetic::write_xlsx_catalog(&path, n)
        .map_err(|e| AppError::internal(e.to_string()))?;
    Ok(path)
}
