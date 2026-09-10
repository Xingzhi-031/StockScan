import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Barcode, Briefcase, Search, Warehouse } from "lucide-react";
import clsx from "clsx";
import { qk } from "../../app/queryClient";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { Kbd } from "../../components/Kbd";
import type { Lang } from "../../i18n";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/errors";
import { fmtBackupPhrase } from "../../lib/format";
import { unlockAudio } from "../../lib/sound";
import { useOperatorStore } from "../../stores/operatorStore";
import { filterEmployees, initials } from "./filter";

export function OperatorSelectPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setOperator = useOperatorStore((s) => s.setOperator);
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const employees = useQuery({ queryKey: qk.employees, queryFn: () => api.listEmployees(false) });
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const lang = (i18n.language.slice(0, 2) as Lang) || "en";

  const visible = useMemo(
    () => filterEmployees(employees.data ?? [], query),
    [employees.data, query],
  );
  const lastUsedId =
    !query && employees.data?.[0]?.lastUsedAt ? employees.data[0].id : null;

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  useEffect(() => {
    setFocus(0);
  }, [query]);

  async function choose(id: number) {
    setError(null);
    try {
      const ctx = await api.selectOperator(id);
      unlockAudio();
      setOperator({
        id: ctx.employee.id,
        name: ctx.employee.name,
        employeeCode: ctx.employee.employeeCode,
        role: ctx.employee.role,
      });
      navigate("/scan");
    } catch (e) {
      setError(errorMessage(e, t));
    }
  }

  function onNavKeys(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocus((i) => Math.min(i + 1, Math.max(visible.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocus((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && visible[focus]) {
      e.preventDefault();
      void choose(visible[focus].id);
    }
  }

  function onPageKeyDown(e: React.KeyboardEvent) {
    const inSearch = e.target === searchRef.current;
    if (
      !inSearch &&
      e.key.length === 1 &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      setQuery((q) => q + e.key);
      searchRef.current?.focus();
      e.preventDefault();
      return;
    }
    onNavKeys(e);
  }

  return (
    <div className="h-full flex flex-col outline-none" tabIndex={0} onKeyDown={onPageKeyDown}>
      <header className="h-[60px] shrink-0 bg-surface border-b border-line flex items-center gap-3 px-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center">
            <Barcode className="w-[18px] h-[18px] text-white" />
          </div>
          <div className="flex flex-col leading-[1.15]">
            <span className="text-base font-bold tracking-tight">StockScan</span>
            <span className="text-[11px] text-sub">{t("app.tagline")}</span>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 h-9 px-3 border border-line rounded-lg text-[13px]">
          <Warehouse className="w-4 h-4 text-sub" strokeWidth={1.75} />
          <span className="text-sub">{t("nav.warehouse")}</span>
          <span className="font-semibold">{startup.data?.activeLocation?.name ?? "—"}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <div className="flex-1 flex flex-col items-center pt-24 gap-7 px-6">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-[34px] font-semibold tracking-tight">{t("operator.headline")}</h1>
          <p className="text-[17px] text-sub">{t("operator.subtitle")}</p>
        </div>

        <label className="w-[640px] max-w-full h-[54px] bg-surface border border-line rounded-xl flex items-center gap-3 px-[18px] shadow-sm">
          <Search className="w-5 h-5 text-sub" strokeWidth={1.75} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onNavKeys}
            placeholder={t("operator.search")}
            className="flex-1 bg-transparent outline-none text-base"
          />
        </label>

        {error ? <p className="text-sm text-neg">{error}</p> : null}

        {visible.length === 0 ? (
          <p className="text-sm text-sub">{t("operator.empty")}</p>
        ) : (
          <div className="w-[760px] max-w-full grid grid-cols-3 gap-4">
            {visible.map((emp, i) => {
              const selected = i === focus;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => void choose(emp.id)}
                  onMouseEnter={() => setFocus(i)}
                  ref={(el) => {
                    if (selected) el?.scrollIntoView({ block: "nearest" });
                  }}
                  className={clsx(
                    "h-[172px] rounded-[14px] bg-surface flex flex-col items-center justify-center gap-2.5 relative",
                    selected ? "border-2 border-ink" : "border border-line",
                  )}
                >
                  {emp.id === lastUsedId ? (
                    <span className="absolute top-3 right-3 text-[11px] font-semibold px-2 py-[3px] rounded-full bg-soft text-sub">
                      {t("operator.lastUsed")}
                    </span>
                  ) : null}
                  <div
                    className={clsx(
                      "w-[58px] h-[58px] rounded-full flex items-center justify-center text-xl font-semibold",
                      selected ? "bg-ink text-white" : "bg-soft text-ink",
                    )}
                  >
                    {initials(emp.name)}
                  </div>
                  <div className="text-[19px] font-semibold">{emp.name}</div>
                  <div className="font-mono text-[13px] text-sub">#{emp.employeeCode}</div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2.5 text-[13px] text-sub">
          <Kbd>↑ ↓</Kbd> {t("operator.move")} <Kbd>Enter</Kbd> {t("operator.start")}
        </div>
        <div className="flex-1" />
        <p className="flex items-center gap-2 text-[13px] text-sub pb-8">
          <Briefcase className="w-[18px] h-[18px]" strokeWidth={1.75} />
          {t("operator.offlineHint", {
            backup: fmtBackupPhrase(startup.data?.lastBackupAt ?? null, new Date(), lang, t),
          })}
        </p>
      </div>
    </div>
  );
}
