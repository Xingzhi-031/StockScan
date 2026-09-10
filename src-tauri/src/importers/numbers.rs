use regex::Regex;
use std::sync::LazyLock;

static GROUPED: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^-?\d{1,3}([.,]\d{3})+$").expect("grouped int regex"));
static PLAIN_INT: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^-?\d+$").expect("int regex"));
static COMMA_DECIMAL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^-?\d+,\d{1,2}$").expect("comma decimal"));
static DOT_DECIMAL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^-?\d+\.\d{1,2}$").expect("dot decimal"));

fn tidy(raw: &str) -> String {
    raw.trim()
        .replace('\u{00a0}', " ")
        .replace("Rp", "")
        .replace("RP", "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("")
}

pub fn parse_int(raw: &str) -> Result<i64, ()> {
    let s = tidy(raw);
    if s.is_empty() {
        return Err(());
    }
    if GROUPED.is_match(&s) {
        let digits = s.replace(['.', ','], "");
        return digits.parse().map_err(|_| ());
    }
    if PLAIN_INT.is_match(&s) {
        return s.parse().map_err(|_| ());
    }
    Err(())
}

pub fn parse_float(raw: &str) -> Result<f64, ()> {
    let s = tidy(raw);
    if s.is_empty() {
        return Err(());
    }
    if COMMA_DECIMAL.is_match(&s) {
        return s.replace(',', ".").parse().map_err(|_| ());
    }
    if DOT_DECIMAL.is_match(&s) {
        return s.parse().map_err(|_| ());
    }
    parse_int(&s).map(|n| n as f64)
}

pub fn int_from_cell(cell: &super::grid::Cell) -> Result<Option<i64>, ()> {
    match cell {
        super::grid::Cell::Empty => Ok(None),
        super::grid::Cell::Int(i) => Ok(Some(*i)),
        super::grid::Cell::Number(n) => {
            if (n.round() - n).abs() < 1e-9 {
                Ok(Some(n.round() as i64))
            } else {
                Err(())
            }
        }
        super::grid::Cell::Text(s) => {
            if s.trim().is_empty() {
                Ok(None)
            } else {
                parse_int(s).map(Some)
            }
        }
    }
}

pub fn float_from_cell(cell: &super::grid::Cell) -> Result<Option<f64>, ()> {
    match cell {
        super::grid::Cell::Empty => Ok(None),
        super::grid::Cell::Int(i) => Ok(Some(*i as f64)),
        super::grid::Cell::Number(n) => Ok(Some(*n)),
        super::grid::Cell::Text(s) => {
            if s.trim().is_empty() {
                Ok(None)
            } else {
                parse_float(s).map(Some)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn grouped_thousands() {
        assert_eq!(parse_int("4.697").unwrap(), 4697);
        assert_eq!(parse_int("4,697").unwrap(), 4697);
        assert_eq!(parse_int("Rp 4.697").unwrap(), 4697);
        assert_eq!(parse_int("50").unwrap(), 50);
        assert!(parse_int("46,97").is_err());
    }

    #[test]
    fn koli_decimals() {
        assert!((parse_float("46,97").unwrap() - 46.97).abs() < 1e-9);
        assert!((parse_float("0.50").unwrap() - 0.5).abs() < 1e-9);
        assert_eq!(parse_float("4.697").unwrap() as i64, 4697);
    }
}
