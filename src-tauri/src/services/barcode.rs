use chrono::{DateTime, Utc};
use rusqlite::{Connection, OptionalExtension};
use std::collections::HashMap;
use std::path::Path;

use crate::dto::{
    BarcodeCoverage, BarcodeImportApplyResult, BarcodeImportLine, BarcodeImportPreview, BarcodeKind,
    CheckBarcodeResult, ExportResult, IdentifierDto, IdentifierType, LinkBarcodeInput, ProductCard,
    RecentLink, ResolveResult, UsedByProduct,
};
use crate::error::AppError;
use crate::importers;
use crate::importers::names;
use crate::repo;
use crate::time;

pub fn normalize_code(raw: &str) -> Result<String, AppError> {
    let code = raw.trim().replace(['\r', '\n'], "");
    if code.is_empty() || code.len() > 64 {
        return Err(AppError::invalid("BARCODE_INVALID"));
    }
    Ok(code)
}

fn gtin_check_ok(digits: &str) -> bool {
    if !digits.bytes().all(|b| b.is_ascii_digit()) {
        return false;
    }
    let n = digits.len();
    if !matches!(n, 8 | 12 | 13 | 14) {
        return false;
    }
    let body = &digits[..n - 1];
    let check = digits.as_bytes()[n - 1] - b'0';
    let mut s = 0u32;
    for (i, c) in body.chars().rev().enumerate() {
        let d = c.to_digit(10).unwrap();
        s += if i % 2 == 0 { d * 3 } else { d };
    }
    ((10 - (s % 10)) % 10) as u8 == check
}

pub fn detect_type(code: &str) -> (IdentifierType, Option<bool>) {
    if code.bytes().all(|b| b.is_ascii_digit()) {
        let valid = gtin_check_ok(code);
        let ty = match (code.len(), valid) {
            (13, true) => IdentifierType::Ean13,
            (8, true) => IdentifierType::Ean8,
            (12, true) => IdentifierType::Upca,
            (14, true) => IdentifierType::Gtin14,
            _ => IdentifierType::Other,
        };
        return (ty, Some(valid));
    }
    if code.bytes().any(|b| b.is_ascii_alphabetic()) {
        (IdentifierType::Code128, None)
    } else {
        (IdentifierType::Other, None)
    }
}

fn build_card(conn: &Connection, product_id: i64) -> Result<ProductCard, AppError> {
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let p = repo::products::get(conn, product_id)?.ok_or(AppError::NotFound("product"))?;
    let (current, baseline, as_of) = repo::inventory::get_balance(conn, location_id, product_id)?
        .ok_or(AppError::NotFound("balance"))?;
    Ok(ProductCard {
        product_id: p.id,
        name: p.name,
        model_code: p.model_code,
        pack_size: p.pack_size,
        reference_price: p.reference_price,
        location_id,
        baseline_quantity: baseline,
        current_quantity: current,
        baseline_as_of: as_of,
    })
}

pub fn resolve(conn: &mut Connection, raw: &str, now: DateTime<Utc>) -> Result<ResolveResult, AppError> {
    let code = normalize_code(raw)?;
    let now_iso = time::utc_iso(now);
    crate::db::write(conn, |tx| {
        match repo::identifiers::find_active_by_code(tx, &code)? {
            None => {
                repo::exceptions::upsert_unknown_barcode(tx, &code, &now_iso)?;
                Ok(ResolveResult::Unknown { code: code.clone() })
            }
            Some(idf) => {
                let p = repo::products::get(tx, idf.product_id)?.ok_or(AppError::NotFound("product"))?;
                if !p.is_active {
                    Ok(ResolveResult::ProductInactive {
                        code: code.clone(),
                        product_name: p.name,
                    })
                } else {
                    Ok(ResolveResult::Found {
                        card: build_card(tx, p.id)?,
                        identifier: idf.to_dto(),
                    })
                }
            }
        }
    })
}

pub fn check(conn: &Connection, raw: &str) -> Result<CheckBarcodeResult, AppError> {
    let code = normalize_code(raw)?;
    let (detected_type, check_digit_valid) = detect_type(&code);
    match repo::identifiers::find_active_by_code(conn, &code)? {
        None => Ok(CheckBarcodeResult {
            available: true,
            detected_type,
            check_digit_valid,
            used_by: None,
        }),
        Some(idf) => {
            let p = repo::products::get(conn, idf.product_id)?.ok_or(AppError::NotFound("product"))?;
            Ok(CheckBarcodeResult {
                available: false,
                detected_type,
                check_digit_valid,
                used_by: Some(UsedByProduct {
                    product_id: p.id,
                    name: p.name,
                }),
            })
        }
    }
}

pub fn link(conn: &mut Connection, input: &LinkBarcodeInput, now: DateTime<Utc>) -> Result<IdentifierDto, AppError> {
    let code = normalize_code(&input.code)?;
    let employee = repo::employees::get(conn, input.operator_id)?.ok_or(AppError::NotFound("employee"))?;
    if !employee.is_active {
        return Err(AppError::OperatorInactive);
    }
    let product = repo::products::get(conn, input.product_id)?.ok_or(AppError::NotFound("product"))?;
    let (ty, _) = detect_type(&code);
    let multiplier = match input.kind {
        BarcodeKind::Unit => 1,
        BarcodeKind::Carton => input
            .unit_multiplier
            .or(product.pack_size)
            .filter(|n| *n >= 1)
            .ok_or(AppError::PackSizeMissing {
                product_id: product.id,
            })?,
    };
    let now_iso = time::utc_iso(now);
    crate::db::write(conn, |tx| {
        if let Some(existing) = repo::identifiers::find_active_by_code(tx, &code)? {
            if existing.product_id == product.id {
                return Ok(existing.to_dto());
            }
            let other = repo::products::get(tx, existing.product_id)?.ok_or(AppError::NotFound("product"))?;
            return Err(AppError::BarcodeInUse {
                product_id: other.id,
                product_name: other.name,
            });
        }
        let id = repo::identifiers::insert(
            tx,
            product.id,
            &code,
            ty,
            multiplier,
            input.operator_id,
            &now_iso,
        )?;
        repo::identifiers::record_pairing(tx, id, product.id, "LINKED", input.operator_id, None, &now_iso, None)?;
        repo::exceptions::resolve_open_dedup(
            tx,
            &format!("UNKNOWN_BARCODE:{code}"),
            input.operator_id,
            "linked",
            &now_iso,
        )?;
        Ok(IdentifierDto {
            id,
            code,
            identifier_type: ty,
            unit_multiplier: multiplier,
        })
    })
}

pub fn deactivate(
    conn: &mut Connection,
    identifier_id: i64,
    operator_id: i64,
    note: String,
    now: DateTime<Utc>,
) -> Result<(), AppError> {
    let employee = repo::employees::get(conn, operator_id)?.ok_or(AppError::NotFound("employee"))?;
    if employee.role != crate::dto::Role::Admin {
        return Err(AppError::invalid("ADMIN_ONLY"));
    }
    let now_iso = time::utc_iso(now);
    crate::db::write(conn, |tx| {
        let rec = repo::identifiers::get(tx, identifier_id)?.ok_or(AppError::NotFound("identifier"))?;
        repo::identifiers::deactivate(tx, identifier_id, operator_id, &now_iso)?;
        repo::identifiers::record_pairing(
            tx,
            identifier_id,
            rec.product_id,
            "DEACTIVATED",
            operator_id,
            None,
            &now_iso,
            Some(&note),
        )
    })
}

pub fn coverage(conn: &Connection) -> Result<BarcodeCoverage, AppError> {
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let products: i64 = conn.query_row(
        "SELECT COUNT(*) FROM inventory_balances WHERE location_id = ?1",
        [location_id],
        |r| r.get(0),
    )?;
    let linked: i64 = conn.query_row(
        "
        SELECT COUNT(DISTINCT b.product_id)
          FROM inventory_balances b
          JOIN identifiers i ON i.product_id = b.product_id AND i.is_active = 1
         WHERE b.location_id = ?1
        ",
        [location_id],
        |r| r.get(0),
    )?;
    Ok(BarcodeCoverage {
        products,
        linked,
        unlinked: (products - linked).max(0),
    })
}

pub fn next_unlinked(conn: &Connection, after_product_id: Option<i64>) -> Result<Option<ProductCard>, AppError> {
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let after = after_product_id.unwrap_or(0);
    let sql = "
            SELECT b.product_id
              FROM inventory_balances b
              JOIN products p ON p.id = b.product_id
             WHERE b.location_id = ?1
               AND p.is_active = 1
               AND NOT EXISTS (
                    SELECT 1 FROM identifiers i WHERE i.product_id = p.id AND i.is_active = 1
               )
               AND (
                    ?2 = 0
                    OR p.name COLLATE NOCASE > (SELECT name FROM products WHERE id = ?2)
                    OR (
                        p.name COLLATE NOCASE = (SELECT name FROM products WHERE id = ?2)
                        AND p.id > ?2
                    )
               )
             ORDER BY p.name COLLATE NOCASE, p.id
             LIMIT 1
            ";
    let id: Option<i64> = conn
        .query_row(sql, rusqlite::params![location_id, after], |r| r.get(0))
        .optional()?;
    if let Some(pid) = id {
        return Ok(Some(build_card(conn, pid)?));
    }
    if after == 0 {
        return Ok(None);
    }
    let wrap: Option<i64> = conn
        .query_row(
            "
            SELECT b.product_id
              FROM inventory_balances b
              JOIN products p ON p.id = b.product_id
             WHERE b.location_id = ?1
               AND p.is_active = 1
               AND p.id <> ?2
               AND NOT EXISTS (
                    SELECT 1 FROM identifiers i WHERE i.product_id = p.id AND i.is_active = 1
               )
             ORDER BY p.name COLLATE NOCASE, p.id
             LIMIT 1
            ",
            rusqlite::params![location_id, after],
            |r| r.get(0),
        )
        .optional()?;
    match wrap {
        Some(pid) => Ok(Some(build_card(conn, pid)?)),
        None => Ok(None),
    }
}

pub fn product_card(conn: &Connection, product_id: i64) -> Result<ProductCard, AppError> {
    build_card(conn, product_id)
}

pub fn recent_links(conn: &Connection, limit: i64) -> Result<Vec<RecentLink>, AppError> {
    let limit = limit.clamp(1, 50);
    let mut stmt = conn.prepare(
        "
        SELECT e.identifier_id, i.code, e.product_id, p.name, e.action, e.created_at
          FROM barcode_pairing_events e
          JOIN identifiers i ON i.id = e.identifier_id
          JOIN products p ON p.id = e.product_id
         ORDER BY e.id DESC
         LIMIT ?1
        ",
    )?;
    let mapped = stmt.query_map([limit], |r| {
        Ok(RecentLink {
            identifier_id: r.get(0)?,
            code: r.get(1)?,
            product_id: r.get(2)?,
            product_name: r.get(3)?,
            action: r.get(4)?,
            created_at: r.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for row in mapped {
        out.push(row?);
    }
    Ok(out)
}

pub fn export_template(conn: &Connection, path: &Path, only_unlinked: bool) -> Result<ExportResult, AppError> {
    let settings = repo::load_settings(conn)?;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let mut wb = rust_xlsxwriter::Workbook::new();
    let sheet = wb.add_worksheet();
    let text = rust_xlsxwriter::Format::new().set_num_format("@");
    let headers = [
        "product_id",
        "No. Barang",
        "Deskripsi Barang",
        "ISI",
        "barcode_unit",
        "barcode_carton",
    ];
    for (i, h) in headers.iter().enumerate() {
        sheet
            .write_string(0, i as u16, *h)
            .map_err(|e| AppError::internal(e.to_string()))?;
    }
    let sql = if only_unlinked {
        "
        SELECT p.id, p.external_code, p.name, p.pack_size
          FROM inventory_balances b
          JOIN products p ON p.id = b.product_id
         WHERE b.location_id = ?1
           AND NOT EXISTS (SELECT 1 FROM identifiers i WHERE i.product_id = p.id AND i.is_active = 1)
         ORDER BY p.name COLLATE NOCASE
        "
    } else {
        "
        SELECT p.id, p.external_code, p.name, p.pack_size
          FROM inventory_balances b
          JOIN products p ON p.id = b.product_id
         WHERE b.location_id = ?1
         ORDER BY p.name COLLATE NOCASE
        "
    };
    let mut stmt = conn.prepare(sql)?;
    let mapped = stmt.query_map([location_id], |r| {
        Ok((
            r.get::<_, i64>(0)?,
            r.get::<_, Option<String>>(1)?,
            r.get::<_, String>(2)?,
            r.get::<_, Option<i64>>(3)?,
        ))
    })?;
    let mut row_n = 1u32;
    for item in mapped {
        let (id, ext, name, pack) = item?;
        sheet
            .write_number(row_n, 0, id as f64)
            .map_err(|e| AppError::internal(e.to_string()))?;
        if let Some(e) = ext {
            sheet
                .write_string(row_n, 1, &e)
                .map_err(|e| AppError::internal(e.to_string()))?;
        }
        sheet
            .write_string(row_n, 2, &name)
            .map_err(|e| AppError::internal(e.to_string()))?;
        if let Some(p) = pack {
            sheet
                .write_number(row_n, 3, p as f64)
                .map_err(|e| AppError::internal(e.to_string()))?;
        }
        sheet
            .write_with_format(row_n, 4, "", &text)
            .map_err(|e| AppError::internal(e.to_string()))?;
        sheet
            .write_with_format(row_n, 5, "", &text)
            .map_err(|e| AppError::internal(e.to_string()))?;
        row_n += 1;
    }
    sheet
        .set_column_hidden(0)
        .map_err(|e| AppError::internal(e.to_string()))?;
    wb.save(path).map_err(|e| AppError::internal(e.to_string()))?;
    Ok(ExportResult {
        row_count: (row_n.saturating_sub(1)) as i64,
        path: path.to_string_lossy().into_owned(),
    })
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct BarcodeImportNotes {
    stored_path: Option<String>,
    lines: Vec<BarcodeImportLine>,
}

fn cell_text(grid: &importers::grid::Grid, r: usize, c: usize) -> String {
    grid.cell(r, c).as_display().trim().to_string()
}

pub fn preview_import(
    conn: &mut Connection,
    path: &Path,
    operator_id: i64,
    now: DateTime<Utc>,
) -> Result<BarcodeImportPreview, AppError> {
    let employee = repo::employees::get(conn, operator_id)?.ok_or(AppError::NotFound("employee"))?;
    if !employee.is_active {
        return Err(AppError::OperatorInactive);
    }
    let settings = repo::load_settings(conn)?;
    let company_id = settings.company_id.ok_or(AppError::SetupIncomplete)?;
    let bytes = importers::read_path(path)?;
    let (format, grid) = importers::grid_from_bytes(&bytes)?;
    let mut header = None;
    for r in 0..grid.rows.len().min(20) {
        let joined: Vec<_> = grid.rows[r].iter().map(|c| names::normalize_header(&c.as_display())).collect();
        if joined.iter().any(|h| h.contains("PRODUCT_ID") || h == "PRODUCT ID")
            || joined.iter().any(|h| h.contains("DESKRIPSI"))
        {
            header = Some(r);
            break;
        }
    }
    let header = header.ok_or_else(|| AppError::import("HEADER_NOT_FOUND", "No barcode template header"))?;
    let headers: Vec<String> = grid.rows[header]
        .iter()
        .map(|c| names::normalize_header(&c.as_display()))
        .collect();
    let col = |name: &str| headers.iter().position(|h| h.contains(name));
    let id_col = col("PRODUCT_ID").or_else(|| col("PRODUCT ID")).unwrap_or(0);
    let name_col = col("DESKRIPSI").unwrap_or(2);
    let unit_col = col("BARCODE_UNIT").or_else(|| col("BARCODE UNIT")).unwrap_or(4);
    let carton_col = col("BARCODE_CARTON").or_else(|| col("BARCODE CARTON")).unwrap_or(5);

    let mut file_codes: HashMap<String, usize> = HashMap::new();
    let mut lines = Vec::new();
    for r in (header + 1)..grid.rows.len() {
        let unit = cell_text(&grid, r, unit_col);
        let carton = cell_text(&grid, r, carton_col);
        if unit.is_empty() && carton.is_empty() {
            continue;
        }
        let name = cell_text(&grid, r, name_col);
        let pid = importers::numbers::int_from_cell(grid.cell(r, id_col))
            .ok()
            .flatten();
        let product_id = if let Some(id) = pid {
            repo::products::get(conn, id)?.map(|p| p.id)
        } else if !name.is_empty() {
            repo::products::find_by_name_key(conn, company_id, &names::name_key(&name))?
        } else {
            None
        };
        let mut status = "LINK";
        let mut message = None;
        if product_id.is_none() {
            status = "CONFLICT";
            message = Some("Product not found".into());
        }
        for code in [&unit, &carton] {
            if code.is_empty() {
                continue;
            }
            *file_codes.entry(code.clone()).or_insert(0) += 1;
        }
        lines.push(BarcodeImportLine {
            product_id,
            product_name: name,
            unit_code: if unit.is_empty() { None } else { Some(unit) },
            carton_code: if carton.is_empty() { None } else { Some(carton) },
            status: status.into(),
            message,
        });
    }
    for line in &mut lines {
        if line.status == "CONFLICT" {
            continue;
        }
        let pid = line.product_id.unwrap();
        for code in line.unit_code.iter().chain(line.carton_code.iter()) {
            if file_codes.get(code).copied().unwrap_or(0) > 1 {
                line.status = "CONFLICT".into();
                line.message = Some("Same barcode appears twice in the file".into());
                break;
            }
            if let Some(existing) = repo::identifiers::find_active_by_code(conn, code)? {
                if existing.product_id == pid {
                    line.status = "SKIP".into();
                    line.message = Some("Already linked".into());
                } else {
                    line.status = "CONFLICT".into();
                    line.message = Some("Barcode already belongs to another product".into());
                    break;
                }
            }
        }
    }
    let linked = lines.iter().filter(|l| l.status == "LINK").count() as i64;
    let skipped = lines.iter().filter(|l| l.status == "SKIP").count() as i64;
    let conflicts = lines.iter().filter(|l| l.status == "CONFLICT").count() as i64;
    let location_id = settings.active_location_id.ok_or(AppError::SetupIncomplete)?;
    let now_iso = time::utc_iso(now);
    let notes = serde_json::to_string(&BarcodeImportNotes {
        stored_path: Some(path.to_string_lossy().into_owned()),
        lines: lines.clone(),
    })
    .unwrap_or_else(|_| "{}".into());
    let import_id = crate::db::write(conn, |tx| {
        let id = repo::imports::insert_preview(
            tx,
            crate::dto::ImportPurpose::Baseline,
            path.file_name().and_then(|s| s.to_str()).unwrap_or("barcodes.xlsx"),
            &importers::sha256_hex(&bytes),
            format,
            Some("BARCODE_MAP"),
            None,
            "",
            location_id,
            None,
            None,
            None,
            lines.len() as i64,
            &[],
            operator_id,
            &now_iso,
            &notes,
        )?;
        tx.execute(
            "UPDATE imports SET import_type = 'BARCODE_MAP' WHERE id = ?1",
            [id],
        )?;
        Ok(id)
    })?;
    Ok(BarcodeImportPreview {
        import_id,
        file_name: path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("barcodes.xlsx")
            .into(),
        lines,
        linked,
        skipped,
        conflicts,
        can_apply: linked > 0,
    })
}

pub fn apply_import(
    conn: &mut Connection,
    import_id: i64,
    operator_id: i64,
    now: DateTime<Utc>,
) -> Result<BarcodeImportApplyResult, AppError> {
    let rec = repo::imports::get(conn, import_id)?.ok_or(AppError::NotFound("import"))?;
    if rec.status != "PREVIEWED" {
        return Err(AppError::PreviewStale);
    }
    let notes: BarcodeImportNotes = rec
        .notes
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();
    let now_iso = time::utc_iso(now);
    crate::db::write(conn, |tx| {
        let mut linked = 0i64;
        let mut skipped = 0i64;
        let mut conflicts = 0i64;
        for line in &notes.lines {
            match line.status.as_str() {
                "SKIP" => skipped += 1,
                "CONFLICT" => {
                    conflicts += 1;
                    if let Some(code) = line.unit_code.as_deref().or(line.carton_code.as_deref()) {
                        repo::exceptions::upsert_open(
                            tx,
                            "DUPLICATE_BARCODE",
                            "ERROR",
                            &format!("DUP_BARCODE:{code}"),
                            line.product_id,
                            Some(import_id),
                            "{}",
                            &now_iso,
                        )?;
                    }
                }
                _ => {
                    let Some(pid) = line.product_id else {
                        conflicts += 1;
                        continue;
                    };
                    let product = repo::products::get(tx, pid)?.ok_or(AppError::NotFound("product"))?;
                    for (code, kind) in [
                        (line.unit_code.as_deref(), BarcodeKind::Unit),
                        (line.carton_code.as_deref(), BarcodeKind::Carton),
                    ] {
                        let Some(code) = code else { continue };
                        if repo::identifiers::find_active_by_code(tx, code)?.is_some() {
                            skipped += 1;
                            continue;
                        }
                        let (ty, _) = detect_type(code);
                        let mult = if kind == BarcodeKind::Carton {
                            product.pack_size.unwrap_or(1)
                        } else {
                            1
                        };
                        let id = repo::identifiers::insert(tx, pid, code, ty, mult, operator_id, &now_iso)?;
                        repo::identifiers::record_pairing(
                            tx,
                            id,
                            pid,
                            "IMPORTED",
                            operator_id,
                            Some(import_id),
                            &now_iso,
                            None,
                        )?;
                        linked += 1;
                    }
                }
            }
        }
        repo::imports::mark_applied(tx, import_id, &now_iso)?;
        Ok(BarcodeImportApplyResult {
            linked,
            skipped,
            conflicts,
        })
    })
}
