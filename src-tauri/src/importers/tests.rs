use super::*;
use crate::error::AppError;
use chrono::Utc;
use std::io::Write;

fn parse_html(html: &str) -> ParsedReport {
    let (fmt, grid) = grid_from_bytes(html.as_bytes()).unwrap();
    parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now()).unwrap()
}

#[test]
fn html_magic_and_basic_layout() {
    let html = synthetic::html_report(
        "09 Sep 2026",
        "09 Sep 2026 - 15.53",
        None,
        synthetic::BASIC_ROWS,
        &[],
    );
    let report = parse_html(&html);
    assert_eq!(report.format, crate::dto::FileFormat::Html);
    assert_eq!(report.company_name.as_deref(), Some("PT. CHANG PING INDONESIA"));
    assert!(report.report_name.as_deref().unwrap().contains("Kuantitas Barang"));
    assert_eq!(report.as_of_date.unwrap().to_string(), "2026-09-09");
    assert_eq!(report.rows.len(), 3);
    assert_eq!(report.rows[0].quantity, Some(50));
    assert_eq!(report.rows[0].pack_size, Some(100));
}

#[test]
fn skips_repeated_headers_totals_empty_and_group_titles() {
    let extras = [
        "<tr><td></td><td></td><td></td></tr>",
        "<tr><td>LAMPU EMERGENCY</td><td></td><td></td></tr>",
        "<tr><td>DESKRIPSI BARANG</td><td>ISI</td><td>GS 8A NO 21</td><td>KOLI</td><td>HARGA</td></tr>",
    ];
    let html = synthetic::html_report(
        "09 Sep 2026",
        "09 Sep 2026 - 15.53",
        None,
        synthetic::BASIC_ROWS,
        &extras,
    );
    let report = parse_html(&html);
    assert_eq!(report.rows.len(), 3);
}

#[test]
fn multiple_stock_columns_prefer_active_location() {
    let html = synthetic::html_report(
        "09 Sep 2026",
        "09 Sep 2026 - 15.53",
        Some("GD ONLINE"),
        synthetic::BASIC_ROWS,
        &[],
    );
    let report = parse_html(&html);
    assert_eq!(report.columns.stock_header, "GS 8A NO 21");
    assert!(report
        .columns
        .stock_candidates
        .iter()
        .any(|(_, h)| h == "GD ONLINE"));
}

#[test]
fn text_thousands_and_koli_decimal() {
    let html = r#"<html><table>
<tr><td>PT. CHANG PING INDONESIA</td></tr>
<tr><td>Per Tgl. 09 Sep 2026</td></tr>
<tr><td>DESKRIPSI BARANG</td><td>ISI</td><td>GS 8A NO 21</td><td>KOLI</td></tr>
<tr><td>ITEM ONE</td><td>100</td><td>4.697</td><td>46,97</td></tr>
<tr><td>ITEM TWO</td><td>12</td><td>4,697</td><td>391.42</td></tr>
</table></html>"#;
    let report = parse_html(html);
    assert_eq!(report.rows[0].quantity, Some(4697));
    assert!((report.rows[0].koli.unwrap() - 46.97).abs() < 1e-9);
    assert_eq!(report.rows[1].quantity, Some(4697));
}

#[test]
fn missing_optional_columns_and_empty_isi() {
    let html = r#"<html><table>
<tr><td>PT CV TEST</td></tr>
<tr><td>Per Tgl. 01 Agu 2026</td></tr>
<tr><td>DESKRIPSI BARANG</td><td>ISI</td><td>GS 8A NO 21</td></tr>
<tr><td>BARE ITEM</td><td></td><td>3</td></tr>
</table></html>"#;
    let report = parse_html(html);
    assert!(report.columns.price.is_none());
    assert!(report.columns.koli.is_none());
    assert_eq!(report.rows[0].pack_size, None);
    assert!(report.rows[0]
        .issues
        .iter()
        .any(|i| i.kind == "PACK_SIZE_MISSING"));
}

#[test]
fn duplicate_names_are_ambiguous() {
    let html = r#"<html><table>
<tr><td>PT. X</td></tr>
<tr><td>Per Tgl. 12 Okt 2026</td></tr>
<tr><td>DESKRIPSI BARANG</td><td>ISI</td><td>WH</td></tr>
<tr><td>SAME LAMP</td><td>10</td><td>1</td></tr>
<tr><td>SAME LAMP</td><td>10</td><td>2</td></tr>
</table></html>"#;
    let report = parse_html(html);
    assert!(report.rows.iter().all(|r| r.skipped));
    assert!(report.rows.iter().all(|r| r.issues.iter().any(|i| i.kind == "AMBIGUOUS")));
}

#[test]
fn future_as_of_warns() {
    let html = synthetic::html_report(
        "18 Sep 2026",
        "09 Sep 2026 - 15.53",
        None,
        synthetic::BASIC_ROWS,
        &[],
    );
    let (fmt, grid) = grid_from_bytes(html.as_bytes()).unwrap();
    let now = chrono::DateTime::parse_from_rfc3339("2026-09-10T08:00:00Z")
        .unwrap()
        .with_timezone(&Utc);
    let report = parse_report(fmt, &grid, Some("GS 8A NO 21"), None, now).unwrap();
    assert!(report.issues.iter().any(|i| i.kind == "DATE_IN_FUTURE"));
}

#[test]
fn header_not_found() {
    let err = grid_from_bytes(b"<html><table><tr><td>hello</td></tr></table></html>")
        .and_then(|(fmt, g)| parse_report(fmt, &g, None, None, Utc::now()));
    match err {
        Err(AppError::Import(raw)) => assert!(raw.contains("HEADER_NOT_FOUND")),
        other => panic!("{other:?}"),
    }
}

#[test]
fn unsupported_magic() {
    let err = detect_format(b"not a spreadsheet").unwrap_err();
    assert_eq!(err.code(), "IMPORT_ERROR");
}

#[test]
fn xlsx_basic_roundtrip() {
    let dir = std::env::temp_dir().join(format!("stockscan-xlsx-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("basic.xlsx");
    synthetic::write_xlsx_basic(&path).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    assert_eq!(detect_format(&bytes).unwrap(), crate::dto::FileFormat::Xlsx);
    let (fmt, grid) = grid_from_bytes(&bytes).unwrap();
    let report = parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now()).unwrap();
    assert_eq!(report.rows.len(), 3);
    assert_eq!(report.rows[0].quantity, Some(50));
}

#[test]
fn spreadsheetml_roundtrip() {
    let xml = synthetic::spreadsheetml_basic();
    assert_eq!(
        detect_format(xml.as_bytes()).unwrap(),
        crate::dto::FileFormat::Spreadsheetml
    );
    let report = {
        let (fmt, grid) = grid_from_bytes(xml.as_bytes()).unwrap();
        parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now()).unwrap()
    };
    assert_eq!(report.rows.len(), 1);
    assert_eq!(report.rows[0].quantity, Some(50));
}

#[test]
fn xlsx_1284_quantities_match_generator() {
    let dir = std::env::temp_dir().join(format!("stockscan-xlsx-full-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("full.xlsx");
    synthetic::write_xlsx_catalog(&path, 1284).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    let (fmt, grid) = grid_from_bytes(&bytes).unwrap();
    let report = parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now()).unwrap();
    assert_eq!(report.rows.len(), 1284);
    let expected = synthetic::catalog_1284();
    for (row, (name, pack, qty)) in report.rows.iter().zip(expected) {
        assert_eq!(row.raw_name, name);
        assert_eq!(row.pack_size, Some(pack));
        assert_eq!(row.quantity, Some(qty));
    }
}

#[test]
fn utf16_html_is_detected() {
    let html = synthetic::html_report(
        "31 Des 2026",
        "31 Des 2026 - 08.00",
        None,
        &synthetic::BASIC_ROWS[..1],
        &[],
    );
    let mut bytes = vec![0xFF, 0xFE];
    for u in html.encode_utf16() {
        bytes.extend_from_slice(&u.to_le_bytes());
    }
    assert_eq!(detect_format(&bytes).unwrap(), crate::dto::FileFormat::Html);
    let (fmt, grid) = grid_from_bytes(&bytes).unwrap();
    let report = parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now()).unwrap();
    assert_eq!(report.rows.len(), 1);
}

#[test]
fn committed_html_fixture_parses() {
    let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../fixtures/synthetic/accurate-basic.html");
    let bytes = std::fs::read(&path).expect("committed HTML fixture");
    let (fmt, grid) = grid_from_bytes(&bytes).unwrap();
    let report = parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now()).unwrap();
    assert_eq!(report.format, crate::dto::FileFormat::Html);
    assert_eq!(report.rows.len(), 3);
    let sum: i64 = report.rows.iter().filter_map(|r| r.quantity).sum();
    assert_eq!(sum, 450);
}

#[test]
#[ignore]
fn real_files_if_present() {
    let dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/private");
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return;
    };
    for ent in entries.flatten() {
        let path = ent.path();
        if !path
            .extension()
            .and_then(|e| e.to_str())
            .is_some_and(|e| matches!(e.to_ascii_lowercase().as_str(), "xls" | "xlsx" | "html"))
        {
            continue;
        }
        let bytes = std::fs::read(&path).unwrap();
        let (fmt, grid) = grid_from_bytes(&bytes).expect(&format!("parse {}", path.display()));
        let report = parse_report(fmt, &grid, Some("GS 8A NO 21"), None, Utc::now())
            .expect(&format!("report {}", path.display()));
        assert!(
            !report.rows.is_empty(),
            "{} produced no data rows",
            path.display()
        );
        let _ = writeln!(std::io::stderr(), "{} -> {} rows", path.display(), report.rows.len());
    }
}
