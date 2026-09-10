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

function jakartaDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isJakartaToday(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return false;
  return jakartaDay(then) === jakartaDay(now);
}

export function fmtUpdated(iso: string | null, now: Date, lang: Lang): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  if (jakartaDay(then) === jakartaDay(now)) {
    return new Intl.DateTimeFormat(LOCALE[lang], {
      timeZone: TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(then);
  }
  return new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
  }).format(then);
}

/** `YYYY-MM-DD` (report as-of) or a UTC ISO timestamp. */
export function fmtAsOfDate(value: string, lang: Lang): string {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00+07:00` : value;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return value;
  return new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(then);
}

export function fmtAsOfDateTime(iso: string, lang: Lang): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return iso;
  const date = fmtAsOfDate(iso, lang);
  const time = new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(then);
  return `${date} · ${time}`;
}

export function fmtBackupPhrase(iso: string | null, now: Date, lang: Lang, t: Translate): string {
  if (!iso) return t("operator.noBackup");
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return t("operator.noBackup");
  const time = new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(then);
  if (jakartaDay(then) === jakartaDay(now)) return t("operator.backupTodayAt", { time });
  return t("operator.backupAt", { datetime: fmtDateTime(iso, lang) });
}
