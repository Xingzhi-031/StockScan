use chrono::{DateTime, FixedOffset, SecondsFormat, Utc};

pub const WIB_OFFSET_SECS: i32 = 7 * 3600;

pub fn wib() -> FixedOffset {
    FixedOffset::east_opt(WIB_OFFSET_SECS).expect("WIB offset is valid")
}

pub fn utc_iso(now: DateTime<Utc>) -> String {
    now.to_rfc3339_opts(SecondsFormat::Millis, true)
}

pub fn parse_utc(s: &str) -> Result<DateTime<Utc>, chrono::ParseError> {
    s.parse()
}
