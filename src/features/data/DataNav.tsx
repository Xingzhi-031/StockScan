import { NavLink, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

const LINKS = [
  { to: "/data/import", key: "dataNav.import" },
  { to: "/data/reconcile", key: "dataNav.reconcile" },
  { to: "/data/export", key: "dataNav.export" },
  { to: "/data/backup", key: "dataNav.backup" },
] as const;

export function DataLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 gap-6 min-h-0">
      <aside className="w-52 shrink-0 flex flex-col gap-1">
        {LINKS.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              clsx(
                "px-3 py-2 rounded-lg text-sm",
                isActive ? "bg-soft font-semibold text-ink" : "text-sub font-medium",
              )
            }
          >
            {t(link.key)}
          </NavLink>
        ))}
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
