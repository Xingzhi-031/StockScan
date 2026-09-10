import { NavLink, Outlet } from "react-router";
import { useTranslation } from "react-i18next";
import clsx from "clsx";

const LINKS = [
  { to: "/settings/employees", key: "settings.employeesTitle" },
  { to: "/settings/preferences", key: "settings.preferencesTitle" },
  { to: "/settings/barcodes", key: "barcodes.title" },
] as const;

export function SettingsLayout() {
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
