import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Undo2 } from "lucide-react";

export const MODE_STYLE = {
  STOCK_IN: {
    fg: "text-in",
    bg: "bg-in",
    tint: "bg-in-tint",
    line: "border-in-line",
    icon: ArrowDownToLine,
    key: "F1",
    sign: +1,
  },
  SALE: {
    fg: "text-sale",
    bg: "bg-sale",
    tint: "bg-sale-tint",
    line: "border-sale-line",
    icon: ArrowUpFromLine,
    key: "F2",
    sign: -1,
  },
  RETURN: {
    fg: "text-ret",
    bg: "bg-ret",
    tint: "bg-ret-tint",
    line: "border-ret-line",
    icon: Undo2,
    key: "F3",
    sign: +1,
  },
  ADJUSTMENT: {
    fg: "text-adj",
    bg: "bg-adj",
    tint: "bg-adj-tint",
    line: "border-adj-line",
    icon: SlidersHorizontal,
    key: "F4",
    sign: 0,
  },
} as const;
