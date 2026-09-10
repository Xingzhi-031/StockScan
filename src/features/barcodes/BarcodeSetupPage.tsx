import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import clsx from "clsx";
import { qk } from "../../app/queryClient";
import { Button } from "../../components/Button";
import type { BarcodeKind } from "../../bindings/BarcodeKind";
import type { CheckBarcodeResult } from "../../bindings/CheckBarcodeResult";
import type { ProductCard } from "../../bindings/ProductCard";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { useScanner } from "../../scanner/useScanner";
import { useOperatorStore } from "../../stores/operatorStore";

export function BarcodeSetupPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const preset = params.get("code") ?? "";
  const operator = useOperatorStore((s) => s.operator);
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: qk.settings, queryFn: api.getSettings });
  const coverage = useQuery({ queryKey: qk.coverage, queryFn: api.getBarcodeCoverage });
  const inventory = useQuery({ queryKey: qk.inventory, queryFn: api.listInventory });
  const recent = useQuery({ queryKey: ["barcodes", "recent"], queryFn: () => api.listRecentLinks(15) });
  const [product, setProduct] = useState<ProductCard | null>(null);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<CheckBarcodeResult | null>(null);
  const [code, setCode] = useState(preset);
  const [kind, setKind] = useState<BarcodeKind>("UNIT");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.nextUnlinkedProduct(null).then((p) => {
      if (p) setProduct(p);
    });
  }, []);

  useScanner(true, settings.data?.scanner, (e) => {
    if (e.type !== "scan") return;
    void onCode(e.code);
  });

  async function onCode(raw: string) {
    setError(null);
    setCode(raw);
    try {
      setPending(await api.checkBarcode(raw));
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  const link = useMutation({
    mutationFn: async () => {
      if (!product || !operator || !code) throw new Error("missing");
      return api.linkBarcode({
        productId: product.productId,
        code,
        kind,
        unitMultiplier: kind === "CARTON" ? product.packSize : 1,
        operatorId: operator.id,
      });
    },
    onSuccess: async () => {
      setPending(null);
      setCode("");
      void qc.invalidateQueries({ queryKey: qk.coverage });
      void qc.invalidateQueries({ queryKey: qk.inventory });
      void qc.invalidateQueries({ queryKey: ["barcodes", "recent"] });
      const next = await api.nextUnlinkedProduct(product?.productId ?? null);
      setProduct(next);
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  const matches = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return [];
    return (inventory.data ?? [])
      .filter((r) => r.name.toLowerCase().includes(s) || (r.modelCode ?? "").toLowerCase().includes(s))
      .slice(0, 8);
  }, [inventory.data, query]);

  const cov = coverage.data;
  const pct = cov && cov.products ? Math.round((cov.linked / cov.products) * 1000) / 10 : 0;

  useEffect(() => {
    if (preset) void onCode(preset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  return (
    <div className="flex flex-col gap-4 min-h-0 h-full">
      <div>
        <div className="text-[13px] text-sub">{t("barcodes.crumb")}</div>
        <div className="text-2xl font-semibold tracking-tight">{t("barcodes.headline")}</div>
      </div>
      <div className="bg-surface border border-line rounded-card px-6 py-[18px] flex items-center gap-12">
        <Metric label={t("barcodes.products")} value={cov?.products ?? 0} />
        <Metric label={t("barcodes.linked")} value={cov?.linked ?? 0} tone="ok" />
        <Metric label={t("barcodes.unlinked")} value={cov?.unlinked ?? 0} tone="warn" />
        <div className="flex-1 flex flex-col gap-2">
          <div className="flex justify-between text-[13px]">
            <span className="text-sub">{t("barcodes.coverage")}</span>
            <span className="font-mono font-semibold">{pct}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-soft overflow-hidden">
            <div className="h-full bg-ok rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_320px] gap-4">
        <div className="bg-surface border border-line rounded-card p-5 flex flex-col gap-4 min-h-0">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("barcodes.search")}
              className="flex-1 h-10 px-3 border border-line rounded-[10px] text-sm"
            />
            <Button variant="ghost" onClick={() => void api.nextUnlinkedProduct(product?.productId ?? null).then(setProduct)}>
              {t("barcodes.next")}
            </Button>
          </div>
          {matches.length > 0 ? (
            <div className="border border-line rounded-[10px] overflow-hidden">
              {matches.map((row) => (
                <button
                  key={row.productId}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm border-t border-soft first:border-t-0 hover:bg-soft"
                  onClick={() => {
                    setProduct({
                      productId: row.productId,
                      name: row.name,
                      modelCode: row.modelCode,
                      packSize: row.packSize,
                      referencePrice: row.referencePrice,
                      locationId: 1,
                      baselineQuantity: row.baselineQuantity,
                      currentQuantity: row.currentQuantity,
                      baselineAsOf: row.baselineAsOf,
                    });
                    setQuery("");
                  }}
                >
                  {row.name}
                </button>
              ))}
            </div>
          ) : null}

          {product ? (
            <div className="flex flex-col gap-1">
              <div className="text-lg font-semibold">{product.name}</div>
              <div className="text-[13px] text-sub">
                {product.modelCode ? `${t("scan.model")} ${product.modelCode} · ` : ""}
                ISI {product.packSize ?? "—"}
              </div>
            </div>
          ) : (
            <p className="text-sm text-sub">{t("barcodes.noProduct")}</p>
          )}

          <div className="font-mono text-xl font-semibold min-h-[32px]">{code || t("barcodes.scanToLink")}</div>
          {pending ? (
            <div className={clsx("text-sm font-semibold", pending.available ? "text-ok" : "text-neg")}>
              {pending.available
                ? t("barcodes.available")
                : t("barcodes.inUse", { name: pending.usedBy?.name ?? "" })}
              {pending.checkDigitValid === false ? ` · ${t("barcodes.checkDigitBad")}` : ""}
            </div>
          ) : null}
          {error ? <div className="text-sm text-neg">{error}</div> : null}

          <div className="flex gap-2">
            {(["UNIT", "CARTON"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={clsx(
                  "h-9 px-3 rounded-lg text-sm font-semibold border",
                  kind === k ? "bg-ink text-white border-ink" : "border-line",
                )}
              >
                {k === "UNIT" ? t("barcodes.linkUnit") : t("barcodes.linkCarton")}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button disabled={!product || !pending?.available || !operator} onClick={() => link.mutate()}>
              <Check className="w-4 h-4" />
              {t("barcodes.linkedOk")}
            </Button>
            <Button variant="ghost" onClick={() => nav("/settings/barcodes/import")}>
              {t("barcodes.importMap")}
            </Button>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-card p-4 overflow-auto">
          <div className="text-[15px] font-semibold mb-3">{t("barcodes.recent")}</div>
          {(recent.data ?? []).map((row) => (
            <div key={`${row.identifierId}-${row.createdAt}`} className="py-2 border-t border-soft text-sm">
              <div className="font-mono">{row.code}</div>
              <div className="text-xs text-sub">
                {row.productName} · {row.action}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-sub">{label}</span>
      <span
        className={clsx(
          "font-mono text-[26px] font-semibold",
          tone === "ok" && "text-ok",
          tone === "warn" && "text-warn",
        )}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}
