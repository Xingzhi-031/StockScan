import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { qk } from "../../app/queryClient";
import { Button } from "../../components/Button";
import type { BarcodeImportPreview } from "../../bindings/BarcodeImportPreview";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { useOperatorStore } from "../../stores/operatorStore";

export function BarcodeImportPage() {
  const { t } = useTranslation();
  const operator = useOperatorStore((s) => s.operator);
  const qc = useQueryClient();
  const [preview, setPreview] = useState<BarcodeImportPreview | null>(null);
  const [onlyUnlinked, setOnlyUnlinked] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<string | null>(null);

  async function exportTemplate() {
    setError(null);
    const path = await api.pickSavePath("barcode-template.xlsx");
    if (!path) return;
    try {
      const r = await api.exportBarcodeTemplate(path, onlyUnlinked);
      setExported(r.path);
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  async function chooseFile() {
    setError(null);
    const path = await api.pickBarcodeMap();
    if (!path || !operator) return;
    try {
      setPreview(await api.previewBarcodeImport(path, operator.id));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  const apply = useMutation({
    mutationFn: () => api.applyBarcodeImport(preview!.importId, operator!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.coverage });
      void qc.invalidateQueries({ queryKey: qk.inventory });
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="text-2xl font-semibold">{t("barcodes.importTitle")}</div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={onlyUnlinked} onChange={(e) => setOnlyUnlinked(e.target.checked)} />
        {t("barcodes.onlyUnlinked")}
      </label>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => void exportTemplate()}>
          {t("barcodes.exportTemplate")}
        </Button>
        <Button onClick={() => void chooseFile()}>{t("barcodes.importMap")}</Button>
      </div>
      {exported ? <p className="text-sm text-sub">{exported}</p> : null}
      {error ? <p className="text-sm text-neg">{error}</p> : null}
      {preview ? (
        <div className="bg-surface border border-line rounded-card p-4 flex flex-col gap-3">
          <div className="text-sm">
            {preview.fileName} · {t("barcodes.linked")} {preview.linked} · {t("barcodes.skipped")} {preview.skipped} ·{" "}
            {t("barcodes.conflicts")} {preview.conflicts}
          </div>
          <div className="max-h-80 overflow-auto text-[13px]">
            {preview.lines.slice(0, 80).map((line, i) => (
              <div key={i} className="flex justify-between gap-3 py-1 border-t border-soft">
                <span className="truncate">{line.productName}</span>
                <span className="text-sub shrink-0">{line.status}</span>
              </div>
            ))}
          </div>
          <Button disabled={!preview.canApply || apply.isPending} onClick={() => apply.mutate()}>
            {t("common.confirm")}
          </Button>
          {apply.data ? (
            <p className="text-sm text-ok">
              {t("barcodes.linked")} {apply.data.linked}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
