import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Check,
  Keyboard,
  Minus,
  Plus,
  TriangleAlert,
} from "lucide-react";
import clsx from "clsx";
import { Button } from "../../components/Button";
import { EmptyState } from "../../components/EmptyState";
import { Kbd } from "../../components/Kbd";
import type { Lang } from "../../i18n";
import type { ReasonCode } from "../../bindings/ReasonCode";
import type { TxRow } from "../../bindings/TxRow";
import { errorMessage } from "../../lib/errors";
import { fmtAsOfDate, fmtCartonSplit, fmtQty, fmtRupiah, fmtTime } from "../../lib/format";
import { MODE_STYLE } from "../../lib/modes";
import { preview, type Card, type Mode } from "./scanReducer";
import { useScanController } from "./useScanController";

const MODES: Mode[] = ["STOCK_IN", "SALE", "RETURN", "ADJUSTMENT"];
const REASONS: ReasonCode[] = ["COUNT_CORRECTION", "DAMAGED", "DATA_MISMATCH", "OTHER"];

export function ScanPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.slice(0, 2) as Lang) || "en";
  const nav = useNavigate();
  const c = useScanController();
  const { state, dispatch } = c;
  const style = MODE_STYLE[state.mode];

  return (
    <div className="flex flex-1 flex-col min-h-0 -mx-6 -my-[22px]">
      <div className="flex flex-1 gap-6 px-6 pt-[22px] min-h-0">
        <div className="flex-1 flex flex-col gap-3.5 min-w-0">
          <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("scan.currentMode")}</div>
          <div className="grid grid-cols-4 gap-3">
            {MODES.map((mode) => {
              const m = MODE_STYLE[mode];
              const Icon = m.icon;
              const on = state.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => dispatch({ type: "MODE", mode })}
                  className={clsx(
                    "h-20 rounded-xl border flex items-center gap-3.5 px-4 text-left",
                    on ? clsx(m.bg, "text-white border-transparent shadow-md") : "bg-surface border-line",
                  )}
                >
                  <div
                    className={clsx(
                      "w-[42px] h-[42px] rounded-[10px] flex items-center justify-center shrink-0",
                      on ? "bg-white/18" : m.tint,
                    )}
                  >
                    <Icon className={clsx("w-[22px] h-[22px]", on ? "text-white" : m.fg)} strokeWidth={2} />
                  </div>
                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <div className="text-lg font-bold tracking-wide">{t(`mode.${mode}.label`)}</div>
                    <div className={clsx("text-[13px] truncate", on ? "text-white/90" : "text-sub")}>
                      {t(`mode.${mode}.secondary`)} · {t(`mode.${mode}.hint`)}
                    </div>
                  </div>
                  <Kbd invert={on}>{m.key}</Kbd>
                </button>
              );
            })}
          </div>

          <div className="h-[52px] shrink-0 bg-surface border border-line rounded-xl flex items-center gap-4 px-4">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-ok shadow-[0_0_0_4px_#D1FAE5]" />
              <span className="text-sm font-semibold">{t("scan.scannerReady")}</span>
            </div>
            {c.lastCode ? (
              <>
                <div className="w-px h-[22px] bg-line" />
                <div className="flex items-center gap-2.5 text-[13px]">
                  <span className="text-sub">{t("scan.lastScan")}</span>
                  <span className="font-mono text-sm font-medium">{c.lastCode}</span>
                </div>
              </>
            ) : null}
            <div className="flex-1" />
            <button type="button" className="flex items-center gap-2 text-[13px] text-sub" onClick={() => c.setManualOpen(true)}>
              <Keyboard className="w-[18px] h-[18px]" strokeWidth={1.75} />
              {t("scan.manual")}
            </button>
          </div>

          {c.state.discarded ? (
            <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-warn-tint border border-warn-line text-[13px]">
              <span>{t("scan.discarded")}</span>
              <button type="button" className="font-semibold" onClick={() => dispatch({ type: "RESTORE_DISCARDED" })}>
                {t("scan.restore")}
              </button>
            </div>
          ) : null}

          <div className="flex-1 min-h-0 overflow-auto">
            <MainPane
              lang={lang}
              mode={state.mode}
              style={style}
              view={state.view}
              dispatch={dispatch}
              onLinkUnknown={(code) => nav(`/settings/barcodes?code=${encodeURIComponent(code)}`)}
            />
          </div>
        </div>

        <aside className="w-[360px] shrink-0 flex-col gap-4 hidden min-[1400px]:flex">
          <RecentList rows={c.recent} sessionNumber={c.session?.sessionNumber ?? null} lang={lang} />
          <Shortcuts />
        </aside>
      </div>

      <footer className="h-16 shrink-0 bg-surface border-t border-line flex items-center gap-5 px-6 mt-auto">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[15px] font-semibold">
            {c.session ? t("scan.session", { n: c.session.sessionNumber }) : t("scan.noSession")}
          </span>
          {c.session ? (
            <span className="text-[13px] text-sub">
              {c.session.operatorName} · {fmtTime(c.session.startedAt, lang)}
            </span>
          ) : null}
        </div>
        {c.session ? (
          <>
            <div className="w-px h-6 bg-line" />
            <div className="flex gap-5 text-[13px] text-sub">
              <span>
                <b className="font-mono text-ink font-semibold">{c.session.txCount}</b> {t("scan.txCount")}
              </span>
              <span>
                <b className="font-mono text-ink font-semibold">{fmtQty(c.session.totalUnits, lang)}</b> {t("common.pcs")}
              </span>
              <span>
                <b className="font-mono text-ink font-semibold">{c.session.productCount}</b> {t("scan.productCount")}
              </span>
              <span>
                <b className="font-mono text-ink font-semibold">{fmtQty(c.session.netChange, lang)}</b> {t("scan.net")}
              </span>
            </div>
          </>
        ) : null}
        <div className="flex-1" />
        <Button variant="ghost" onClick={() => void c.undo()}>
          {t("scan.undo")}
          <Kbd>Ctrl+Z</Kbd>
        </Button>
        <Button onClick={() => void c.finish()}>{t("scan.finish")}</Button>
      </footer>

      {c.manualOpen ? (
        <ManualDialog
          onClose={() => c.setManualOpen(false)}
          onSubmit={(code) => c.submitManual(code)}
        />
      ) : null}
    </div>
  );
}

function MainPane({
  lang,
  mode,
  style,
  view,
  dispatch,
  onLinkUnknown,
}: {
  lang: Lang;
  mode: Mode;
  style: (typeof MODE_STYLE)[Mode];
  view: ReturnType<typeof useScanController>["state"]["view"];
  dispatch: ReturnType<typeof useScanController>["dispatch"];
  onLinkUnknown: (code: string) => void;
}) {
  const { t } = useTranslation();
  if (view.kind === "idle" || view.kind === "resolving") {
    return (
      <div className="bg-surface border border-line rounded-card p-8">
        <EmptyState title={t("scan.waiting")} hint={view.kind === "resolving" ? t("scan.resolving") : t("scan.waitingHint")} />
      </div>
    );
  }
  if (view.kind === "unknown") {
    return (
      <div className="bg-surface border border-line rounded-card p-8 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-warn font-semibold">
          <TriangleAlert className="w-5 h-5" />
          {t("scan.unknownTitle")}
        </div>
        <div className="font-mono text-2xl font-semibold">{view.code}</div>
        <p className="text-sm text-sub">{t("scan.unknownHint")}</p>
        <div className="flex gap-2">
          <Button onClick={() => onLinkUnknown(view.code)}>{t("scan.linkNow")}</Button>
          <Button variant="ghost" onClick={() => dispatch({ type: "KEY", key: "Escape" })}>
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    );
  }
  if (view.kind === "inactive") {
    return (
      <div className="bg-surface border border-line rounded-card p-8">
        <div className="text-lg font-semibold">{t("scan.inactiveTitle")}</div>
        <p className="text-sm text-sub mt-2">{t("scan.inactiveHint", { name: view.productName })}</p>
      </div>
    );
  }
  if (view.kind === "success") {
    return (
      <div className="bg-ok-tint border border-ok-line rounded-card p-10 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-ok text-white flex items-center justify-center">
          <Check className="w-8 h-8" strokeWidth={2.5} />
        </div>
        <div className="font-mono text-[34px] font-semibold num">
          {fmtQty(view.result.stockBefore, lang)} → {fmtQty(view.result.stockAfter, lang)}
        </div>
        <div className="text-sm text-sub">{t("scan.pulseDone")}</div>
      </div>
    );
  }
  if (view.kind === "needsAck") {
    return (
      <div className="bg-surface border border-warn-line rounded-card overflow-hidden">
        <ProductBlock card={view.card} lang={lang} />
        <div className="m-5 p-5 rounded-xl bg-warn-tint border border-warn-line flex items-center gap-4">
          <TriangleAlert className="w-8 h-8 text-warn shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">{t("scan.negativeTitle")}</div>
            <p className="text-[13px] text-sub mt-1">
              {t("scan.negativeHint", { before: view.stockBefore, after: view.stockAfter })}
            </p>
          </div>
          <Button variant="danger" onClick={() => dispatch({ type: "KEY", key: "Enter" })}>
            {t("scan.continueAnyway")}
            <Kbd invert>Enter</Kbd>
          </Button>
        </div>
      </div>
    );
  }

  const card = view.card;
  const p = preview(card, mode);
  const carton = card.identifier && card.identifier.unitMultiplier > 1;
  const Icon = style.icon;
  const err = view.kind === "card" ? view.errorCode : undefined;

  return (
    <div className="bg-surface border border-line rounded-card flex flex-col">
      <ProductBlock card={card} lang={lang} />
      <div className="grid grid-cols-2 gap-9 px-7 py-5 border-t border-line">
        <div className="flex flex-col gap-3">
          <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("scan.stock")}</div>
          <div className="flex items-end gap-3.5">
            <Stat label={t("inventory.accurateBaseline")} value={fmtQty(card.product.baselineQuantity, lang)} hint={card.product.baselineAsOf ? fmtAsOfDate(card.product.baselineAsOf, lang) : ""} muted />
            <span className="font-mono text-[22px] text-faint pb-5">−</span>
            <Stat
              label={t("inventory.liveChange")}
              value={fmtQty(card.product.currentQuantity - card.product.baselineQuantity, lang)}
              hint="StockScan"
              muted
            />
            <span className="font-mono text-[22px] text-faint pb-5">=</span>
            <Stat
              label={t("inventory.currentStock")}
              value={fmtQty(card.product.currentQuantity, lang)}
              hint={fmtCartonSplit(card.product.currentQuantity, card.product.packSize, t) ?? ""}
              big
            />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("scan.qty")}</div>
            {mode !== "ADJUSTMENT" && !carton ? (
              <div className="inline-flex p-0.5 rounded-[10px] bg-soft gap-0.5">
                {(["PCS", "CTN"] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => dispatch({ type: "KEY", key: "Tab" })}
                    className={clsx(
                      "h-[34px] px-4 rounded-lg text-sm font-semibold",
                      card.uom === u ? "bg-surface shadow-sm" : "text-sub",
                    )}
                  >
                    {u} {u === "PCS" ? t("common.pcs") : t("common.ctn")}
                  </button>
                ))}
              </div>
            ) : carton ? (
              <span className="text-[13px] text-sub">{t("scan.cartonCode", { n: card.identifier?.unitMultiplier })}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2.5">
            <button type="button" className="w-[60px] h-[60px] rounded-xl border border-line bg-surface flex items-center justify-center" onClick={() => dispatch({ type: "CHAR", char: "-" })}>
              <Minus className="w-[22px] h-[22px]" />
            </button>
            <div className={clsx("flex-1 h-[60px] border-2 rounded-xl flex items-center justify-center gap-2 font-mono text-[34px] font-semibold", style.line)}>
              {card.qtyText || "0"}
              <span className="text-[15px] font-medium text-sub">{card.uom === "CTN" ? t("common.ctn") : t("common.pcs")}</span>
            </div>
            <button type="button" className="w-[60px] h-[60px] rounded-xl border border-line bg-surface flex items-center justify-center" onClick={() => dispatch({ type: "CHAR", char: "+" })}>
              <Plus className="w-[22px] h-[22px]" />
            </button>
          </div>
          <div className="text-[13px] text-sub">{t("scan.typeQty")}</div>
          {mode === "ADJUSTMENT" ? (
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => dispatch({ type: "SET_REASON", reason: r })}
                  className={clsx(
                    "h-8 px-3 rounded-lg text-xs font-semibold border",
                    card.reason === r ? "bg-ink text-white border-ink" : "border-line text-sub",
                  )}
                >
                  {t(`scan.reason.${r}`)}
                </button>
              ))}
            </div>
          ) : null}
          {err ? <div className="text-[13px] text-neg">{errorMessage({ code: err, message: err }, t)}</div> : null}
        </div>
      </div>
      <div className={clsx("mx-5 mb-5 p-4 rounded-xl border flex items-center gap-6", p.negative ? "bg-warn-tint border-warn-line" : clsx(style.tint, style.line))}>
        <div className="flex items-center gap-3 min-w-[190px]">
          <div className={clsx("w-[42px] h-[42px] rounded-[10px] flex items-center justify-center", style.bg)}>
            <Icon className="w-[22px] h-[22px] text-white" />
          </div>
          <div className="flex flex-col">
            <span className={clsx("text-[19px] font-bold tracking-wide", style.fg)}>
              {t(`mode.${mode}.label`)} {p.change > 0 ? "+" : ""}
              {p.change}
            </span>
            <span className="text-xs text-sub">{t(`mode.${mode}.secondary`)}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center gap-3.5 font-mono text-[34px] font-semibold num">
          <span className="text-sub">{fmtQty(p.before, lang)}</span>
          <span className="text-faint text-2xl">→</span>
          <span>{fmtQty(p.after, lang)}</span>
        </div>
        <Button className={clsx(style.bg, "text-white border-transparent")} onClick={() => dispatch({ type: "KEY", key: "Enter" })}>
          {t("scan.confirmOp", { op: t(`mode.${mode}.label`) })}
          <Kbd invert>Enter</Kbd>
        </Button>
      </div>
    </div>
  );
}

function ProductBlock({ card, lang }: { card: Card; lang: Lang }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-6 px-7 pt-[22px] pb-5">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold text-ok bg-ok-tint border border-ok-line">
            <Check className="w-3 h-3" strokeWidth={2.5} />
            {t("scan.found")}
          </span>
        </div>
        <div className="text-2xl font-semibold tracking-tight">{card.product.name}</div>
        <div className="flex gap-5 text-[13px] text-sub">
          {card.product.modelCode ? (
            <span>
              {t("scan.model")} <span className="text-ink font-medium">{card.product.modelCode}</span>
            </span>
          ) : null}
          {card.identifier ? (
            <span>
              {t("scan.barcode")} <span className="font-mono text-ink">{card.identifier.code}</span>
            </span>
          ) : null}
          <span>
            {t("scan.refPrice")} <span className="text-ink">{fmtRupiah(card.product.referencePrice, lang)}</span>
          </span>
        </div>
      </div>
      {card.product.packSize ? (
        <div className="px-3.5 py-2.5 rounded-[10px] bg-soft shrink-0">
          <div className="text-xs text-sub">ISI</div>
          <div className="text-[15px] font-semibold">{card.product.packSize} {t("common.pcs")}</div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  muted,
  big,
}: {
  label: string;
  value: string;
  hint: string;
  muted?: boolean;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-sub whitespace-nowrap">{label}</span>
      <span className={clsx("font-mono leading-tight font-medium num", big ? "text-[44px] font-semibold" : "text-[26px]", muted && "text-sub")}>
        {value}
      </span>
      <span className="text-xs text-faint whitespace-nowrap">{hint}</span>
    </div>
  );
}

function RecentList({ rows, sessionNumber, lang }: { rows: TxRow[]; sessionNumber: number | null; lang: Lang }) {
  const { t } = useTranslation();
  return (
    <div className="bg-surface border border-line rounded-card overflow-hidden">
      <div className="flex justify-between items-center px-[18px] py-4">
        <span className="text-[15px] font-semibold">{t("scan.recent")}</span>
        <span className="text-xs text-sub">{sessionNumber != null ? t("scan.session", { n: sessionNumber }) : ""}</span>
      </div>
      {rows.length === 0 ? (
        <div className="px-[18px] pb-4 text-[13px] text-sub">{t("scan.noRecent")}</div>
      ) : (
        rows.map((row) => {
          const st = MODE_STYLE[row.operation as Mode] ?? MODE_STYLE.SALE;
          const Icon = st.icon;
          return (
            <div key={row.id} className="flex items-center gap-3 px-[18px] py-3 border-t border-soft">
              <div className={clsx("w-[34px] h-[34px] rounded-lg flex items-center justify-center shrink-0", st.tint)}>
                <Icon className={clsx("w-[17px] h-[17px]", st.fg)} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{row.modelCode ?? row.productName}</div>
                <div className="text-xs text-sub">
                  {row.operation} · {row.inputQuantity} {row.inputUom.toLowerCase()} · {fmtTime(row.createdAt, lang)}
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className={clsx("font-mono text-[15px] font-semibold", st.fg)}>
                  {row.quantityChange > 0 ? "+" : ""}
                  {row.quantityChange}
                </span>
                <span className="font-mono text-xs text-sub">
                  {row.stockBefore} → {row.stockAfter}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function Shortcuts() {
  const { t } = useTranslation();
  const rows = [
    [t("scan.shortcutMode"), "F1 – F4"],
    [t("scan.shortcutQty"), "+ / −"],
    [t("scan.shortcutUom"), "Tab"],
    [t("scan.shortcutConfirm"), "Enter"],
    [t("scan.shortcutCancel"), "Esc"],
    [t("scan.undo"), "Ctrl+Z"],
  ];
  return (
    <div className="bg-surface border border-line rounded-card p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-[15px] font-semibold">
        <Keyboard className="w-[18px] h-[18px] text-sub" />
        {t("scan.shortcuts")}
      </div>
      {rows.map(([label, key]) => (
        <div key={label} className="flex justify-between text-[13px] text-sub">
          <span>{label}</span>
          <Kbd>{key}</Kbd>
        </div>
      ))}
    </div>
  );
}

function ManualDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (code: string) => void }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  return (
    <div className="fixed inset-0 z-40 bg-ink/30 flex items-center justify-center" onClick={onClose}>
      <form
        className="bg-surface rounded-card p-6 w-[420px] flex flex-col gap-3 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) onSubmit(code.trim());
        }}
      >
        <div className="text-lg font-semibold">{t("scan.manualTitle")}</div>
        <p className="text-[13px] text-sub">{t("scan.manualHint")}</p>
        <input
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-11 px-3 border border-line rounded-[10px] font-mono"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit">{t("common.confirm")}</Button>
        </div>
      </form>
    </div>
  );
}
