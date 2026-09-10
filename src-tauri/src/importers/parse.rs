use chrono::{DateTime, NaiveDate, Utc};
use std::collections::HashMap;

use crate::dto::FileFormat;
use crate::error::{AppError, ImportIssue};

use super::dates;
use super::grid::{detect_format, decode_text, Cell, Grid};
use super::names;
use super::numbers;

#[derive(Debug, Clone)]
pub struct ColumnMap {
    pub name: usize,
    pub pack_size: Option<usize>,
    pub stock: usize,
    pub koli: Option<usize>,
    pub price: Option<usize>,
    pub external_code: Option<usize>,
    pub stock_header: String,
    pub stock_candidates: Vec<(usize, String)>,
    pub headers: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedRow {
    pub row_number: usize,
    pub raw_name: String,
    pub name_key: String,
    pub pack_size: Option<i64>,
    pub quantity: Option<i64>,
    pub koli: Option<f64>,
    pub price: Option<i64>,
    pub external_code: Option<String>,
    pub issues: Vec<ImportIssue>,
    pub skipped: bool,
}

#[derive(Debug, Clone)]
pub struct ParsedReport {
    pub format: FileFormat,
    pub company_name: Option<String>,
    pub report_name: Option<String>,
    pub as_of_date: Option<NaiveDate>,
    pub printed_at: Option<chrono::NaiveDateTime>,
    pub header_row: usize,
    pub columns: ColumnMap,
    pub rows: Vec<ParsedRow>,
    pub issues: Vec<ImportIssue>,
}

pub fn grid_from_bytes(bytes: &[u8]) -> Result<(FileFormat, Grid), AppError> {
    let format = detect_format(bytes)?;
    let grid = match format {
        FileFormat::Xls | FileFormat::Xlsx => super::xls::parse_ole_or_xlsx(bytes)?,
        FileFormat::Html => super::html::parse_html(&decode_text(bytes)),
        FileFormat::Spreadsheetml => super::spreadsheetml::parse_spreadsheetml(&decode_text(bytes)),
        FileFormat::Csv => {
            return Err(AppError::import(
                "UNSUPPORTED_FORMAT",
                "CSV stock reports are not used for ACCURATE imports.",
            ))
        }
    };
    Ok((format, grid))
}

pub fn parse_report(
    format: FileFormat,
    grid: &Grid,
    location_name: Option<&str>,
    stock_column_override: Option<&str>,
    now: DateTime<Utc>,
) -> Result<ParsedReport, AppError> {
    let (header_row, columns) = find_columns(grid, location_name, stock_column_override)?;
    let meta_text = collect_text(grid);
    let company_name = find_company(grid, header_row);
    let report_name = meta_text.iter().find(|t| {
        names::normalize_header(t).contains("KUANTITAS BARANG")
    }).cloned();
    let as_of_date = meta_text.iter().find_map(|t| dates::find_as_of(t));
    let printed_at = meta_text.iter().find_map(|t| dates::find_printed_at(t));

    let mut issues = Vec::new();
    if as_of_date.is_none() {
        issues.push(ImportIssue::new(
            "AS_OF_MISSING",
            "Report date (Per Tgl.) was not found. Fill it before importing.",
        ));
    }
    if let Some(as_of) = as_of_date {
        let today = dates::today_wib(now);
        if as_of > today {
            issues.push(ImportIssue::new(
                "DATE_IN_FUTURE",
                "Report date is later than today. Please confirm the report period.",
            ));
        }
        if let Some(printed) = printed_at {
            if as_of > printed.date() {
                issues.push(ImportIssue::new(
                    "AS_OF_AFTER_PRINTED",
                    "Report date is later than the printed time. Please confirm the report period.",
                ));
            }
        }
    }

    let mut rows = Vec::new();
    let mut total_from_file: Option<i64> = None;
    for r in (header_row + 1)..grid.rows.len() {
        let name_cell = grid.cell(r, columns.name);
        let name_raw = name_cell.as_display();
        let name_norm = names::normalize_header(&name_raw);
        if name_cell.is_empty() && grid.row_is_empty(r) {
            continue;
        }
        if name_norm == "DESKRIPSI BARANG" || name_norm == "NAMA BARANG" {
            continue;
        }
        if name_norm.starts_with("TOTAL")
            || name_norm.starts_with("JUMLAH")
            || name_norm.starts_with("SUBTOTAL")
        {
            if let Ok(Some(q)) = numbers::int_from_cell(grid.cell(r, columns.stock)) {
                total_from_file = Some(total_from_file.unwrap_or(0) + q);
            }
            continue;
        }
        let isi_empty = columns
            .pack_size
            .map(|c| grid.cell(r, c).is_empty())
            .unwrap_or(true);
        let stock_empty = grid.cell(r, columns.stock).is_empty();
        if !name_cell.is_empty() && isi_empty && stock_empty {
            continue;
        }
        if name_cell.is_empty() {
            continue;
        }

        let mut row_issues = Vec::new();
        let raw_name = name_raw.split_whitespace().collect::<Vec<_>>().join(" ");
        let name_key = names::name_key(&raw_name);
        let pack_size = match columns.pack_size {
            Some(c) => match numbers::int_from_cell(grid.cell(r, c)) {
                Ok(Some(n)) if n > 0 => Some(n),
                Ok(Some(_)) | Ok(None) => {
                    row_issues.push(ImportIssue::kind_only("PACK_SIZE_MISSING"));
                    None
                }
                Err(()) => {
                    row_issues.push(ImportIssue::kind_only("PACK_SIZE_MISSING"));
                    None
                }
            },
            None => {
                row_issues.push(ImportIssue::kind_only("PACK_SIZE_MISSING"));
                None
            }
        };
        let quantity = match numbers::int_from_cell(grid.cell(r, columns.stock)) {
            Ok(Some(q)) => {
                if q < 0 {
                    row_issues.push(ImportIssue::kind_only("NEGATIVE_STOCK"));
                }
                Some(q)
            }
            Ok(None) | Err(()) => {
                row_issues.push(ImportIssue::new(
                    "INVALID",
                    "Stock quantity is missing or not a whole number.",
                ));
                None
            }
        };
        let koli = columns
            .koli
            .and_then(|c| numbers::float_from_cell(grid.cell(r, c)).ok().flatten());
        if let (Some(q), Some(isi), Some(k)) = (quantity, pack_size, koli) {
            let expected = q as f64 / isi as f64;
            if (expected - k).abs() > 0.01 {
                row_issues.push(ImportIssue::new(
                    "KOLI_MISMATCH",
                    "KOLI does not match stock ÷ ISI.",
                ));
            }
        }
        let price = columns
            .price
            .and_then(|c| numbers::int_from_cell(grid.cell(r, c)).ok().flatten());
        let external_code = columns.external_code.and_then(|c| {
            let t = grid.cell(r, c).as_display();
            let t = t.trim();
            if t.is_empty() {
                None
            } else {
                Some(t.to_string())
            }
        });

        let invalid = quantity.is_none();
        rows.push(ParsedRow {
            row_number: r + 1,
            raw_name,
            name_key,
            pack_size,
            quantity,
            koli,
            price,
            external_code,
            issues: row_issues,
            skipped: invalid,
        });
    }

    let mut counts: HashMap<String, usize> = HashMap::new();
    for row in &rows {
        if row.quantity.is_some() {
            *counts.entry(row.name_key.clone()).or_insert(0) += 1;
        }
    }
    for row in &mut rows {
        if row.quantity.is_some() && counts.get(&row.name_key).copied().unwrap_or(0) > 1 {
            row.issues.push(ImportIssue::kind_only("AMBIGUOUS"));
            row.skipped = true;
        }
    }

    if rows
        .iter()
        .any(|r| r.issues.iter().any(|i| i.kind == "KOLI_MISMATCH"))
    {
        issues.push(ImportIssue::new(
            "KOLI_MISMATCH",
            "KOLI does not match stock ÷ ISI on some rows.",
        ));
    }

    let sum: i64 = rows.iter().filter_map(|r| r.quantity).sum();
    if let Some(total) = total_from_file {
        if total != sum {
            issues.push(ImportIssue::new(
                "TOTAL_MISMATCH",
                format!("File total {total} does not match parsed stock {sum}."),
            ));
        }
    }

    if !rows.iter().any(|r| r.quantity.is_some() && !r.skipped) {
        issues.push(ImportIssue::kind_only("NO_DATA_ROWS"));
    }

    Ok(ParsedReport {
        format,
        company_name,
        report_name,
        as_of_date,
        printed_at,
        header_row,
        columns,
        rows,
        issues,
    })
}

fn collect_text(grid: &Grid) -> Vec<String> {
    grid.rows
        .iter()
        .flatten()
        .filter_map(|c| match c {
            Cell::Text(s) if !s.trim().is_empty() => Some(s.clone()),
            _ => {
                let d = c.as_display();
                if d.is_empty() {
                    None
                } else {
                    Some(d)
                }
            }
        })
        .collect()
}

fn find_company(grid: &Grid, header_row: usize) -> Option<String> {
    for row in &grid.rows[..header_row.min(grid.rows.len())] {
        for cell in row {
            let t = cell.as_display();
            let u = t.to_uppercase();
            if u.contains("PT") || u.contains("CV") {
                return Some(t.split_whitespace().collect::<Vec<_>>().join(" "));
            }
        }
    }
    None
}

fn find_columns(
    grid: &Grid,
    location_name: Option<&str>,
    stock_column_override: Option<&str>,
) -> Result<(usize, ColumnMap), AppError> {
    let limit = grid.rows.len().min(40);
    for r in 0..limit {
        let headers: Vec<String> = grid
            .rows
            .get(r)
            .map(|row| row.iter().map(|c| names::normalize_header(&c.as_display())).collect())
            .unwrap_or_default();
        let has_name = headers.iter().any(|h| h == "DESKRIPSI BARANG" || h == "NAMA BARANG");
        let has_isi = headers.iter().any(|h| h == "ISI");
        if !has_name || !has_isi {
            continue;
        }
        let name = headers
            .iter()
            .position(|h| h == "DESKRIPSI BARANG" || h == "NAMA BARANG")
            .unwrap();
        let pack_size = headers.iter().position(|h| h == "ISI");
        let koli = headers.iter().position(|h| h == "KOLI");
        let price = headers
            .iter()
            .position(|h| h == "HARGA" || h == "HARGA JUAL");
        let external_code = headers.iter().position(|h| {
            h == "NO. BARANG" || h == "NO BARANG" || h == "KODE BARANG"
        });
        let reserved = |h: &str| {
            h.is_empty()
                || h == "DESKRIPSI BARANG"
                || h == "NAMA BARANG"
                || h == "ISI"
                || h == "KOLI"
                || h == "HARGA"
                || h == "HARGA JUAL"
                || h == "NO. BARANG"
                || h == "NO BARANG"
                || h == "KODE BARANG"
                || h == "NO"
                || h == "NO."
        };
        let mut stock_candidates = Vec::new();
        for (i, h) in headers.iter().enumerate() {
            if reserved(h) {
                continue;
            }
            if numeric_ratio(grid, r + 1, i) >= 0.8 {
                stock_candidates.push((i, h.clone()));
            }
        }
        if stock_candidates.is_empty() {
            return Err(AppError::import(
                "NO_STOCK_COLUMN",
                "Could not find a warehouse stock column.",
            ));
        }
        let loc_key = location_name.map(names::normalize_header);
        let chosen = if let Some(over) = stock_column_override {
            let key = names::normalize_header(over);
            stock_candidates
                .iter()
                .find(|(_, h)| h == &key)
                .cloned()
                .or_else(|| {
                    stock_candidates
                        .iter()
                        .find(|(_, h)| h.contains(&key) || key.contains(h.as_str()))
                        .cloned()
                })
        } else if stock_candidates.len() == 1 {
            Some(stock_candidates[0].clone())
        } else if let Some(loc) = loc_key {
            stock_candidates
                .iter()
                .find(|(_, h)| h == &loc)
                .cloned()
                .or_else(|| Some(stock_candidates[0].clone()))
        } else {
            Some(stock_candidates[0].clone())
        };
        let Some((stock, stock_header)) = chosen else {
            return Err(AppError::import(
                "NO_STOCK_COLUMN",
                "Could not find a warehouse stock column.",
            ));
        };
        return Ok((
            r,
            ColumnMap {
                name,
                pack_size,
                stock,
                koli,
                price,
                external_code,
                stock_header,
                stock_candidates,
                headers,
            },
        ));
    }
    Err(AppError::import(
        "HEADER_NOT_FOUND",
        "Could not find a header row with DESKRIPSI BARANG and ISI.",
    ))
}

fn numeric_ratio(grid: &Grid, start: usize, col: usize) -> f64 {
    let mut seen = 0;
    let mut numeric = 0;
    for r in start..grid.rows.len() {
        if grid.row_is_empty(r) {
            continue;
        }
        let name = names::normalize_header(&grid.cell(r, 0).as_display());
        if name == "DESKRIPSI BARANG" || name.starts_with("TOTAL") {
            continue;
        }
        let cell = grid.cell(r, col);
        if cell.is_empty() {
            continue;
        }
        seen += 1;
        if cell.looks_numeric() {
            numeric += 1;
        }
        if seen >= 20 {
            break;
        }
    }
    if seen == 0 {
        0.0
    } else {
        numeric as f64 / seen as f64
    }
}
