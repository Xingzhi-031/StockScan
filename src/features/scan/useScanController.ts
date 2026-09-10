import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invalidateAfterStockChange, qk } from "../../app/queryClient";
import type { RouterEvent } from "../../scanner/ScanRouter";
import { useScanner } from "../../scanner/useScanner";
import { api } from "../../lib/api";
import { toAppError } from "../../lib/errors";
import { sounds } from "../../lib/sound";
import { newId } from "../../lib/uuid";
import { useOperatorStore } from "../../stores/operatorStore";
import {
  INITIAL_SCAN,
  scanReducer,
  toCommitInput,
  type Mode,
  type ScanAction,
} from "./scanReducer";

const FKEYS: Record<string, Mode> = {
  F1: "STOCK_IN",
  F2: "SALE",
  F3: "RETURN",
  F4: "ADJUSTMENT",
};

export function useScanController() {
  const operator = useOperatorStore((s) => s.operator);
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: qk.settings, queryFn: api.getSettings });
  const [state, dispatch] = useReducer(scanReducer, INITIAL_SCAN);
  const [manualOpen, setManualOpen] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const cfg = settings.data?.scanner;
  const fkeys = settings.data?.scan.fkeysEnabled ?? true;
  const quickScan = settings.data?.scan.quickScanEnabled ?? false;

  const session = useQuery({
    queryKey: qk.session(operator?.id ?? 0),
    queryFn: () => api.getCurrentSession(operator!.id),
    enabled: !!operator,
  });
  const recent = useQuery({
    queryKey: ["transactions", "session", session.data?.id ?? 0],
    queryFn: () => api.listTransactions({ sessionId: session.data!.id, limit: 10 }),
    enabled: !!session.data?.id,
  });

  useEffect(() => {
    if (state.view.kind !== "resolving") return;
    const code = state.view.code;
    let cancelled = false;
    api
      .resolveBarcode(code)
      .then((result) => {
        if (cancelled) return;
        if (result.kind === "UNKNOWN" || result.kind === "PRODUCT_INACTIVE") sounds.unknown();
        dispatch({ type: "RESOLVED", result, clientTxnId: newId(), quickScan });
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: "RESOLVE_ERR", code: "NOT_FOUND" });
      });
    return () => {
      cancelled = true;
    };
  }, [state.view, quickScan]);

  useEffect(() => {
    if (state.view.kind !== "committing" || !operator) return;
    const { card, acknowledged } = state.view;
    const mode = state.mode;
    let cancelled = false;
    api
      .commitTransaction(toCommitInput(card, mode, operator.id, acknowledged, "SCAN"))
      .then((result) => {
        if (cancelled) return;
        sounds.success();
        dispatch({ type: "COMMIT_OK", result });
        invalidateAfterStockChange(qc, card.product.productId);
      })
      .catch((e) => {
        if (cancelled) return;
        const err = toAppError(e);
        if (err.code === "NEEDS_ACK") {
          sounds.warning();
          const stockBefore = Number(err.details?.stockBefore ?? 0);
          const stockAfter = Number(err.details?.stockAfter ?? 0);
          dispatch({ type: "COMMIT_NEEDS_ACK", stockBefore, stockAfter });
        } else {
          dispatch({ type: "COMMIT_ERR", code: err.code });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [state.view, state.mode, operator, qc]);

  useEffect(() => {
    if (state.view.kind !== "success") return;
    const t = window.setTimeout(() => dispatch({ type: "PULSE_DONE" }), 1000);
    return () => window.clearTimeout(t);
  }, [state.view]);

  const onEvent = useCallback(
    (e: RouterEvent) => {
      const view = stateRef.current.view;
      if (e.type === "scan") {
        setLastCode(e.code);
        if (view.kind === "card" || view.kind === "needsAck") sounds.warning();
        dispatch({ type: "SCAN", code: e.code });
        return;
      }
      if (e.type === "char") {
        dispatch({ type: "CHAR", char: e.char });
        return;
      }
      if (e.key in FKEYS) {
        if (fkeys) dispatch({ type: "MODE", mode: FKEYS[e.key] });
        return;
      }
      dispatch({ type: "KEY", key: e.key });
    },
    [fkeys],
  );

  useScanner(!manualOpen, cfg, onEvent);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // undo is stable enough via refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operator?.id]);

  async function undo() {
    if (!operator) return;
    try {
      const result = await api.undoLast(operator.id, newId());
      invalidateAfterStockChange(qc, 0);
      void qc.invalidateQueries({ queryKey: qk.inventory });
      return result;
    } catch {
      return null;
    }
  }

  async function finish() {
    if (!operator) return;
    await api.finishSession(operator.id);
    void qc.invalidateQueries({ queryKey: qk.session(operator.id) });
    void qc.invalidateQueries({ queryKey: ["transactions"] });
  }

  function submitManual(code: string) {
    setManualOpen(false);
    setLastCode(code);
    dispatch({ type: "SCAN", code });
  }

  const dispatchSafe = (a: ScanAction) => dispatch(a);

  return {
    state,
    dispatch: dispatchSafe,
    lastCode,
    manualOpen,
    setManualOpen,
    submitManual,
    session: session.data ?? null,
    recent: recent.data?.rows ?? [],
    undo,
    finish,
    fkeys,
  };
}
