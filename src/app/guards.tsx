import { Navigate, Outlet } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { qk } from "./queryClient";
import { useAppStore } from "../stores/appStore";
import { useOperatorStore } from "../stores/operatorStore";

export function RootRedirect() {
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const operator = useOperatorStore((s) => s.operator);
  const previewUnlocked = useAppStore((s) => s.previewUnlocked);

  if (startup.isLoading) {
    return <div className="flex-1 bg-bg" />;
  }
  if (!startup.data?.setupCompleted && !previewUnlocked) {
    return <Navigate to="/setup" replace />;
  }
  if (!operator) {
    return <Navigate to="/operator" replace />;
  }
  return <Navigate to="/scan" replace />;
}

export function RequireShell() {
  const startup = useQuery({ queryKey: qk.startup, queryFn: api.getStartupState });
  const operator = useOperatorStore((s) => s.operator);
  const previewUnlocked = useAppStore((s) => s.previewUnlocked);

  if (startup.isLoading) {
    return <div className="flex-1 bg-bg" />;
  }
  if (!startup.data?.setupCompleted && !previewUnlocked) {
    return <Navigate to="/setup" replace />;
  }
  if (!operator) {
    return <Navigate to="/operator" replace />;
  }
  return <Outlet />;
}
