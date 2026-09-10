import clsx from "clsx";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n, { type Lang } from "../i18n";
import { api } from "../lib/api";
import { qk } from "../app/queryClient";

const LABELS: { code: Lang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "zh", label: "中文" },
  { code: "id", label: "ID" },
];

export function LanguageSwitcher() {
  const { i18n: i18nHook } = useTranslation();
  const qc = useQueryClient();
  const lang = i18nHook.language as Lang;

  async function pick(code: Lang) {
    await i18n.changeLanguage(code);
    try {
      await api.updateSettings({ language: code });
      await qc.invalidateQueries({ queryKey: qk.settings });
    } catch {
      /* language still changes in the UI if settings write fails */
    }
  }

  return (
    <div className="flex p-[3px] rounded-lg bg-soft text-xs font-semibold">
      {LABELS.map((item) => (
        <button
          key={item.code}
          type="button"
          onClick={() => void pick(item.code)}
          className={clsx(
            "px-2.5 py-[5px] rounded-md",
            lang.startsWith(item.code) ? "bg-surface shadow-sm text-ink" : "text-sub",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
