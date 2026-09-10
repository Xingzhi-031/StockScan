use rust_xlsxwriter::{Workbook, XlsxError};
use std::path::Path;

pub struct SampleRow {
    pub name: &'static str,
    pub pack_size: Option<i64>,
    pub qty: i64,
    pub koli: Option<f64>,
    pub price: Option<i64>,
    pub external: Option<&'static str>,
}

pub const BASIC_ROWS: &[SampleRow] = &[
    SampleRow {
        name: "EMERGENCY LAMP KISEKI CK-EM296",
        pack_size: Some(100),
        qty: 50,
        koli: Some(0.50),
        price: Some(32_500),
        external: None,
    },
    SampleRow {
        name: "EMERGENCY LAMP KISEKI CK-EM838",
        pack_size: Some(80),
        qty: 280,
        koli: Some(3.50),
        price: Some(41_000),
        external: None,
    },
    SampleRow {
        name: "EMERGENCY LAMP KISEKI CK-K837PB",
        pack_size: Some(60),
        qty: 120,
        koli: Some(2.00),
        price: Some(28_000),
        external: None,
    },
];

pub fn html_report(
    as_of: &str,
    printed: &str,
    extra_stock_header: Option<&str>,
    rows: &[SampleRow],
    extras: &[&str],
) -> String {
    let mut body = String::new();
    body.push_str("<tr><td>PT. CHANG PING INDONESIA</td></tr>");
    body.push_str("<tr><td>Kuantitas Barang GS 8 No.21</td></tr>");
    body.push_str(&format!("<tr><td>Per Tgl. {as_of}</td></tr>"));
    body.push_str("<tr><td>DESKRIPSI BARANG</td><td>ISI</td><td>GS 8A NO 21</td>");
    if let Some(h) = extra_stock_header {
        body.push_str(&format!("<td>{h}</td>"));
    }
    body.push_str("<td>KOLI</td><td>HARGA</td></tr>");
    for line in extras {
        body.push_str(line);
    }
    let mut total = 0i64;
    for row in rows {
        total += row.qty;
        body.push_str("<tr>");
        body.push_str(&format!("<td>{}</td>", row.name));
        body.push_str(&format!(
            "<td>{}</td>",
            row.pack_size.map(|n| n.to_string()).unwrap_or_default()
        ));
        body.push_str(&format!("<td>{}</td>", row.qty));
        if extra_stock_header.is_some() {
            body.push_str("<td>0</td>");
        }
        body.push_str(&format!(
            "<td>{}</td>",
            row.koli.map(|n| format!("{n:.2}")).unwrap_or_default()
        ));
        body.push_str(&format!(
            "<td>{}</td>",
            row.price.map(|n| n.to_string()).unwrap_or_default()
        ));
        body.push_str("</tr>");
    }
    body.push_str(&format!("<tr><td>TOTAL</td><td></td><td>{total}</td></tr>"));
    body.push_str(&format!("<tr><td>Cetak di {printed}</td></tr>"));
    format!("<html><body><table>{body}</table></body></html>")
}

pub fn catalog_1284() -> Vec<(String, i64, i64)> {
    let packs = [12i64, 24, 60, 80, 100, 450];
    (1..=1284)
        .map(|i| {
            let name = format!("SYNTHETIC ITEM {i:04} DM-{i:04}");
            let pack = packs[(i - 1) % packs.len()];
            let qty = 10 + (i as i64 % 500);
            (name, pack, qty)
        })
        .collect()
}

pub fn write_xlsx_catalog(path: &Path, n: usize) -> Result<(), XlsxError> {
    let mut wb = Workbook::new();
    let sheet = wb.add_worksheet();
    sheet.write_string(0, 0, "PT. CHANG PING INDONESIA")?;
    sheet.write_string(1, 0, "Kuantitas Barang GS 8 No.21")?;
    sheet.write_string(2, 0, "Per Tgl. 09 Sep 2026")?;
    sheet.write_string(4, 0, "DESKRIPSI BARANG")?;
    sheet.write_string(4, 1, "ISI")?;
    sheet.write_string(4, 2, "GS 8A NO 21")?;
    sheet.write_string(4, 3, "KOLI")?;
    sheet.write_string(4, 4, "HARGA")?;
    let packs = [12i64, 24, 60, 80, 100, 450];
    let mut total = 0i64;
    for i in 1..=n {
        let row = (4 + i) as u32;
        let pack = packs[(i - 1) % packs.len()];
        let qty = 10 + (i as i64 % 500);
        total += qty;
        sheet.write_string(row, 0, &format!("SYNTHETIC ITEM {i:04} DM-{i:04}"))?;
        sheet.write_number(row, 1, pack as f64)?;
        sheet.write_number(row, 2, qty as f64)?;
        sheet.write_number(row, 3, qty as f64 / pack as f64)?;
        sheet.write_number(row, 4, (10_000 + (i as i64 % 50) * 500) as f64)?;
    }
    let total_row = (5 + n) as u32;
    sheet.write_string(total_row, 0, "TOTAL")?;
    sheet.write_number(total_row, 2, total as f64)?;
    sheet.write_string(total_row + 1, 0, "Cetak di 09 Sep 2026 - 15.53")?;
    wb.save(path)?;
    Ok(())
}

pub fn write_xlsx_basic(path: &Path) -> Result<(), XlsxError> {
    let mut wb = Workbook::new();
    let sheet = wb.add_worksheet();
    sheet.write_string(0, 0, "PT. CHANG PING INDONESIA")?;
    sheet.write_string(1, 0, "Kuantitas Barang GS 8 No.21")?;
    sheet.write_string(2, 0, "Per Tgl. 09 Sep 2026")?;
    sheet.write_string(4, 0, "DESKRIPSI BARANG")?;
    sheet.write_string(4, 1, "ISI")?;
    sheet.write_string(4, 2, "GS 8A NO 21")?;
    sheet.write_string(4, 3, "KOLI")?;
    sheet.write_string(4, 4, "HARGA")?;
    for (i, row) in BASIC_ROWS.iter().enumerate() {
        let r = (5 + i) as u32;
        sheet.write_string(r, 0, row.name)?;
        if let Some(p) = row.pack_size {
            sheet.write_number(r, 1, p as f64)?;
        }
        sheet.write_number(r, 2, row.qty as f64)?;
        if let Some(k) = row.koli {
            sheet.write_number(r, 3, k)?;
        }
        if let Some(p) = row.price {
            sheet.write_number(r, 4, p as f64)?;
        }
    }
    sheet.write_string(8, 0, "TOTAL")?;
    sheet.write_number(8, 2, 450.0)?;
    sheet.write_string(9, 0, "Cetak di 09 Sep 2026 - 15.53")?;
    wb.save(path)?;
    Ok(())
}

pub fn spreadsheetml_basic() -> String {
    let mut cells = String::new();
    let lines = [
        vec!["PT. CHANG PING INDONESIA"],
        vec!["Kuantitas Barang GS 8 No.21"],
        vec!["Per Tgl. 09 Sep 2026"],
        vec![],
        vec!["DESKRIPSI BARANG", "ISI", "GS 8A NO 21", "KOLI"],
        vec!["EMERGENCY LAMP KISEKI CK-EM296", "100", "50", "0.50"],
        vec!["TOTAL", "", "50"],
        vec!["Cetak di 09 Sep 2026 - 15.53"],
    ];
    for line in lines {
        cells.push_str("<Row>");
        for (i, v) in line.iter().enumerate() {
            let idx = i + 1;
            if v.is_empty() {
                continue;
            }
            let ty = if i > 0 && crate::importers::numbers::parse_float(v).is_ok() {
                "Number"
            } else {
                "String"
            };
            cells.push_str(&format!(
                r#"<Cell ss:Index="{idx}"><Data ss:Type="{ty}">{v}</Data></Cell>"#
            ));
        }
        cells.push_str("</Row>");
    }
    format!(
        r#"<?xml version="1.0"?>
<Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Sheet1"><Table>{cells}</Table></Worksheet>
</Workbook>"#
    )
}
