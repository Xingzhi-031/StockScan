import { describe, expect, it } from "vitest";
import { fmtCartonSplit, fmtQty, fmtSigned } from "./format";

describe("fmtQty", () => {
  it("uses a minus sign and locale grouping", () => {
    expect(fmtQty(-3, "en")).toBe("−3");
    expect(fmtQty(1284, "en")).toBe("1,284");
    expect(fmtQty(1284, "id")).toBe("1.284");
  });
});

describe("fmtSigned", () => {
  it("prefixes a plus for gains", () => {
    expect(fmtSigned(4, "en")).toBe("+4");
    expect(fmtSigned(-4, "en")).toBe("−4");
  });
});

describe("fmtCartonSplit", () => {
  const t = (key: string, vars?: Record<string, unknown>) => {
    if (key === "qty.ctnOnly") return `${vars?.ctn} ctn`;
    if (key === "qty.ctnPcs") return `${vars?.ctn} ctn + ${vars?.pcs} pcs`;
    return key;
  };

  it("returns null without ISI or when stock is negative", () => {
    expect(fmtCartonSplit(46, null, t)).toBeNull();
    expect(fmtCartonSplit(-3, 100, t)).toBeNull();
  });

  it("splits cartons and leftover pieces", () => {
    expect(fmtCartonSplit(1142, 100, t)).toBe("11 ctn + 42 pcs");
    expect(fmtCartonSplit(200, 100, t)).toBe("2 ctn");
  });
});
