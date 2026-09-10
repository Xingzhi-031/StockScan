import { Barcode, ChevronDown, Settings, TriangleAlert, Warehouse } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useOperatorStore } from "../stores/operatorStore";
import type { StartupState } from "../bindings/StartupState";
import { api } from "../lib/api";
import { qk } from "../app/queryClient";

const NAV = [
  { to: "/scan", key: "nav.scan" },
  { to: "/inventory", key: "nav.inventory" },
  { to: "/history", key: "nav.history" },
  { to: "/data/import", key: "nav.data", match: "/data" },
] as const;

export function Header({ startup }: { startup: StartupState | undefined }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const operator = useOperatorStore((s) => s.operator);
  const setOperator = useOperatorStore((s) => s.setOperator);
  const exceptions = useQuery({ queryKey: qk.exceptionsCount, queryFn: api.countOpenExceptions });
  const exceptionCount = exceptions.data ?? 0;
  const initials = operator
    ? operator.name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "—";

  return (
    <header className="h-[60px] shrink-0 bg-surface border-b border-line flex items-center gap-9 px-6">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center">
          <Barcode className="w-[18px] h-[18px] text-white" strokeWidth={2} />
        </div>
        <div className="flex flex-col leading-[1.15]">
          <span className="text-base font-bold tracking-tight">StockScan</span>
          <span className="text-[11px] text-sub">{t("app.tagline")}</span>
        </div>
      </div>

      <nav className="flex gap-1">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => {
              const active = "match" in item ? location.pathname.startsWith(item.match) : isActive;
              return clsx(
                "px-3.5 py-2 rounded-lg text-sm",
                active ? "font-semibold text-ink bg-soft" : "font-medium text-sub",
              );
            }}
          >
            {t(item.key)}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2 h-9 px-3 border border-line rounded-lg text-[13px]">
          <Warehouse className="w-4 h-4 text-sub" strokeWidth={1.75} />
          <span className="text-sub">{t("nav.warehouse")}</span>
          <span className="font-semibold">{startup?.activeLocation?.name ?? "—"}</span>
        </div>

        <button
          type="button"
          onClick={() => navigate("/inventory?filter=exceptions")}
          className={clsx(
            "flex items-center gap-2 h-9 px-3 rounded-lg text-[13px] font-semibold",
            exceptionCount > 0
              ? "bg-warn-tint border border-warn-line text-warn"
              : "border border-line text-sub",
          )}
        >
          <TriangleAlert className="w-4 h-4" strokeWidth={2} />
          {t("nav.exceptions")}
          <span
            className={clsx(
              "min-w-5 h-5 px-1.5 rounded-full text-xs flex items-center justify-center",
              exceptionCount > 0 ? "bg-warn text-white" : "bg-soft text-sub",
            )}
          >
            {exceptionCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setOperator(null);
            navigate("/operator");
          }}
          className="flex items-center gap-2 h-9 pl-1.5 pr-2.5 border border-line rounded-lg text-[13px]"
        >
          <span className="w-[26px] h-[26px] rounded-full bg-ink text-white text-[11px] font-semibold flex items-center justify-center">
            {initials}
          </span>
          <span className="font-semibold">{operator?.name ?? t("common.guest")}</span>
          {operator ? (
            <span className="font-mono text-sub">#{operator.employeeCode}</span>
          ) : null}
          <ChevronDown className="w-3.5 h-3.5 text-sub" />
        </button>

        <LanguageSwitcher />

        <button
          type="button"
          onClick={() => navigate("/settings/employees")}
          className="w-9 h-9 rounded-lg border border-line flex items-center justify-center"
          aria-label={t("nav.settings")}
        >
          <Settings className="w-[18px] h-[18px] text-sub" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
}
