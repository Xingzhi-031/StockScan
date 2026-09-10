import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { History, Link2, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { qk, invalidateAfterStockChange } from "../../app/queryClient";
import { Button } from "../../components/Button";
import type { Lang } from "../../i18n";
import type { ReasonCode } from "../../bindings/ReasonCode";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { fmtAsOfDate, fmtCartonSplit, fmtKoli, fmtQty, fmtRupiah, fmtSigned } from "../../lib/format";
import { newId } from "../../lib/uuid";
import { useOperatorStore } from "../../stores/operatorStore";
import { useNavigate } from "react-router";

export function ProductDrawer({ productId, onClose }: { productId: number; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.slice(0, 2) as Lang) || "en";
  const nav = useNavigate();
  const qc = useQueryClient();
  const operator = useOperatorStore((s) => s.operator);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [count, setCount] = useState("");
  const [reason, setReason] = useState<ReasonCode>("COUNT_CORRECTION");
  const [ack, setAck] = useState(false);
  const [adjustErr, setAdjustErr] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: qk.product(productId),
    queryFn: () => api.getProductDetail(productId),
  });
  const row = detail.data;
  const delta = row ? row.currentQuantity - row.baselineQuantity : 0;
  const split = row ? fmtCartonSplit(row.currentQuantity, row.packSize, t) : null;

  return (
    <aside
      className={clsx(
        "w-[440px] shrink-0 bg-surface border-l border-line flex flex-col min-h-0 relative",
        "max-[1399px]:absolute max-[1399px]:inset-y-0 max-[1399px]:right-0 max-[1399px]:z-20 max-[1399px]:shadow-xl",
      )}
    >
      {!row ? (
        <div className="p-6 text-sm text-sub">{detail.isError ? t("errors.NOT_FOUND") : "…"}</div>
      ) : (
        <>
          <div className="px-6 pt-[22px] pb-[18px] flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("inventory.drawerTitle")}</div>
              <button type="button" onClick={onClose} className="text-sub" aria-label={t("common.close")}>
                <X className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </button>
            </div>
            <div className="text-xl font-semibold">{row.name}</div>
            <div className="text-[13px] text-sub">
              {row.modelCode ? `${t("inventory.model")} ${row.modelCode} · ` : ""}
              {t("nav.warehouse")} {row.locationName}
            </div>
          </div>

          <div className="px-6 pb-[18px] flex items-baseline gap-2.5">
            <span className="font-mono text-[44px] font-semibold leading-none num">
              {fmtQty(row.currentQuantity, lang)}
            </span>
            <span className="text-[15px] text-sub">
              {t("common.pcs")}
              {split ? ` · ${split}` : ""}
            </span>
          </div>

          <div className="px-6 flex flex-col">
            <Fact
              label={t("inventory.accurateBaseline")}
              hint={row.baselineAsOf ? t("inventory.importedOn", { date: fmtAsOfDate(row.baselineAsOf, lang) }) : t("inventory.imported")}
              value={fmtQty(row.baselineQuantity, lang)}
            />
            <Fact
              label={t("inventory.liveChange")}
              hint={t("inventory.calculated")}
              value={delta === 0 ? "0" : fmtSigned(delta, lang)}
            />
            <Fact
              label={t("inventory.currentStock")}
              hint={t("inventory.calculated")}
              value={fmtQty(row.currentQuantity, lang)}
            />
            <Fact
              label={t("inventory.cartonEq")}
              hint={row.packSize ? t("inventory.derivedIsi", { isi: row.packSize }) : t("inventory.noIsi")}
              value={fmtKoli(row.currentQuantity, row.packSize, lang)}
            />
            <Fact
              label={t("inventory.refPrice")}
              hint={t("inventory.importedHarga")}
              value={fmtRupiah(row.referencePrice, lang)}
            />
          </div>

          <div className="px-6 pt-5 flex flex-col gap-2.5 min-h-0 overflow-auto">
            <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("inventory.barcodes")}</div>
            {row.identifiers.length === 0 ? (
              <p className="text-[13px] text-sub">{t("inventory.noBarcodes")}</p>
            ) : (
              row.identifiers.map((id) => (
                <div
                  key={id.id}
                  className="flex items-center justify-between px-3.5 py-3 border border-line rounded-[10px]"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-mono text-[15px] font-medium truncate">{id.code}</span>
                    <span className="text-xs text-sub">
                      {id.identifierType}
                      {id.unitMultiplier > 1 ? ` · ×${id.unitMultiplier}` : ""}
                    </span>
                  </div>
                  <span className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />
                </div>
              ))
            )}
            <span className="flex items-center gap-2 text-[13px] font-semibold text-sub">
              <span className="text-lg leading-none">+</span>
              {t("inventory.linkBarcodeLater")}
            </span>
          </div>

          <div className="flex-1" />

          <div className="px-6 py-4 border-t border-line flex gap-2">
            <Button variant="ghost" onClick={() => { setAdjustOpen(true); setCount(String(row.currentQuantity)); setAck(false); setAdjustErr(null); }}>
              <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={2} />
              {t("inventory.adjust")}
            </Button>
            <Button variant="ghost" onClick={() => nav(`/settings/barcodes`)}>
              <Link2 className="w-[18px] h-[18px]" strokeWidth={2} />
              {t("inventory.barcodes")}
            </Button>
            <Button variant="ghost" disabled className="border-transparent text-sub" title={t("common.comingSoon")}>
              <History className="w-[18px] h-[18px]" strokeWidth={2} />
              {t("inventory.history")}
            </Button>
          </div>
          {adjustOpen ? (
            <div className="absolute inset-0 bg-surface/95 p-6 flex flex-col gap-3 z-10">
              <div className="text-lg font-semibold">{t("inventory.adjust")}</div>
              <input
                value={count}
                onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))}
                className="h-11 px-3 border border-line rounded-[10px] font-mono text-xl"
              />
              <select value={reason} onChange={(e) => setReason(e.target.value as ReasonCode)} className="h-10 border border-line rounded-[10px] px-2">
                <option value="COUNT_CORRECTION">{t("scan.reason.COUNT_CORRECTION")}</option>
                <option value="DAMAGED">{t("scan.reason.DAMAGED")}</option>
                <option value="DATA_MISMATCH">{t("scan.reason.DATA_MISMATCH")}</option>
                <option value="OTHER">{t("scan.reason.OTHER")}</option>
              </select>
              {adjustErr ? <div className="text-sm text-neg">{adjustErr}</div> : null}
              <div className="flex gap-2 mt-auto">
                <Button variant="ghost" onClick={() => setAdjustOpen(false)}>{t("common.cancel")}</Button>
                <Button
                  disabled={!operator}
                  onClick={async () => {
                    if (!operator) return;
                    try {
                      await api.commitTransaction({
                        clientTxnId: newId(),
                        operatorId: operator.id,
                        productId: row.productId,
                        identifierCode: null,
                        operation: "ADJUSTMENT",
                        inputQuantity: Number(count || 0),
                        inputUom: "COUNT",
                        reasonCode: reason,
                        returnDisposition: null,
                        acknowledgeNegative: ack,
                        source: "PRODUCT_PANEL",
                        notes: null,
                      });
                      invalidateAfterStockChange(qc, row.productId);
                      setAdjustOpen(false);
                    } catch (e) {
                      const err = e as { code?: string; details?: { stockBefore?: number; stockAfter?: number } };
                      if (err.code === "NEEDS_ACK") {
                        setAck(true);
                        setAdjustErr(t("errors.NEEDS_ACK"));
                      } else {
                        setAdjustErr(errorMessage(e, t));
                      }
                    }
                  }}
                >
                  {t("common.confirm")}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </aside>
  );
}

function Fact({ label, hint, value }: { label: string; hint: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-t border-soft">
      <span className="text-[13px] text-sub">{label}</span>
      <span className="flex items-center gap-2.5">
        <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-soft text-sub whitespace-nowrap">{hint}</span>
        <span className="text-sm font-semibold">{value}</span>
      </span>
    </div>
  );
}
