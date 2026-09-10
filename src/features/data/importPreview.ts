import type { ColumnTarget } from "../../bindings/ColumnTarget";
import type { FileFormat } from "../../bindings/FileFormat";
import type { ImportColumnMap } from "../../bindings/ImportColumnMap";
import type { ImportIssue } from "../../bindings/ImportIssue";
import type { StockReportPreview } from "../../bindings/StockReportPreview";

export type ColumnStatus = "mapped" | "confirm" | "optional";
export type CheckTone = "ok" | "warn" | "error";

export function hasIssue(issues: ImportIssue[], kind: string): boolean {
  return issues.some((issue) => issue.kind === kind);
}

export function issueOf(issues: ImportIssue[], kind: string): ImportIssue | undefined {
  return issues.find((issue) => issue.kind === kind);
}

export function columnStatus(col: ImportColumnMap): ColumnStatus {
  if (col.target === "PRICE" && !col.firstValue) return "optional";
  if (col.target === "PACK_SIZE" || col.target === "KOLI_CHECK") return "confirm";
  return "mapped";
}

export function fieldKey(target: ColumnTarget): string {
  switch (target) {
    case "NAME":
      return "import.fieldName";
    case "PACK_SIZE":
      return "import.fieldPack";
    case "STOCK":
      return "import.fieldStock";
    case "KOLI_CHECK":
      return "import.fieldKoli";
    case "PRICE":
      return "import.fieldPrice";
    case "EXTERNAL_CODE":
      return "import.fieldCode";
  }
}

export function formatLabel(format: FileFormat): string {
  switch (format) {
    case "XLS":
      return "legacy .xls";
    case "XLSX":
      return "Excel .xlsx";
    case "HTML":
      return "HTML";
    case "SPREADSHEETML":
      return "SpreadsheetML";
    case "CSV":
      return "CSV";
  }
}

export function dateCheck(preview: StockReportPreview): { tone: CheckTone; kind: string } {
  if (hasIssue(preview.fileIssues, "DATE_IN_FUTURE")) return { tone: "warn", kind: "DATE_IN_FUTURE" };
  if (hasIssue(preview.fileIssues, "AS_OF_AFTER_PRINTED")) {
    return { tone: "warn", kind: "AS_OF_AFTER_PRINTED" };
  }
  if (hasIssue(preview.fileIssues, "AS_OF_MISSING")) return { tone: "warn", kind: "AS_OF_MISSING" };
  if (hasIssue(preview.fileIssues, "OLDER_THAN_LAST_IMPORT")) {
    return { tone: "warn", kind: "OLDER_THAN_LAST_IMPORT" };
  }
  return { tone: "ok", kind: "DATE_OK" };
}

export function koliCheck(preview: StockReportPreview): { tone: CheckTone; kind: string } {
  if (hasIssue(preview.fileIssues, "KOLI_MISMATCH")) return { tone: "warn", kind: "KOLI_MISMATCH" };
  return { tone: "ok", kind: "KOLI_OK" };
}

export function barcodeCheck(preview: StockReportPreview): { tone: CheckTone; kind: string } {
  if (hasIssue(preview.fileIssues, "NO_BARCODE_COLUMN")) {
    return { tone: "warn", kind: "NO_BARCODE_COLUMN" };
  }
  return { tone: "ok", kind: "BARCODE_OK" };
}

export function baselineCheck(preview: StockReportPreview): { tone: CheckTone; kind: string } | null {
  if (hasIssue(preview.fileIssues, "BASELINE_EXISTS")) {
    return { tone: "error", kind: "BASELINE_EXISTS" };
  }
  return null;
}

export function importableCount(preview: StockReportPreview): number {
  return preview.counts.matched + preview.counts.new;
}
