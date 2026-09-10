use regex::Regex;
use std::sync::LazyLock;
use unicode_normalization::UnicodeNormalization;

static MODEL: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"\b([A-Z]{1,4}-[A-Z0-9]{2,12})\b").expect("model regex"));

pub fn normalize_header(raw: &str) -> String {
    raw.replace('\u{00a0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

pub fn name_key(raw: &str) -> String {
    let nfkc: String = raw.nfkc().collect();
    nfkc.replace('\u{00a0}', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_uppercase()
}

pub fn model_code(name_key: &str) -> Option<String> {
    MODEL
        .find_iter(name_key)
        .last()
        .map(|m| m.as_str().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_key_collapses_space_and_uppercases() {
        assert_eq!(
            name_key(" Emergency  Lamp KISEKI CK-EM296 "),
            "EMERGENCY LAMP KISEKI CK-EM296"
        );
    }

    #[test]
    fn model_takes_the_last_token() {
        assert_eq!(
            model_code("EMERGENCY LAMP KISEKI CK-EM296").as_deref(),
            Some("CK-EM296")
        );
        assert_eq!(
            model_code("EMERGENCY LAMP KISEKI CK-K837PB").as_deref(),
            Some("CK-K837PB")
        );
    }
}
