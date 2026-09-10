import { describe, expect, it } from "vitest";
import type { StockReportPreview } from "../../bindings/StockReportPreview";
import {
  barcodeCheck,
  baselineCheck,
  columnStatus,
  dateCheck,
  formatLabel,
  importableCount,
} from "./importPreview";

const preview: StockReportPreview = {
  importId: 1,
  purpose: "BASELINE",
  fileName: "stock.xls",
  fileFormat: "XLS",
  companyName: "PT. CHANG PING INDONESIA",
  reportName: "Kuantitas Barang GS 8 No.21",
  asOfDate: "2026-09-09",
  printedAt: "2026-09-09T08:53:00.000Z",
  cutoffAt: null,
  stockColumn: "GS 8A NO 21",
  stockColumnCandidates: ["GS 8A NO 21"],
  columns: [
    { source: "Deskripsi Barang", target: "NAME", firstValue: "LAMP" },
    { source: "ISI", target: "PACK_SIZE", firstValue: "100" },
    { source: "GS 8A NO 21", target: "STOCK", firstValue: "50" },
    { source: "KOLI", target: "KOLI_CHECK", firstValue: "0.50" },
    { source: "HARGA", target: "PRICE", firstValue: null },
  ],
  counts: { dataRows: 1284, matched: 0, new: 1284, ambiguous: 0, invalid: 0, packSizeMissing: 0 },
  fileIssues: [{ kind: "NO_BARCODE_COLUMN", message: "none" }],
  sampleRows: [],
  problemRows: [],
  canApply: true,
};

describe("columnStatus", () => {
  it("marks pack/koli as needing confirmation and empty price as optional", () => {
    expect(columnStatus(preview.columns[0])).toBe("mapped");
    expect(columnStatus(preview.columns[1])).toBe("confirm");
    expect(columnStatus(preview.columns[3])).toBe("confirm");
    expect(columnStatus(preview.columns[4])).toBe("optional");
  });
});

describe("checks", () => {
  it("warns when there is no barcode column", () => {
    expect(barcodeCheck(preview)).toEqual({ tone: "warn", kind: "NO_BARCODE_COLUMN" });
    expect(dateCheck(preview).kind).toBe("DATE_OK");
    expect(baselineCheck(preview)).toBeNull();
  });

  it("blocks apply copy when a baseline already exists", () => {
    const blocked = {
      ...preview,
      canApply: false,
      fileIssues: [...preview.fileIssues, { kind: "BASELINE_EXISTS", message: null }],
    };
    expect(baselineCheck(blocked)?.kind).toBe("BASELINE_EXISTS");
  });
});

describe("formatLabel", () => {
  it("names the detected file type", () => {
    expect(formatLabel("XLS")).toBe("legacy .xls");
    expect(formatLabel("XLSX")).toBe("Excel .xlsx");
  });
});

describe("importableCount", () => {
  it("sums matched and new", () => {
    expect(importableCount(preview)).toBe(1284);
  });
});
