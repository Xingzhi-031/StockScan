use std::io::{Cursor, Read};

use sha2::{Digest, Sha256};

use crate::dto::FileFormat;
use crate::error::AppError;

#[derive(Debug, Clone, PartialEq)]
pub enum Cell {
    Empty,
    Text(String),
    Number(f64),
    Int(i64),
}

impl Cell {
    pub fn is_empty(&self) -> bool {
        match self {
            Self::Empty => true,
            Self::Text(s) => s.trim().is_empty(),
            _ => false,
        }
    }

    pub fn as_display(&self) -> String {
        match self {
            Self::Empty => String::new(),
            Self::Text(s) => s.clone(),
            Self::Number(n) => {
                if (n.fract()).abs() < 1e-9 {
                    format!("{}", *n as i64)
                } else {
                    n.to_string()
                }
            }
            Self::Int(i) => i.to_string(),
        }
    }

    pub fn looks_numeric(&self) -> bool {
        match self {
            Self::Int(_) | Self::Number(_) => true,
            Self::Text(s) => crate::importers::numbers::parse_int(s).is_ok(),
            Self::Empty => false,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct Grid {
    pub rows: Vec<Vec<Cell>>,
}

impl Grid {
    pub fn cell(&self, row: usize, col: usize) -> &Cell {
        self.rows
            .get(row)
            .and_then(|r| r.get(col))
            .unwrap_or(&Cell::Empty)
    }

    pub fn row_is_empty(&self, row: usize) -> bool {
        self.rows
            .get(row)
            .map(|r| r.iter().all(Cell::is_empty))
            .unwrap_or(true)
    }
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub fn read_path(path: &std::path::Path) -> Result<Vec<u8>, AppError> {
    let mut f = std::fs::File::open(path)?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf)?;
    Ok(buf)
}

pub fn detect_format(bytes: &[u8]) -> Result<FileFormat, AppError> {
    if bytes.len() >= 8 && bytes.starts_with(&[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) {
        return Ok(FileFormat::Xls);
    }
    if bytes.len() >= 4 && bytes.starts_with(b"PK\x03\x04") {
        return Ok(FileFormat::Xlsx);
    }

    let text = decode_text(bytes);
    let head = text.chars().take(8000).collect::<String>();
    let lower = head.to_ascii_lowercase();
    if lower.contains("urn:schemas-microsoft-com:office:spreadsheet") {
        return Ok(FileFormat::Spreadsheetml);
    }
    if lower.contains("<html") || lower.contains("<!doctype") || lower.contains("<table") {
        return Ok(FileFormat::Html);
    }
    Err(AppError::import(
        "UNSUPPORTED_FORMAT",
        "This file is not an Excel workbook or HTML table StockScan can read.",
    ))
}

pub fn decode_text(bytes: &[u8]) -> String {
    if bytes.starts_with(&[0xFF, 0xFE]) {
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_le_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    if bytes.starts_with(&[0xFE, 0xFF]) {
        let u16s: Vec<u16> = bytes[2..]
            .chunks_exact(2)
            .map(|c| u16::from_be_bytes([c[0], c[1]]))
            .collect();
        return String::from_utf16_lossy(&u16s);
    }
    let rest = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        &bytes[3..]
    } else {
        bytes
    };
    String::from_utf8_lossy(rest).into_owned()
}

pub fn cursor(bytes: &[u8]) -> Cursor<Vec<u8>> {
    Cursor::new(bytes.to_vec())
}
