import { describe, expect, it } from "vitest";
import type { InventoryRow } from "../../bindings/InventoryRow";
import { chipCounts, filterInventory, liveDelta, parseChip } from "./filter";

function row(partial: Partial<InventoryRow> & Pick<InventoryRow, "productId" | "name">): InventoryRow {
  return {
    modelCode: null,
    externalCode: null,
    packSize: 100,
    referencePrice: 1000,
    baselineQuantity: 50,
    currentQuantity: 50,
    barcodeCount: 1,
    barcodes: ["6914791234567"],
    lastChangedAt: null,
    baselineAsOf: "2026-09-09",
    openExceptionCount: 0,
    ...partial,
  };
}

const now = new Date("2026-09-10T10:00:00.000Z");

const catalog: InventoryRow[] = [
  row({ productId: 1, name: "EMERGENCY LAMP KISEKI CK-EM296", modelCode: "CK-EM296", currentQuantity: 46 }),
  row({
    productId: 2,
    name: "EMERGENCY LAMP KISEKI CK-EM838",
    modelCode: "CK-EM838",
    barcodeCount: 0,
    barcodes: [],
    currentQuantity: 280,
  }),
  row({
    productId: 3,
    name: "EMERGENCY LAMP SMARTSONIC SM-K808",
    modelCode: "SM-K808",
    currentQuantity: -3,
    lastChangedAt: "2026-09-10T06:40:00.000Z",
  }),
  row({
    productId: 4,
    name: "SWITCH BASIC",
    modelCode: "SW-1",
    externalCode: "NB-004",
    currentQuantity: 0,
    openExceptionCount: 1,
    barcodes: ["899123"],
  }),
];

describe("filterInventory", () => {
  it("matches name, model, barcode and external code", () => {
    expect(filterInventory(catalog, "ck-em296", "all", now).map((r) => r.productId)).toEqual([1]);
    expect(filterInventory(catalog, "SM-K808", "all", now).map((r) => r.productId)).toEqual([3]);
    expect(filterInventory(catalog, "691479", "all", now).map((r) => r.productId)).toEqual([1, 3]);
    expect(filterInventory(catalog, "nb-004", "all", now).map((r) => r.productId)).toEqual([4]);
  });

  it("applies chips", () => {
    expect(filterInventory(catalog, "", "unlinked", now).map((r) => r.productId)).toEqual([2]);
    expect(filterInventory(catalog, "", "negative", now).map((r) => r.productId)).toEqual([3]);
    expect(filterInventory(catalog, "", "zero", now).map((r) => r.productId)).toEqual([4]);
    expect(filterInventory(catalog, "", "changedToday", now).map((r) => r.productId)).toEqual([3]);
    expect(filterInventory(catalog, "", "exceptions", now).map((r) => r.productId)).toEqual([4]);
  });
});

describe("chipCounts", () => {
  it("counts every chip independently", () => {
    expect(chipCounts(catalog, now)).toEqual({
      all: 4,
      unlinked: 1,
      negative: 1,
      zero: 1,
      changedToday: 1,
      exceptions: 1,
    });
  });
});

describe("liveDelta", () => {
  it("is current minus baseline", () => {
    expect(liveDelta(catalog[0])).toBe(-4);
  });
});

describe("parseChip", () => {
  it("falls back to all", () => {
    expect(parseChip("negative")).toBe("negative");
    expect(parseChip("nope")).toBe("all");
    expect(parseChip(null)).toBe("all");
  });
});
