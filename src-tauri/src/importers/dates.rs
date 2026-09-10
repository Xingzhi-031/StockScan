use chrono::{NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use regex::Regex;
use std::sync::LazyLock;

use crate::time;

static PER_TGL: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)per\s*tgl\.?\s*(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})")
        .expect("per tgl regex")
});
static CETAK: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?i)cetak\s+di\s+(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\s*[-–]\s*(\d{1,2})[.:](\d{2})",
    )
    .expect("cetak regex")
});

fn month_num(token: &str) -> Option<u32> {
    let key = token.chars().take(3).collect::<String>().to_ascii_lowercase();
    match key.as_str() {
        "jan" => Some(1),
        "feb" => Some(2),
        "mar" => Some(3),
        "apr" => Some(4),
        "mei" | "may" => Some(5),
        "jun" => Some(6),
        "jul" => Some(7),
        "agu" | "agt" | "aug" => Some(8),
        "sep" => Some(9),
        "okt" | "oct" => Some(10),
        "nov" => Some(11),
        "des" | "dec" => Some(12),
        _ => None,
    }
}

fn parse_dmy(day: &str, month: &str, year: &str) -> Option<NaiveDate> {
    let d: u32 = day.parse().ok()?;
    let m = month_num(month)?;
    let y: i32 = year.parse().ok()?;
    NaiveDate::from_ymd_opt(y, m, d)
}

pub fn find_as_of(text: &str) -> Option<NaiveDate> {
    let cap = PER_TGL.captures(text)?;
    parse_dmy(&cap[1], &cap[2], &cap[3])
}

pub fn find_printed_at(text: &str) -> Option<NaiveDateTime> {
    let cap = CETAK.captures(text)?;
    let date = parse_dmy(&cap[1], &cap[2], &cap[3])?;
    let hour: u32 = cap[4].parse().ok()?;
    let minute: u32 = cap[5].parse().ok()?;
    let time = NaiveTime::from_hms_opt(hour, minute, 0)?;
    Some(NaiveDateTime::new(date, time))
}

pub fn wib_end_of_day_utc(date: NaiveDate) -> chrono::DateTime<Utc> {
    let local = date.and_hms_opt(23, 59, 59).expect("eod");
    time::wib()
        .from_local_datetime(&local)
        .single()
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|| Utc.from_utc_datetime(&local))
}

pub fn wib_datetime_utc(local: NaiveDateTime) -> chrono::DateTime<Utc> {
    time::wib()
        .from_local_datetime(&local)
        .single()
        .map(|d| d.with_timezone(&Utc))
        .unwrap_or_else(|| Utc.from_utc_datetime(&local))
}

pub fn today_wib(now: chrono::DateTime<Utc>) -> NaiveDate {
    now.with_timezone(&time::wib()).date_naive()
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Timelike;

    #[test]
    fn parses_accurate_dates_and_indonesian_months() {
        let as_of = find_as_of("Per Tgl. 18 Sep 2026").unwrap();
        assert_eq!(as_of, NaiveDate::from_ymd_opt(2026, 9, 18).unwrap());
        let printed = find_printed_at("Cetak di 09 Sep 2026 - 15.53").unwrap();
        assert_eq!(printed.time().hour(), 15);
        assert_eq!(printed.time().minute(), 53);
        assert!(find_as_of("Per Tgl. 01 Agu 2026").is_some());
        assert!(find_as_of("Per Tgl. 01 Agt 2026").is_some());
        assert!(find_as_of("Per Tgl. 12 Okt 2026").is_some());
        assert!(find_as_of("Per Tgl. 31 Des 2026").is_some());
    }
}
