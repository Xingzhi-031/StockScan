import type { Lang } from "../i18n";

const LOCALE = { en: "en-US", zh: "zh-CN", id: "id-ID" } as const;
const TZ = "Asia/Jakarta";

type Translate = (key: string, vars?: Record<string, unknown>) => string;

export const fmtQty = (n: number, lang: Lang) =>
  new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 }).format(n).replace("-", "−");

export const fmtSigned = (n: number, lang: Lang) => (n > 0 ? "+" : "") + fmtQty(n, lang);

export const fmtRupiah = (n: number | null, lang: Lang) =>
  n == null ? "—" : "Rp " + new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 0 }).format(n);

export const fmtKoli = (q: number, isi: number | null, lang: Lang) =>
  !isi
    ? "—"
    : new Intl.NumberFormat(LOCALE[lang], {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(q / isi);

export function fmtCartonSplit(q: number, isi: number | null, t: Translate): string | null {
  if (!isi || isi <= 0 || q < 0) return null;
  const ctn = Math.floor(q / isi);
  const pcs = q % isi;
  return pcs === 0 ? t("qty.ctnOnly", { ctn }) : t("qty.ctnPcs", { ctn, pcs });
}

export const fmtTime = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(iso));

export const fmtDateTime = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: TZ,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: false,
  }).format(new Date(iso));
