import { describe, expect, it } from "vitest";
import type { IdentifierDto } from "../../bindings/IdentifierDto";
import type { ProductCard } from "../../bindings/ProductCard";
import type { TxResult } from "../../bindings/TxResult";
import {
  INITIAL_SCAN,
  preview,
  scanReducer,
  type Card,
  type ScanState,
} from "./scanReducer";

const product: ProductCard = {
  productId: 1,
  name: "LAMP",
  modelCode: "CK-1",
  packSize: 100,
  referencePrice: 1000,
  locationId: 1,
  baselineQuantity: 50,
  currentQuantity: 46,
  baselineAsOf: "2026-09-09",
};

const unit: IdentifierDto = {
  id: 1,
  code: "1234567890123",
  identifierType: "EAN13",
  unitMultiplier: 1,
};

const carton: IdentifierDto = { ...unit, id: 2, unitMultiplier: 80 };

function card(over: Partial<Card> = {}): Card {
  return {
    clientTxnId: "11111111-1111-4111-8111-111111111111",
    product,
    identifier: unit,
    qtyText: "1",
    fresh: true,
    uom: "PCS",
    reason: null,
    ...over,
  };
}

function session(): TxResult["session"] {
  return {
    id: 1,
    sessionNumber: 1,
    operatorId: 1,
    operatorName: "Alex",
    startedAt: "2026-09-10T00:00:00.000Z",
    lastActivityAt: "2026-09-10T00:00:00.000Z",
    txCount: 1,
    productCount: 1,
    totalUnits: 3,
    netChange: -3,
    byOperation: [],
  };
}

describe("scanReducer", () => {
  it("MODE switches uom when a card is open", () => {
    const withCard: ScanState = { ...INITIAL_SCAN, view: { kind: "card", card: card() } };
    const adj = scanReducer(withCard, { type: "MODE", mode: "ADJUSTMENT" });
    expect(adj.mode).toBe("ADJUSTMENT");
    expect(adj.view.kind === "card" && adj.view.card.uom).toBe("COUNT");
    expect(adj.view.kind === "card" && adj.view.card.qtyText).toBe("");
    const back = scanReducer(adj, { type: "MODE", mode: "SALE" });
    expect(back.view.kind === "card" && back.view.card.uom).toBe("PCS");
    expect(back.view.kind === "card" && back.view.card.qtyText).toBe("1");
  });

  it("SCAN from idle goes resolving", () => {
    const next = scanReducer(INITIAL_SCAN, { type: "SCAN", code: "123" });
    expect(next.view).toEqual({ kind: "resolving", code: "123" });
  });

  it("SCAN from card discards the previous card", () => {
    const start: ScanState = { ...INITIAL_SCAN, view: { kind: "card", card: card() } };
    const next = scanReducer(start, { type: "SCAN", code: "999" });
    expect(next.view).toEqual({ kind: "resolving", code: "999" });
    expect(next.discarded?.card.clientTxnId).toBe(card().clientTxnId);
  });

  it("RESOLVED FOUND opens a card, unknown/inactive/quickScan as specified", () => {
    const resolving: ScanState = { ...INITIAL_SCAN, view: { kind: "resolving", code: "x" } };
    const found = scanReducer(resolving, {
      type: "RESOLVED",
      clientTxnId: "cid",
      result: { kind: "FOUND", card: product, identifier: unit },
    });
    expect(found.view.kind).toBe("card");
    expect(found.view.kind === "card" && found.view.card.qtyText).toBe("1");
    expect(found.view.kind === "card" && found.view.card.fresh).toBe(true);

    const unknown = scanReducer(resolving, {
      type: "RESOLVED",
      clientTxnId: "cid",
      result: { kind: "UNKNOWN", code: "x" },
    });
    expect(unknown.view).toEqual({ kind: "unknown", code: "x" });

    const quick = scanReducer(resolving, {
      type: "RESOLVED",
      clientTxnId: "cid",
      quickScan: true,
      result: { kind: "FOUND", card: product, identifier: unit },
    });
    expect(quick.view.kind).toBe("committing");
  });

  it("CHAR digits replace when fresh then append", () => {
    let s: ScanState = { ...INITIAL_SCAN, view: { kind: "card", card: card({ qtyText: "1", fresh: true }) } };
    s = scanReducer(s, { type: "CHAR", char: "3" });
    expect(s.view.kind === "card" && s.view.card.qtyText).toBe("3");
    s = scanReducer(s, { type: "CHAR", char: "0" });
    expect(s.view.kind === "card" && s.view.card.qtyText).toBe("30");
  });

  it("plus minus and arrows change qty", () => {
    let s: ScanState = { ...INITIAL_SCAN, view: { kind: "card", card: card({ qtyText: "1", fresh: false }) } };
    s = scanReducer(s, { type: "CHAR", char: "+" });
    expect(s.view.kind === "card" && s.view.card.qtyText).toBe("2");
    s = scanReducer(s, { type: "KEY", key: "ArrowDown" });
    expect(s.view.kind === "card" && s.view.card.qtyText).toBe("1");
  });

  it("Backspace deletes the last digit", () => {
    const s = scanReducer(
      { ...INITIAL_SCAN, view: { kind: "card", card: card({ qtyText: "12", fresh: false }) } },
      { type: "KEY", key: "Backspace" },
    );
    expect(s.view.kind === "card" && s.view.card.qtyText).toBe("1");
  });

  it("Tab toggles PCS/CTN unless carton barcode or adjustment", () => {
    let s: ScanState = { ...INITIAL_SCAN, view: { kind: "card", card: card() } };
    s = scanReducer(s, { type: "KEY", key: "Tab" });
    expect(s.view.kind === "card" && s.view.card.uom).toBe("CTN");
    const locked = scanReducer(
      { ...INITIAL_SCAN, view: { kind: "card", card: card({ identifier: carton }) } },
      { type: "KEY", key: "Tab" },
    );
    expect(locked.view.kind === "card" && locked.view.card.uom).toBe("PCS");
  });

  it("Enter validates qty and reason then commits", () => {
    const empty = scanReducer(
      { ...INITIAL_SCAN, view: { kind: "card", card: card({ qtyText: "" }) } },
      { type: "KEY", key: "Enter" },
    );
    expect(empty.view.kind === "card" && empty.view.errorCode).toBe("INVALID_QUANTITY");
    const adj: ScanState = {
      ...INITIAL_SCAN,
      mode: "ADJUSTMENT",
      view: { kind: "card", card: card({ uom: "COUNT", qtyText: "44", reason: null }) },
    };
    const need = scanReducer(adj, { type: "KEY", key: "Enter" });
    expect(need.view.kind === "card" && need.view.errorCode).toBe("NEED_REASON");
    const ready = scanReducer(adj, { type: "SET_REASON", reason: "COUNT_CORRECTION" });
    const go = scanReducer(ready, { type: "KEY", key: "Enter" });
    expect(go.view.kind).toBe("committing");
  });

  it("Escape returns to idle", () => {
    const s = scanReducer(
      { ...INITIAL_SCAN, view: { kind: "unknown", code: "x" } },
      { type: "KEY", key: "Escape" },
    );
    expect(s.view.kind).toBe("idle");
  });

  it("commit ok / needs ack / err / pulse", () => {
    const committing: ScanState = {
      ...INITIAL_SCAN,
      view: { kind: "committing", card: card(), acknowledged: false },
    };
    const result: TxResult = {
      transactionId: 1,
      clientTxnId: card().clientTxnId,
      operation: "SALE",
      quantityChange: -3,
      stockBefore: 46,
      stockAfter: 43,
      negativeWarning: false,
      session: session(),
      createdAt: "2026-09-10T00:00:00.000Z",
      idempotentReplay: false,
      wasExported: false,
    };
    const ok = scanReducer(committing, { type: "COMMIT_OK", result });
    expect(ok.view.kind).toBe("success");
    const idle = scanReducer(ok, { type: "PULSE_DONE" });
    expect(idle.view.kind).toBe("idle");
    const ack = scanReducer(committing, { type: "COMMIT_NEEDS_ACK", stockBefore: 2, stockAfter: -3 });
    expect(ack.view.kind).toBe("needsAck");
    const retry = scanReducer(ack, { type: "KEY", key: "Enter" });
    expect(retry.view.kind === "committing" && retry.view.acknowledged).toBe(true);
    const err = scanReducer(committing, { type: "COMMIT_ERR", code: "PREVIEW_STALE" });
    expect(err.view.kind === "card" && err.view.errorCode).toBe("PREVIEW_STALE");
  });

  it("RESTORE_DISCARDED puts the card back", () => {
    const c = card();
    const s = scanReducer(
      { ...INITIAL_SCAN, discarded: { card: c, at: 1 }, view: { kind: "unknown", code: "x" } },
      { type: "RESTORE_DISCARDED" },
    );
    expect(s.view.kind === "card" && s.view.card).toEqual(c);
    expect(s.discarded).toBeNull();
  });

  it("preview computes sale change", () => {
    expect(preview(card({ qtyText: "3" }), "SALE")).toEqual({
      change: -3,
      before: 46,
      after: 43,
      negative: false,
    });
  });
});
