import type { InventoryRow } from "../../bindings/InventoryRow";
import { isJakartaToday } from "../../lib/format";

export type InventoryChip = "all" | "unlinked" | "negative" | "zero" | "changedToday" | "exceptions";

export const INVENTORY_CHIPS: InventoryChip[] = [
  "all",
  "unlinked",
  "negative",
  "zero",
  "changedToday",
  "exceptions",
];

export function liveDelta(row: InventoryRow): number {
  return row.currentQuantity - row.baselineQuantity;
}

export function matchesQuery(row: InventoryRow, query: string): boolean {
  const s = query.trim().toLowerCase();
  if (!s) return true;
  if (row.name.toLowerCase().includes(s)) return true;
  if (row.modelCode?.toLowerCase().includes(s)) return true;
  if (row.externalCode?.toLowerCase().includes(s)) return true;
  return row.barcodes.some((code) => code.toLowerCase().includes(s));
}

export function matchesChip(row: InventoryRow, chip: InventoryChip, now: Date): boolean {
  switch (chip) {
    case "all":
      return true;
    case "unlinked":
      return row.barcodeCount === 0;
    case "negative":
      return row.currentQuantity < 0;
    case "zero":
      return row.currentQuantity === 0;
    case "changedToday":
      return isJakartaToday(row.lastChangedAt, now);
    case "exceptions":
      return row.openExceptionCount > 0;
  }
}

export function chipCounts(rows: InventoryRow[], now: Date): Record<InventoryChip, number> {
  const counts: Record<InventoryChip, number> = {
    all: rows.length,
    unlinked: 0,
    negative: 0,
    zero: 0,
    changedToday: 0,
    exceptions: 0,
  };
  for (const row of rows) {
    if (matchesChip(row, "unlinked", now)) counts.unlinked += 1;
    if (matchesChip(row, "negative", now)) counts.negative += 1;
    if (matchesChip(row, "zero", now)) counts.zero += 1;
    if (matchesChip(row, "changedToday", now)) counts.changedToday += 1;
    if (matchesChip(row, "exceptions", now)) counts.exceptions += 1;
  }
  return counts;
}

export function filterInventory(
  rows: InventoryRow[],
  query: string,
  chip: InventoryChip,
  now: Date,
): InventoryRow[] {
  return rows.filter((row) => matchesQuery(row, query) && matchesChip(row, chip, now));
}

export function parseChip(raw: string | null): InventoryChip {
  if (raw && (INVENTORY_CHIPS as string[]).includes(raw)) return raw as InventoryChip;
  return "all";
}
