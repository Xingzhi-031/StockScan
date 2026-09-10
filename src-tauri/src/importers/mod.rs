pub mod dates;
pub mod grid;
pub mod html;
pub mod names;
pub mod numbers;
pub mod parse;
pub mod spreadsheetml;
pub mod synthetic;
pub mod xls;

#[cfg(test)]
mod tests;

pub use grid::{detect_format, read_path, sha256_hex};
pub use parse::{grid_from_bytes, parse_report, ParsedReport};
