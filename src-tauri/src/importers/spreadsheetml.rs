use super::grid::{Cell, Grid};

fn unescape(raw: &str) -> String {
    raw.replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&nbsp;", " ")
}

fn attr_index(tag: &str) -> Option<usize> {
    let lower = tag.to_ascii_lowercase();
    let key = "ss:index=\"";
    let i = lower.find(key)?;
    let rest = &tag[i + key.len()..];
    let end = rest.find('"')?;
    rest[..end].parse::<usize>().ok()
}

fn cell_from_xml(cell_xml: &str) -> Cell {
    let lower = cell_xml.to_ascii_lowercase();
    let Some(data_at) = lower.find("<data") else {
        return Cell::Empty;
    };
    let after = cell_xml[data_at..].find('>').map(|i| data_at + i + 1).unwrap_or(cell_xml.len());
    let end = lower[after..].find("</data").map(|i| after + i).unwrap_or(cell_xml.len());
    let inner = unescape(&cell_xml[after..end]).trim().to_string();
    if inner.is_empty() {
        return Cell::Empty;
    }
    let is_number = lower[data_at..after].contains("number");
    if is_number {
        if let Ok(i) = crate::importers::numbers::parse_int(&inner) {
            return Cell::Int(i);
        }
        if let Ok(n) = crate::importers::numbers::parse_float(&inner) {
            return Cell::Number(n);
        }
    }
    Cell::Text(inner)
}

pub fn parse_spreadsheetml(text: &str) -> Grid {
    let lower = text.to_ascii_lowercase();
    let mut rows = Vec::new();
    let mut search = 0;
    while let Some(rel) = lower[search..].find("<row") {
        let start = search + rel;
        let tag_end = text[start..].find('>').map(|i| start + i + 1).unwrap_or(text.len());
        let end = lower[tag_end..].find("</row").map(|i| tag_end + i).unwrap_or(text.len());
        let row_xml = &text[start..end];
        let row_lower = row_xml.to_ascii_lowercase();
        let mut cells: Vec<Cell> = Vec::new();
        let mut pos = 0;
        while let Some(rel) = row_lower[pos..].find("<cell") {
            let c0 = pos + rel;
            let c_tag_end = row_xml[c0..].find('>').map(|i| c0 + i + 1).unwrap_or(row_xml.len());
            let c_end = row_lower[c_tag_end..]
                .find("</cell")
                .map(|i| c_tag_end + i)
                .unwrap_or(row_xml.len());
            let tag = &row_xml[c0..c_tag_end];
            let idx = attr_index(tag).unwrap_or(cells.len() + 1);
            while cells.len() + 1 < idx {
                cells.push(Cell::Empty);
            }
            cells.push(cell_from_xml(&row_xml[c0..c_end]));
            pos = c_end.max(c0 + 5);
        }
        rows.push(cells);
        search = end.max(start + 4);
    }
    Grid { rows }
}
