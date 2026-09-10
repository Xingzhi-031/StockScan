use super::grid::{Cell, Grid};

fn unescape(raw: &str) -> String {
    let mut out = String::new();
    let mut rest = raw;
    while let Some(i) = rest.find('&') {
        out.push_str(&rest[..i]);
        rest = &rest[i..];
        if rest.starts_with("&nbsp;") {
            out.push(' ');
            rest = &rest[6..];
        } else if rest.starts_with("&amp;") {
            out.push('&');
            rest = &rest[5..];
        } else if rest.starts_with("&lt;") {
            out.push('<');
            rest = &rest[4..];
        } else if rest.starts_with("&gt;") {
            out.push('>');
            rest = &rest[4..];
        } else if rest.starts_with("&quot;") {
            out.push('"');
            rest = &rest[6..];
        } else if let Some(end) = rest.find(';') {
            let ent = &rest[1..end];
            if let Some(num) = ent.strip_prefix('#') {
                let code = if let Some(hex) = num.strip_prefix(['x', 'X']) {
                    u32::from_str_radix(hex, 16).ok()
                } else {
                    num.parse().ok()
                };
                if let Some(ch) = code.and_then(char::from_u32) {
                    out.push(ch);
                }
            }
            rest = &rest[end + 1..];
        } else {
            out.push('&');
            rest = &rest[1..];
        }
    }
    out.push_str(rest);
    out
}

fn strip_tags(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    unescape(&out).replace('\u{00a0}', " ")
}

fn split_ignore_case<'a>(hay: &'a str, tag: &str) -> Vec<&'a str> {
    let lower = hay.to_ascii_lowercase();
    let needle = tag.to_ascii_lowercase();
    let mut parts = Vec::new();
    let mut start = 0;
    while let Some(rel) = lower[start..].find(&needle) {
        let at = start + rel;
        parts.push(&hay[start..at]);
        start = at + needle.len();
    }
    parts.push(&hay[start..]);
    parts
}

fn parse_table(table_html: &str) -> Vec<Vec<Cell>> {
    let mut rows = Vec::new();
    for (i, chunk) in split_ignore_case(table_html, "<tr").into_iter().enumerate() {
        if i == 0 {
            continue;
        }
        let body = chunk.find('>').map(|i| &chunk[i + 1..]).unwrap_or(chunk);
        let mut cells = Vec::new();
        let lower = body.to_ascii_lowercase();
        let mut pos = 0;
        while pos < body.len() {
            let rest_l = &lower[pos..];
            let td = rest_l.find("<td");
            let th = rest_l.find("<th");
            let next = match (td, th) {
                (Some(a), Some(b)) => Some(a.min(b)),
                (Some(a), None) => Some(a),
                (None, Some(b)) => Some(b),
                (None, None) => None,
            };
            let Some(rel) = next else { break };
            let abs = pos + rel;
            let after = body[abs..].find('>').map(|i| abs + i + 1).unwrap_or(body.len());
            let end_td = lower[after..].find("</td").or_else(|| lower[after..].find("</th"));
            let end = end_td.map(|i| after + i).unwrap_or(body.len());
            let text = strip_tags(&body[after..end]);
            let trimmed = text.split_whitespace().collect::<Vec<_>>().join(" ");
            cells.push(if trimmed.is_empty() {
                Cell::Empty
            } else if let Ok(i) = crate::importers::numbers::parse_int(&trimmed) {
                if trimmed.contains('.') || trimmed.contains(',') {
                    Cell::Text(trimmed)
                } else {
                    Cell::Int(i)
                }
            } else if let Ok(n) = crate::importers::numbers::parse_float(&trimmed) {
                Cell::Number(n)
            } else {
                Cell::Text(trimmed)
            });
            pos = end;
        }
        if !cells.is_empty() {
            rows.push(cells);
        }
    }
    rows
}

pub fn parse_html(text: &str) -> Grid {
    let lower = text.to_ascii_lowercase();
    let mut best: Vec<Vec<Cell>> = Vec::new();
    let mut search_from = 0;
    while let Some(rel) = lower[search_from..].find("<table") {
        let start = search_from + rel;
        let end = lower[start..].find("</table").map(|i| start + i).unwrap_or(text.len());
        let table = parse_table(&text[start..end]);
        if table.iter().any(|row| {
            row.iter().any(|c| {
                let t = crate::importers::names::normalize_header(&c.as_display());
                t.contains("DESKRIPSI BARANG") || t == "ISI"
            })
        }) {
            return Grid { rows: table };
        }
        if table.len() > best.len() {
            best = table;
        }
        search_from = end.max(start + 6);
    }
    Grid { rows: best }
}
