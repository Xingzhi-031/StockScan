import { useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Download, Search, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { qk } from "../../app/queryClient";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import type { Lang } from "../../i18n";
import type { InventoryRow } from "../../bindings/InventoryRow";
import { api } from "../../lib/api";
import { fmtAsOfDate, fmtKoli, fmtQty, fmtSigned, fmtUpdated } from "../../lib/format";
import {
  chipCounts,
  filterInventory,
  INVENTORY_CHIPS,
  liveDelta,
  parseChip,
  type InventoryChip,
} from "./filter";
import { ProductDrawer } from "./ProductDrawer";

const COLS = "grid-cols-[minmax(0,1fr)_112px_60px_92px_84px_96px_80px_72px]";

export function InventoryPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.slice(0, 2) as Lang) || "en";
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const chip = parseChip(params.get("filter"));
  const productId = Number(params.get("product") ?? "") || null;
  const list = useQuery({ queryKey: qk.inventory, queryFn: api.listInventory });
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const now = useMemo(() => new Date(), [list.dataUpdatedAt]);
  const rows = list.data ?? [];
  const visible = useMemo(() => filterInventory(rows, query, chip, now), [rows, query, chip, now]);
  const counts = useMemo(() => chipCounts(rows, now), [rows, now]);
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 58,
    overscan: 16,
  });

  function setQuery(next: string) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next) p.set("q", next);
      else p.delete("q");
      return p;
    });
  }

  function setChip(next: InventoryChip) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      if (next === "all") p.delete("filter");
      else p.set("filter", next);
      return p;
    });
  }

  function openProduct(id: number) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("product", String(id));
      return p;
    });
  }

  function closeProduct() {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete("product");
      return p;
    });
  }

  const warehouse = startup.data?.activeLocation?.name ?? "—";
  const asOf = rows.find((r) => r.baselineAsOf)?.baselineAsOf;

  return (
    <div className="relative -mx-6 -my-[22px] flex flex-1 min-h-0">
      <div className="flex-1 min-w-0 flex flex-col gap-4 p-6">
        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t("inventory.title")}</h1>
            <p className="text-[13px] text-sub">
              {warehouse}
              {rows.length ? ` · ${t("inventory.subtitle", { count: fmtQty(rows.length, lang) })}` : ""}
              {asOf ? ` · ${t("inventory.baselineFrom", { date: fmtAsOfDate(asOf, lang) })}` : ""}
            </p>
          </div>
          <Button variant="ghost" disabled title={t("common.comingSoon")}>
            <Download className="w-[18px] h-[18px]" strokeWidth={2} />
            {t("inventory.export")}
          </Button>
        </div>

        <label className="h-11 bg-surface border border-line rounded-[10px] flex items-center gap-2.5 px-3.5">
          <Search className="w-[18px] h-[18px] text-sub shrink-0" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("inventory.search")}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-faint"
          />
        </label>

        <div className="flex gap-2 flex-wrap">
          {INVENTORY_CHIPS.map((id) => {
            const active = chip === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setChip(id)}
                className={clsx(
                  "h-[34px] px-3 rounded-full flex items-center gap-2 text-[13px] whitespace-nowrap border",
                  active
                    ? "bg-ink text-white border-ink font-semibold"
                    : "bg-surface text-ink border-line font-medium",
                )}
              >
                {t(`inventory.chip.${id}`)}
                <span className={clsx("font-mono text-xs", active ? "text-white/70" : "text-sub")}>
                  {fmtQty(counts[id], lang)}
                </span>
              </button>
            );
          })}
        </div>

        {rows.length === 0 ? (
          <EmptyState title={t("inventory.title")} hint={t("inventory.empty")} />
        ) : (
          <div className="flex-1 min-h-0 bg-surface border border-line rounded-[14px] overflow-hidden flex flex-col">
            <div className={clsx("grid gap-3 items-center h-[42px] px-5 shrink-0", COLS)}>
              <div className="text-xs font-semibold text-sub">{t("inventory.colProduct")}</div>
              <div className="text-xs font-semibold text-sub">{t("inventory.colBarcode")}</div>
              <div className="text-xs font-semibold text-sub text-right">{t("inventory.colIsi")}</div>
              <div className="text-xs font-semibold text-sub text-right">{t("inventory.colBaseline")}</div>
              <div className="text-xs font-semibold text-sub text-right">{t("inventory.colDelta")}</div>
              <div className="text-xs font-semibold text-sub text-right">{t("inventory.colCurrent")}</div>
              <div className="text-xs font-semibold text-sub text-right">{t("inventory.colCartons")}</div>
              <div className="text-xs font-semibold text-sub text-right">{t("inventory.colUpdated")}</div>
            </div>
            <div ref={parentRef} className="flex-1 min-h-0 overflow-auto">
              <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
                {virtualizer.getVirtualItems().map((item) => {
                  const row = visible[item.index];
                  return (
                    <div
                      key={row.productId}
                      className="absolute left-0 right-0"
                      style={{ height: item.size, transform: `translateY(${item.start}px)` }}
                    >
                      <InventoryLine
                        row={row}
                        lang={lang}
                        now={now}
                        selected={row.productId === productId}
                        onOpen={() => openProduct(row.productId)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-line text-xs text-sub shrink-0">
              {t("inventory.footer", {
                shown: fmtQty(visible.length, lang),
                total: fmtQty(rows.length, lang),
              })}
            </div>
          </div>
        )}
      </div>

      {productId ? (
        <>
          <button
            type="button"
            className="hidden max-[1399px]:block absolute inset-0 bg-ink/20 z-10"
            onClick={closeProduct}
            aria-label={t("common.close")}
          />
          <ProductDrawer productId={productId} onClose={closeProduct} />
        </>
      ) : null}
    </div>
  );
}

function InventoryLine({
  row,
  lang,
  now,
  selected,
  onOpen,
}: {
  row: InventoryRow;
  lang: Lang;
  now: Date;
  selected: boolean;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const delta = liveDelta(row);
  const negative = row.currentQuantity < 0;
  const linked = row.barcodeCount > 0;
  const stamp = row.lastChangedAt ?? (row.baselineAsOf ? `${row.baselineAsOf}T00:00:00+07:00` : null);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={clsx(
        "grid gap-3 items-center h-[58px] px-5 w-full text-left border-t border-soft",
        COLS,
        selected ? "bg-hi" : "bg-surface hover:bg-soft/60",
      )}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-semibold truncate">{row.modelCode ?? row.name}</span>
        <span className="text-xs text-sub truncate">{row.name}</span>
      </div>
      <div>
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 text-[13px]",
            linked ? "text-ink" : "text-warn font-semibold",
          )}
        >
          <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", linked ? "bg-ok" : "bg-warn")} />
          {linked ? t("inventory.linked") : t("inventory.unlinked")}
        </span>
      </div>
      <div className="font-mono text-[13px] text-right text-sub num">{row.packSize ?? "—"}</div>
      <div className="font-mono text-[13px] text-right text-sub num">{fmtQty(row.baselineQuantity, lang)}</div>
      <div className={clsx("font-mono text-[13px] text-right num", delta === 0 ? "text-faint" : "text-ink")}>
        {delta === 0 ? "0" : fmtSigned(delta, lang)}
      </div>
      <div
        className={clsx(
          "font-mono text-[15px] font-semibold text-right num flex items-center justify-end gap-1.5",
          negative ? "text-neg" : "text-ink",
        )}
      >
        {negative ? <TriangleAlert className="w-3.5 h-3.5" strokeWidth={2} /> : null}
        {fmtQty(row.currentQuantity, lang)}
      </div>
      <div className="font-mono text-[13px] text-right text-sub num">
        {fmtKoli(row.currentQuantity, row.packSize, lang)}
      </div>
      <div className="text-xs text-right text-sub">{fmtUpdated(stamp, now, lang)}</div>
    </button>
  );
}
