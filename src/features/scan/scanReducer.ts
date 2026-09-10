import type { IdentifierDto } from "../../bindings/IdentifierDto";
import type { ProductCard } from "../../bindings/ProductCard";
import type { ReasonCode } from "../../bindings/ReasonCode";
import type { ResolveResult } from "../../bindings/ResolveResult";
import type { TxResult } from "../../bindings/TxResult";

export type Mode = "STOCK_IN" | "SALE" | "RETURN" | "ADJUSTMENT";
export type Uom = "PCS" | "CTN" | "COUNT";

export type Card = {
  clientTxnId: string;
  product: ProductCard;
  identifier: IdentifierDto | null;
  qtyText: string;
  fresh: boolean;
  uom: Uom;
  reason: ReasonCode | null;
};

export type View =
  | { kind: "idle" }
  | { kind: "resolving"; code: string }
  | { kind: "card"; card: Card; errorCode?: string }
  | { kind: "needsAck"; card: Card; stockBefore: number; stockAfter: number }
  | { kind: "committing"; card: Card; acknowledged: boolean }
  | { kind: "success"; result: TxResult; product: ProductCard }
  | { kind: "unknown"; code: string }
  | { kind: "inactive"; code: string; productName: string };

export type ScanState = {
  mode: Mode;
  view: View;
  discarded: { card: Card; at: number } | null;
};

export type ScanAction =
  | { type: "MODE"; mode: Mode }
  | { type: "SCAN"; code: string }
  | { type: "RESOLVED"; result: ResolveResult; clientTxnId: string; quickScan?: boolean }
  | { type: "RESOLVE_ERR"; code: string }
  | { type: "CHAR"; char: string }
  | { type: "KEY"; key: string }
  | { type: "SET_REASON"; reason: ReasonCode }
  | { type: "COMMIT_OK"; result: TxResult }
  | { type: "COMMIT_NEEDS_ACK"; stockBefore: number; stockAfter: number }
  | { type: "COMMIT_ERR"; code: string }
  | { type: "PULSE_DONE" }
  | { type: "RESTORE_DISCARDED" };

export const INITIAL_SCAN: ScanState = {
  mode: "SALE",
  view: { kind: "idle" },
  discarded: null,
};

const MAX_QTY_LEN = 7;

function cartonLocked(card: Card): boolean {
  return !!card.identifier && card.identifier.unitMultiplier > 1;
}

function defaultUom(mode: Mode, identifier: IdentifierDto | null): Uom {
  if (mode === "ADJUSTMENT") return "COUNT";
  if (identifier && identifier.unitMultiplier > 1) return "PCS";
  return "PCS";
}

function defaultQty(mode: Mode): string {
  return mode === "ADJUSTMENT" ? "" : "1";
}

function clampQty(text: string, mode: Mode): string {
  const n = Number(text);
  if (!Number.isFinite(n)) return mode === "ADJUSTMENT" ? "0" : "1";
  const min = mode === "ADJUSTMENT" ? 0 : 1;
  return String(Math.max(min, Math.trunc(n)));
}

function withCard(state: ScanState, card: Card, errorCode?: string): ScanState {
  return { ...state, view: { kind: "card", card, errorCode } };
}

function currentCard(view: View): Card | null {
  if (view.kind === "card" || view.kind === "needsAck" || view.kind === "committing") return view.card;
  return null;
}

function applyModeToCard(card: Card, from: Mode, to: Mode): Card {
  if (to === "ADJUSTMENT") {
    return { ...card, uom: "COUNT", qtyText: "", fresh: true, reason: card.reason };
  }
  if (from === "ADJUSTMENT") {
    return {
      ...card,
      uom: cartonLocked(card) ? "PCS" : "PCS",
      qtyText: "1",
      fresh: true,
      reason: null,
    };
  }
  return card;
}

function enterFromScan(state: ScanState, code: string): ScanState {
  const view = state.view;
  if (view.kind === "card" || view.kind === "needsAck") {
    return {
      ...state,
      view: { kind: "resolving", code },
      discarded: { card: view.card, at: Date.now() },
    };
  }
  if (
    view.kind === "idle" ||
    view.kind === "unknown" ||
    view.kind === "inactive" ||
    view.kind === "success"
  ) {
    return { ...state, view: { kind: "resolving", code } };
  }
  return state;
}

function bump(card: Card, mode: Mode, delta: number): Card {
  const cur = Number(card.qtyText || (mode === "ADJUSTMENT" ? "0" : "1"));
  const min = mode === "ADJUSTMENT" ? 0 : 1;
  const next = Math.max(min, (Number.isFinite(cur) ? Math.trunc(cur) : min) + delta);
  return { ...card, qtyText: String(next), fresh: false };
}

export function scanReducer(state: ScanState, action: ScanAction): ScanState {
  switch (action.type) {
    case "MODE": {
      const card = currentCard(state.view);
      if (card && (state.view.kind === "card" || state.view.kind === "needsAck")) {
        return {
          ...state,
          mode: action.mode,
          view: { kind: "card", card: applyModeToCard(card, state.mode, action.mode) },
        };
      }
      return { ...state, mode: action.mode };
    }
    case "SCAN":
      return enterFromScan(state, action.code);
    case "RESOLVED": {
      if (state.view.kind !== "resolving") return state;
      const r = action.result;
      if (r.kind === "UNKNOWN") return { ...state, view: { kind: "unknown", code: r.code } };
      if (r.kind === "PRODUCT_INACTIVE") {
        return { ...state, view: { kind: "inactive", code: r.code, productName: r.productName } };
      }
      const card: Card = {
        clientTxnId: action.clientTxnId,
        product: r.card,
        identifier: r.identifier,
        qtyText: defaultQty(state.mode),
        fresh: true,
        uom: defaultUom(state.mode, r.identifier),
        reason: null,
      };
      if (action.quickScan && state.mode !== "ADJUSTMENT") {
        return { ...state, view: { kind: "committing", card, acknowledged: false } };
      }
      return withCard(state, card);
    }
    case "RESOLVE_ERR":
      if (state.view.kind !== "resolving") return state;
      return { ...state, view: { kind: "idle" } };
    case "CHAR": {
      if (state.view.kind !== "card") return state;
      const { card } = state.view;
      if (action.char === "+") return withCard(state, bump(card, state.mode, 1));
      if (action.char === "-") return withCard(state, bump(card, state.mode, -1));
      if (!/^\d$/.test(action.char)) return state;
      const next = card.fresh ? action.char : `${card.qtyText}${action.char}`;
      if (next.length > MAX_QTY_LEN) return state;
      return withCard(state, { ...card, qtyText: next, fresh: false });
    }
    case "KEY": {
      if (action.key === "Escape") {
        if (
          state.view.kind === "card" ||
          state.view.kind === "needsAck" ||
          state.view.kind === "unknown" ||
          state.view.kind === "inactive"
        ) {
          return { ...state, view: { kind: "idle" } };
        }
        return state;
      }
      if (state.view.kind === "needsAck" && action.key === "Enter") {
        return { ...state, view: { kind: "committing", card: state.view.card, acknowledged: true } };
      }
      if (state.view.kind !== "card") return state;
      const { card } = state.view;
      if (action.key === "ArrowUp") return withCard(state, bump(card, state.mode, 1));
      if (action.key === "ArrowDown") return withCard(state, bump(card, state.mode, -1));
      if (action.key === "Backspace") {
        return withCard(state, { ...card, qtyText: card.qtyText.slice(0, -1), fresh: false });
      }
      if (action.key === "Tab") {
        if (state.mode === "ADJUSTMENT" || cartonLocked(card) || !card.product.packSize) return state;
        const uom: Uom = card.uom === "CTN" ? "PCS" : "CTN";
        return withCard(state, { ...card, uom });
      }
      if (action.key === "Enter") {
        const qty = Number(card.qtyText);
        if (state.mode !== "ADJUSTMENT" && (!card.qtyText || qty <= 0)) {
          return withCard(state, card, "INVALID_QUANTITY");
        }
        if (state.mode === "ADJUSTMENT" && (card.qtyText === "" || !Number.isFinite(qty))) {
          return withCard(state, card, "INVALID_QUANTITY");
        }
        if (state.mode === "ADJUSTMENT" && !card.reason) {
          return withCard(state, card, "NEED_REASON");
        }
        return { ...state, view: { kind: "committing", card, acknowledged: false } };
      }
      return state;
    }
    case "SET_REASON": {
      if (state.view.kind !== "card") return state;
      return withCard(state, { ...state.view.card, reason: action.reason });
    }
    case "COMMIT_OK": {
      if (state.view.kind !== "committing") return state;
      return {
        ...state,
        discarded: null,
        view: {
          kind: "success",
          result: action.result,
          product: {
            ...state.view.card.product,
            currentQuantity: action.result.stockAfter,
          },
        },
      };
    }
    case "COMMIT_NEEDS_ACK": {
      if (state.view.kind !== "committing") return state;
      return {
        ...state,
        view: {
          kind: "needsAck",
          card: state.view.card,
          stockBefore: action.stockBefore,
          stockAfter: action.stockAfter,
        },
      };
    }
    case "COMMIT_ERR": {
      if (state.view.kind !== "committing") return state;
      return withCard(state, state.view.card, action.code);
    }
    case "PULSE_DONE":
      if (state.view.kind !== "success") return state;
      return { ...state, view: { kind: "idle" } };
    case "RESTORE_DISCARDED": {
      if (!state.discarded) return state;
      return { ...state, view: { kind: "card", card: state.discarded.card }, discarded: null };
    }
    default:
      return state;
  }
}

export function preview(card: Card, mode: Mode) {
  const q = Number(card.qtyText || 0);
  const cur = card.product.currentQuantity;
  const m =
    card.identifier && card.identifier.unitMultiplier > 1
      ? card.identifier.unitMultiplier
      : card.uom === "CTN"
        ? (card.product.packSize ?? 0)
        : 1;
  const change = mode === "ADJUSTMENT" ? q - cur : mode === "SALE" ? -q * m : q * m;
  return { change, before: cur, after: cur + change, negative: change < 0 && cur + change < 0 };
}

export function parsedQty(card: Card): number {
  return Number(clampQty(card.qtyText || (card.uom === "COUNT" ? "0" : "1"), card.uom === "COUNT" ? "ADJUSTMENT" : "SALE"));
}

export function toCommitInput(
  card: Card,
  mode: Mode,
  operatorId: number,
  acknowledged: boolean,
  source: "SCAN" | "MANUAL_CODE" | "PRODUCT_PANEL" = "SCAN",
) {
  return {
    clientTxnId: card.clientTxnId,
    operatorId,
    productId: card.product.productId,
    identifierCode: card.identifier?.code ?? null,
    operation: mode,
    inputQuantity: Number(card.qtyText || 0),
    inputUom: card.uom,
    reasonCode: card.reason,
    returnDisposition: mode === "RETURN" ? ("SELLABLE" as const) : null,
    acknowledgeNegative: acknowledged,
    source,
    notes: null,
  };
}
