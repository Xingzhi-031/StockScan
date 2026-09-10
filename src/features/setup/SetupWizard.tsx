import { useState } from "react";
import { useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Button } from "../../components/Button";
import { qk } from "../../app/queryClient";
import i18n, { type Lang } from "../../i18n";
import { api } from "../../lib/api";
import type { SetupInput } from "../../bindings/SetupInput";
import { errorMessage } from "../../lib/errors";

const OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "id", label: "Bahasa Indonesia" },
];

export function SetupWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const lang = i18n.language as Lang;
  const [companyName, setCompanyName] = useState("PT. CHANG PING INDONESIA");
  const [locationCode, setLocationCode] = useState("GS8-21");
  const [locationName, setLocationName] = useState("GS 8A NO 21");
  const [adminCode, setAdminCode] = useState("1024");
  const [adminName, setAdminName] = useState("Alex");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(seed: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (seed) {
        await api.devSeedDemo();
      } else {
        const input: SetupInput = {
          language: (i18n.language.slice(0, 2) as Lang) || "en",
          companyName,
          admin: { id: null, employeeCode: adminCode, name: adminName, role: "ADMIN" },
          employees: [],
          location: { code: locationCode, name: locationName, locationType: "WAREHOUSE" },
        };
        await api.completeSetup(input);
      }
      await qc.invalidateQueries({ queryKey: qk.startup });
      await qc.invalidateQueries({ queryKey: qk.employees });
      await qc.invalidateQueries({ queryKey: qk.settings });
      navigate("/operator");
    } catch (e) {
      setError(errorMessage(e, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-[14px] border border-line bg-surface p-8 flex flex-col gap-5">
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
                onClick={() => {
                  void i18n.changeLanguage(opt.code);
                  void api.updateSettings({ language: opt.code }).catch(() => undefined);
                }}
                className={clsx(
                  "flex-1 h-11 rounded-[10px] border text-sm font-semibold",
                  lang.startsWith(opt.code) ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-sub font-medium">{t("setup.company")}</span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="h-11 px-3 rounded-[10px] border border-line outline-none focus:border-ink"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sub font-medium">{t("setup.locationCode")}</span>
            <input
              value={locationCode}
              onChange={(e) => setLocationCode(e.target.value)}
              className="h-11 px-3 rounded-[10px] border border-line outline-none focus:border-ink font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sub font-medium">{t("setup.locationName")}</span>
            <input
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              className="h-11 px-3 rounded-[10px] border border-line outline-none focus:border-ink"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sub font-medium">{t("setup.adminCode")}</span>
            <input
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              className="h-11 px-3 rounded-[10px] border border-line outline-none focus:border-ink font-mono"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sub font-medium">{t("setup.adminName")}</span>
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              className="h-11 px-3 rounded-[10px] border border-line outline-none focus:border-ink"
            />
          </label>
        </div>
        {error ? <p className="text-sm text-neg">{error}</p> : null}
        <Button disabled={busy} onClick={() => void finish(false)}>
          {t("setup.enter")}
        </Button>
        {import.meta.env.DEV ? (
          <Button variant="ghost" disabled={busy} onClick={() => void finish(true)}>
            {t("setup.loadDemo")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
