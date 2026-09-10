import { Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { Header } from "../components/Header";
import { InvariantBanner } from "../components/InvariantBanner";
import { useAppShortcuts } from "../hooks/useAppShortcuts";
import { api } from "../lib/api";
import { qk } from "./queryClient";

export function BareLayout() {
  useAppShortcuts();
  return (
    <div className="h-screen flex flex-col bg-bg">
      <div className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </div>
    </div>
  );
}

export function AppShell() {
  useAppShortcuts();
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  return (
    <div className="h-screen flex flex-col bg-bg">
      <InvariantBanner count={startup.data?.invariantViolations ?? 0} />
      <Header startup={startup.data} />
      <main className="flex-1 min-h-0 px-6 py-[22px] flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
