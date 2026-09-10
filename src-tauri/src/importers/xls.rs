use calamine::{open_workbook_auto_from_rs, Data, Reader};

use super::grid::{cursor, Cell, Grid};
use crate::error::AppError;

fn from_data(d: &Data) -> Cell {
    match d {
        Data::Int(i) => Cell::Int(*i),
        Data::Float(f) => {
            if (f.round() - f).abs() < 1e-9 && *f >= i64::MIN as f64 && *f <= i64::MAX as f64 {
                Cell::Int(f.round() as i64)
            } else {
                Cell::Number(*f)
            }
        }
        Data::String(s) => {
            if s.trim().is_empty() {
                Cell::Empty
            } else {
                Cell::Text(s.clone())
            }
        }
        Data::Empty => Cell::Empty,
        other => {
            let s = other.to_string();
            if s.trim().is_empty() {
                Cell::Empty
            } else {
                Cell::Text(s)
            }
        }
    }
}

pub fn parse_ole_or_xlsx(bytes: &[u8]) -> Result<Grid, AppError> {
    let mut wb = open_workbook_auto_from_rs(cursor(bytes)).map_err(|e| {
        AppError::import("UNREADABLE", format!("Could not read the workbook: {e}"))
    })?;
    let name = wb
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| AppError::import("NO_SHEET", "The workbook has no sheets."))?;
    let range = wb.worksheet_range(&name).map_err(|e| {
        AppError::import("UNREADABLE", format!("Could not read the first sheet: {e}"))
    })?;
    let (row0, col0) = range.start().unwrap_or((0, 0));
    let mut rows = Vec::new();
    for _ in 0..row0 {
        rows.push(Vec::new());
    }
    for r in range.rows() {
        let mut row = vec![Cell::Empty; col0 as usize];
        row.extend(r.iter().map(from_data));
        rows.push(row);
    }
    Ok(Grid { rows })
}
