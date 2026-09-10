import clsx from "clsx";
import type { ReactNode } from "react";

export function Kbd({ children, invert }: { children: ReactNode; invert?: boolean }) {
  return (
    <span
      className={clsx(
        "font-mono text-[11px] leading-4 px-1.5 py-px rounded border font-medium",
        invert
          ? "border-white/45 text-white bg-transparent"
          : "border-line text-sub bg-surface",
      )}
    >
      {children}
    </span>
  );
}
