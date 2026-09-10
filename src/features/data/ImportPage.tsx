import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Check, FileText, TriangleAlert } from "lucide-react";
import clsx from "clsx";
import { qk } from "../../app/queryClient";
import { Button } from "../../components/Button";
import { Kbd } from "../../components/Kbd";
import type { Lang } from "../../i18n";
import type { StockReportPreview } from "../../bindings/StockReportPreview";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { fmtAsOfDate, fmtAsOfDateTime, fmtQty } from "../../lib/format";
import { useOperatorStore } from "../../stores/operatorStore";
import {
  barcodeCheck,
  baselineCheck,
  columnStatus,
  dateCheck,
  fieldKey,
  formatLabel,
  importableCount,
  koliCheck,
  type CheckTone,
} from "./importPreview";

type Step = 1 | 2 | 3 | 4;

function stepOf(preview: StockReportPreview | null, loading: boolean, applied: boolean): Step {
  if (applied) return 4;
  if (preview) return 3;
  if (loading) return 2;
  return 1;
}

function fileNameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

function CheckRow({ tone, children }: { tone: CheckTone; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-[13px] leading-[1.45]">
      {tone === "ok" ? (
        <Check className="w-[18px] h-[18px] text-ok shrink-0" strokeWidth={2.25} />
      ) : (
        <TriangleAlert
          className={clsx("w-[18px] h-[18px] shrink-0", tone === "error" ? "text-neg" : "text-warn")}
          strokeWidth={2}
        />
      )}
      <span>{children}</span>
    </div>
  );
}

function StatusPill({ status }: { status: ReturnType<typeof columnStatus> }) {
  const { t } = useTranslation();
  if (status === "mapped") {
    return (
      <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold text-ok bg-ok-tint border border-ok-line">
        <Check className="w-3 h-3" strokeWidth={2.5} />
        {t("import.statusMapped")}
      </span>
    );
  }
  if (status === "confirm") {
    return (
      <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold text-warn bg-warn-tint border border-warn-line">
        {t("import.statusConfirm")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-xs font-semibold text-sub bg-soft border border-line">
      {t("import.statusOptional")}
    </span>
  );
}

export function ImportPage() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language.slice(0, 2) as Lang) || "en";
  const qc = useQueryClient();
  const navigate = useNavigate();
  const operator = useOperatorStore((s) => s.operator);
  const [preview, setPreview] = useState<StockReportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const previewMut = useMutation({
    mutationFn: (path: string) => {
      if (!operator) throw new Error("no operator");
      return api.previewStockReport(path, operator.id, "BASELINE");
    },
    onSuccess: (data) => {
      setPreview(data);
      setError(null);
      setApplied(false);
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  const applyMut = useMutation({
    mutationFn: () => {
      if (!operator || !preview) throw new Error("no preview");
      return api.applyBaselineImport(preview.importId, operator.id);
    },
    onSuccess: () => {
      setApplied(true);
      setError(null);
      void qc.invalidateQueries({ queryKey: qk.inventory });
      void qc.invalidateQueries({ queryKey: qk.exceptionsCount });
      navigate("/inventory");
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  async function chooseFile() {
    setError(null);
    try {
      const path = await api.pickStockReport();
      if (!path) return;
      previewMut.mutate(path);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  async function writeSample() {
    setError(null);
    try {
      const path = await api.devWriteSampleReport(1284);
      previewMut.mutate(path);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  async function cancel() {
    if (preview) {
      try {
        await api.cancelImport(preview.importId);
      } catch {
        /* preview may already be gone */
      }
    }
    setPreview(null);
    setError(null);
    setApplied(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLButtonElement
      ) {
        return;
      }
      if (preview?.canApply && !applyMut.isPending) {
        e.preventDefault();
        applyMut.mutate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [preview, applyMut]);

  const step = stepOf(preview, previewMut.isPending, applied);
  const baseline = preview ? baselineCheck(preview) : null;
  const n = preview ? importableCount(preview) : 0;

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between gap-4 shrink-0">
        <h1 className="text-2xl font-semibold tracking-tight">{t("import.title")}</h1>
        <ol className="flex items-center gap-3 text-[13px]">
          {(
            [
              [1, "import.stepChoose"],
              [2, "import.stepDetect"],
              [3, "import.stepReview"],
              [4, "import.stepImport"],
            ] as const
          ).map(([nStep, key], i) => (
            <li key={key} className="flex items-center gap-3">
              {i > 0 ? <span className="w-9 h-px bg-line" /> : null}
              <span className="flex items-center gap-2">
                <span
                  className={clsx(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                    step > nStep && "bg-ok text-white",
                    step === nStep && "bg-ink text-white",
                    step < nStep && "bg-soft text-sub",
                  )}
                >
                  {step > nStep ? <Check className="w-[13px] h-[13px]" strokeWidth={2.5} /> : nStep}
                </span>
                <span className={clsx(step === nStep ? "font-semibold text-ink" : "font-medium text-sub")}>
                  {t(key)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      {!preview ? (
        <div className="rounded-[14px] border border-line bg-surface">
          <div className="flex items-center gap-3.5 px-5 py-4">
            <div className="w-[42px] h-[42px] rounded-[10px] bg-soft flex items-center justify-center">
              <FileText className="w-[22px] h-[22px]" strokeWidth={1.75} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold">{t("import.chooseHint")}</div>
              <div className="text-[13px] text-sub">{t("import.chooseSub")}</div>
            </div>
            <Button onClick={() => void chooseFile()} disabled={previewMut.isPending}>
              {t("import.chooseFile")}
            </Button>
            {import.meta.env.DEV ? (
              <Button variant="ghost" onClick={() => void writeSample()} disabled={previewMut.isPending}>
                {t("import.writeSample")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="rounded-[14px] border border-line bg-surface">
            <div className="flex items-center gap-3.5 px-5 py-4">
              <div className="w-[42px] h-[42px] rounded-[10px] bg-soft flex items-center justify-center">
                <FileText className="w-[22px] h-[22px]" strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold truncate">{fileNameOf(preview.fileName)}</span>
                <span className="text-[13px] text-sub truncate">
                  {t("import.accurateReport")}
                  {preview.reportName ? ` · ${preview.reportName}` : ""}
                  {` · ${formatLabel(preview.fileFormat)}`}
                </span>
              </div>
              <Button variant="ghost" onClick={() => void chooseFile()}>
                {t("import.chooseAnother")}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-0">
            <section className="rounded-[14px] border border-line bg-surface">
              <div className="px-5 py-4 flex flex-col">
                <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("import.detected")}</div>
                <div className="h-1.5" />
                <DetectedRow label={t("import.company")} value={preview.companyName ?? "—"} />
                <DetectedRow
                  label={t("import.warehouseCol")}
                  value={
                    preview.stockColumnCandidates.length > 1 ? (
                      <select
                        value={preview.stockColumn}
                        onChange={(e) => {
                          void api
                            .setReportOptions(preview.importId, { stockColumn: e.target.value })
                            .then(setPreview)
                            .catch((err) => setError(errorMessage(err, t)));
                        }}
                        className="h-8 px-2 rounded-lg border border-line bg-surface text-sm font-semibold"
                      >
                        {preview.stockColumnCandidates.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    ) : (
                      preview.stockColumn
                    )
                  }
                />
                <DetectedRow
                  label={t("import.asOf")}
                  value={preview.asOfDate ? fmtAsOfDate(preview.asOfDate, lang) : t("import.missingDate")}
                />
                <DetectedRow
                  label={t("import.printed")}
                  value={preview.printedAt ? fmtAsOfDateTime(preview.printedAt, lang) : "—"}
                />
                <DetectedRow label={t("import.productsFound")} value={fmtQty(preview.counts.dataRows, lang)} />
              </div>
            </section>

            <section className="rounded-[14px] border border-line bg-surface">
              <div className="px-5 py-4 flex flex-col gap-3.5">
                <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("import.checks")}</div>
                {(() => {
                  const check = dateCheck(preview);
                  return (
                    <CheckRow tone={check.tone}>
                      {t(`import.issue.${check.kind}`)}
                    </CheckRow>
                  );
                })()}
                {(() => {
                  const check = koliCheck(preview);
                  return (
                    <CheckRow tone={check.tone}>
                      {t(`import.issue.${check.kind}`)}
                    </CheckRow>
                  );
                })()}
                {(() => {
                  const check = barcodeCheck(preview);
                  return (
                    <CheckRow tone={check.tone}>
                      <span>
                        {check.kind === "NO_BARCODE_COLUMN" ? (
                          <>
                            <b>{t("import.issue.NO_BARCODE_COLUMN_TITLE")}</b> {t("import.issue.NO_BARCODE_COLUMN")}
                          </>
                        ) : (
                          t(`import.issue.${check.kind}`)
                        )}
                      </span>
                    </CheckRow>
                  );
                })()}
                <CheckRow tone="ok">{t("import.issue.BACKUP_OK")}</CheckRow>
                {baseline ? (
                  <CheckRow tone={baseline.tone}>{t("errors.BASELINE_EXISTS")}</CheckRow>
                ) : null}
              </div>
            </section>
          </div>

          <section className="rounded-[14px] border border-line bg-surface overflow-hidden">
            <div className="px-5 pt-3.5 pb-2">
              <div className="text-xs font-semibold tracking-wider uppercase text-sub">{t("import.mapping")}</div>
            </div>
            <div className="grid grid-cols-[170px_44px_minmax(0,1fr)_230px_170px] gap-3 items-center h-9 px-5">
              <div className="text-xs font-semibold text-sub">{t("import.reportColumn")}</div>
              <div />
              <div className="text-xs font-semibold text-sub">{t("import.field")}</div>
              <div className="text-xs font-semibold text-sub">{t("import.firstRow")}</div>
              <div className="text-xs font-semibold text-sub">{t("import.status")}</div>
            </div>
            {preview.columns.map((col) => (
              <div
                key={`${col.source}-${col.target}`}
                className="grid grid-cols-[170px_44px_minmax(0,1fr)_230px_170px] gap-3 items-center h-[46px] px-5 border-t border-soft"
              >
                <span className="font-mono text-[13px] font-medium truncate">{col.source}</span>
                <ArrowRight className="w-4 h-4 text-faint" strokeWidth={1.75} />
                <span className="text-sm truncate">
                  {t(fieldKey(col.target), { warehouse: preview.stockColumn })}
                </span>
                <span className="text-[13px] text-sub truncate">
                  {col.firstValue ?? t("import.notInFile")}
                </span>
                <div>
                  <StatusPill status={columnStatus(col)} />
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {error ? <p className="text-sm text-neg shrink-0">{error}</p> : null}

      <div className="flex-1" />

      <div className="flex items-center justify-end gap-2.5 shrink-0">
        <Button variant="ghost" onClick={() => void cancel()} disabled={!preview && !error}>
          {t("common.cancel")}
        </Button>
        {preview && baseline ? (
          <Button onClick={() => navigate("/data/reconcile")}>{t("import.goReconcile")}</Button>
        ) : (
          <Button
            onClick={() => applyMut.mutate()}
            disabled={!preview?.canApply || applyMut.isPending}
          >
            {t("import.importBaseline", { count: fmtQty(n, lang) })}
            <Kbd invert>Enter</Kbd>
          </Button>
        )}
      </div>
    </div>
  );
}

function DetectedRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-t border-soft">
      <span className="text-[13px] text-sub">{label}</span>
      <span className="text-sm font-semibold text-right">{value}</span>
    </div>
  );
}
