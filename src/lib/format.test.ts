import { describe, expect, it } from "vitest";
import {
  fmtAsOfDate,
  fmtBackupPhrase,
  fmtCartonSplit,
  fmtQty,
  fmtSigned,
  fmtUpdated,
  isJakartaToday,
} from "./format";

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

describe("fmtUpdated", () => {
  const now = new Date("2026-09-10T10:00:00.000Z");

  it("shows Jakarta time when the stamp is today", () => {
    expect(fmtUpdated("2026-09-10T08:31:00.000Z", now, "en")).toBe("15:31");
  });

  it("shows a short date when the stamp is another Jakarta day", () => {
    const text = fmtUpdated("2026-09-09T08:00:00.000Z", now, "en");
    expect(text).toMatch(/09/);
    expect(text).toMatch(/Sep/i);
  });

  it("shows an em dash when missing", () => {
    expect(fmtUpdated(null, now, "en")).toBe("—");
  });
});

describe("isJakartaToday", () => {
  const now = new Date("2026-09-10T10:00:00.000Z");
  it("is true for the same Jakarta calendar day", () => {
    expect(isJakartaToday("2026-09-10T01:00:00.000Z", now)).toBe(true);
    expect(isJakartaToday("2026-09-09T08:00:00.000Z", now)).toBe(false);
  });
});

describe("fmtAsOfDate", () => {
  it("formats a naive report date in Jakarta", () => {
    expect(fmtAsOfDate("2026-09-09", "en")).toMatch(/09/);
    expect(fmtAsOfDate("2026-09-09", "en")).toMatch(/Sep/i);
    expect(fmtAsOfDate("2026-09-09", "en")).toMatch(/2026/);
  });
});

describe("fmtBackupPhrase", () => {
  const t = (key: string, vars?: Record<string, unknown>) => {
    if (key === "operator.noBackup") return "none";
    if (key === "operator.backupTodayAt") return `today ${vars?.time}`;
    if (key === "operator.backupAt") return `at ${vars?.datetime}`;
    return key;
  };

  it("says none when there is no backup", () => {
    expect(fmtBackupPhrase(null, new Date("2026-09-10T10:00:00.000Z"), "en", t)).toBe("none");
  });

  it("uses today when the backup is the same Jakarta day", () => {
    const phrase = fmtBackupPhrase(
      "2026-09-10T01:02:00.000Z",
      new Date("2026-09-10T10:00:00.000Z"),
      "en",
      t,
    );
    expect(phrase.startsWith("today ")).toBe(true);
  });
});
