import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { qk } from "../../app/queryClient";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { setSoundEnabled } from "../../lib/sound";

export function PreferencesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: qk.settings, queryFn: api.getSettings });
  const [idleDraft, setIdleDraft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: (next) => {
      setSoundEnabled(next.sound.enabled);
      void qc.setQueryData(qk.settings, next);
    },
  });

  const data = settings.data;
  useEffect(() => {
    setIdleDraft(null);
  }, [data?.session.idleMinutes]);

  const err = save.error ? errorMessage(save.error, t) : null;

  function commitIdle() {
    const idleMinutes = Number(idleDraft ?? data?.session.idleMinutes);
    if (!Number.isFinite(idleMinutes) || idleMinutes === data?.session.idleMinutes) {
      setIdleDraft(null);
      return;
    }
    save.mutate({ session: { idleMinutes } });
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl">
      <div>
        <h1 className="text-xl font-semibold">{t("settings.preferencesTitle")}</h1>
        <p className="text-sm text-sub mt-1">{t("preferences.hint")}</p>
      </div>

      <section className="rounded-[14px] border border-line bg-surface p-5 flex flex-col gap-3">
        <div className="text-sm font-semibold">{t("preferences.language")}</div>
        <LanguageSwitcher />
      </section>

      <section className="rounded-[14px] border border-line bg-surface p-5 flex flex-col gap-4">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-semibold block">{t("preferences.sound")}</span>
            <span className="text-sub">{t("preferences.soundHint")}</span>
          </span>
          <input
            type="checkbox"
            className="w-4 h-4"
            disabled={!data || save.isPending}
            checked={data?.sound.enabled ?? true}
            onChange={(e) => save.mutate({ sound: { enabled: e.target.checked } })}
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-semibold block">{t("preferences.fkeys")}</span>
            <span className="text-sub">{t("preferences.fkeysHint")}</span>
          </span>
          <input
            type="checkbox"
            className="w-4 h-4"
            disabled={!data || save.isPending}
            checked={data?.scan.fkeysEnabled ?? true}
            onChange={(e) =>
              save.mutate({
                scan: {
                  quickScanEnabled: data?.scan.quickScanEnabled ?? false,
                  fkeysEnabled: e.target.checked,
                  autoCommitOnNextScan: data?.scan.autoCommitOnNextScan ?? false,
                  secondaryLanguage: data?.scan.secondaryLanguage ?? null,
                },
              })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>
            <span className="font-semibold block">{t("preferences.idleMinutes")}</span>
            <span className="text-sub">{t("preferences.idleHint")}</span>
          </span>
          <input
            type="number"
            min={5}
            max={240}
            className="h-10 w-20 px-3 rounded-[10px] border border-line font-mono outline-none focus:border-ink"
            disabled={!data || save.isPending}
            value={idleDraft ?? String(data?.session.idleMinutes ?? 30)}
            onChange={(e) => setIdleDraft(e.target.value)}
            onBlur={commitIdle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
        </label>
      </section>

      {err ? <p className="text-sm text-neg">{err}</p> : null}
    </div>
  );
}
