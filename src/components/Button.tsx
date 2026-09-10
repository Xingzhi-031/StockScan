import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
  children: ReactNode;
};

export function Button({ variant = "primary", className, children, ...rest }: Props) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold whitespace-nowrap",
        variant === "primary" && "bg-ink text-white border border-ink",
        variant === "ghost" && "bg-surface text-ink border border-line",
        variant === "danger" && "bg-warn text-white border border-warn",
        "disabled:opacity-50",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
