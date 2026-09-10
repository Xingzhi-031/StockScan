import type { ReactNode } from "react";

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[14px] border border-line bg-surface px-8 py-16 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      {hint ? <p className="max-w-md text-sm text-sub">{hint}</p> : null}
      {action}
    </div>
  );
}
