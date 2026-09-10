import { Navigate, Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { qk } from "./queryClient";
import { useOperatorStore } from "../stores/operatorStore";
import { bootstrapPath } from "./bootstrapPath";

function BootScreen() {
  return <div className="flex-1 bg-bg" />;
}

export function RootRedirect() {
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const operator = useOperatorStore((s) => s.operator);

  if (startup.isLoading) return <BootScreen />;
  return <Navigate to={bootstrapPath(!!startup.data?.setupCompleted, !!operator)} replace />;
}

/** Scan / Inventory / … — setup must be done and an employee must be selected. */
export function RequireShell() {
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const operator = useOperatorStore((s) => s.operator);

  if (startup.isLoading) return <BootScreen />;
  const next = bootstrapPath(!!startup.data?.setupCompleted, !!operator);
  if (next !== "/scan") return <Navigate to={next} replace />;
  return <Outlet />;
}

/** First-run wizard. After setup, bounce to operator (or scan if somehow selected). */
export function RequireSetup() {
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const operator = useOperatorStore((s) => s.operator);

  if (startup.isLoading) return <BootScreen />;
  if (startup.data?.setupCompleted) {
    return <Navigate to={bootstrapPath(true, !!operator)} replace />;
  }
  return <Outlet />;
}

/** Operator picker. Allowed even with an employee selected (switch). */
export function RequireOperatorSelect() {
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });

  if (startup.isLoading) return <BootScreen />;
  if (!startup.data?.setupCompleted) return <Navigate to="/setup" replace />;
  return <Outlet />;
}
