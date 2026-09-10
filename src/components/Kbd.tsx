import type { ReactNode } from "react";

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[11px] leading-4 px-1.5 py-px rounded border border-line text-sub bg-surface font-medium">
      {children}
    </span>
  );
}
