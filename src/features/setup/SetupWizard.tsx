import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import clsx from "clsx";
import { Button } from "../../components/Button";
import i18n, { type Lang } from "../../i18n";
import { useAppStore } from "../../stores/appStore";

const OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "id", label: "Bahasa Indonesia" },
];

export function SetupWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const unlockPreview = useAppStore((s) => s.unlockPreview);
  const lang = i18n.language as Lang;

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-[14px] border border-line bg-surface p-8 flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold">{t("setup.title")}</h1>
          <p className="mt-2 text-sm text-sub">{t("setup.subtitle")}</p>
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wider uppercase text-sub mb-2">
            {t("setup.language")}
          </div>
          <div className="flex gap-2">
            {OPTIONS.map((opt) => (
              <button
                key={opt.code}
                type="button"
                onClick={() => void i18n.changeLanguage(opt.code)}
                className={clsx(
                  "flex-1 h-11 rounded-[10px] border text-sm font-semibold",
                  lang.startsWith(opt.code)
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <Button
          onClick={() => {
            unlockPreview();
            navigate("/operator");
          }}
        >
          {t("setup.enter")}
        </Button>
      </div>
    </div>
  );
}
