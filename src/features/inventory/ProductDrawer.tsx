import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { History, Link2, SlidersHorizontal, X } from "lucide-react";
import clsx from "clsx";
import { qk } from "../../app/queryClient";
import { Button } from "../../components/Button";
import type { Lang } from "../../i18n";
import { api } from "../../lib/api";
import { fmtAsOfDate, fmtCartonSplit, fmtKoli, fmtQty, fmtRupiah, fmtSigned } from "../../lib/format";

export function ProductDrawer({ productId, onClose }: { productId: number; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.slice(0, 2) as Lang) || "en";
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
        "w-[440px] shrink-0 bg-surface border-l border-line flex flex-col min-h-0",
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
            <Button variant="ghost" disabled title={t("common.comingSoon")}>
              <SlidersHorizontal className="w-[18px] h-[18px]" strokeWidth={2} />
              {t("inventory.adjust")}
            </Button>
            <Button variant="ghost" disabled title={t("common.comingSoon")}>
              <Link2 className="w-[18px] h-[18px]" strokeWidth={2} />
              {t("inventory.barcodes")}
            </Button>
            <Button variant="ghost" disabled className="border-transparent text-sub" title={t("common.comingSoon")}>
              <History className="w-[18px] h-[18px]" strokeWidth={2} />
              {t("inventory.history")}
            </Button>
          </div>
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
