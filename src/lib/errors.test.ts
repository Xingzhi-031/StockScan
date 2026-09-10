import { describe, expect, it } from "vitest";
import { errorMessage, toAppError } from "./errors";

const t = (key: string) => {
  const map: Record<string, string> = {
    "errors.GENERIC": "generic",
    "errors.INVALID_INPUT": "invalid",
    "errors.EMPLOYEE_CODE_IN_USE": "id taken",
    "errors.LAST_ADMIN": "keep an admin",
    "errors.NOT_FOUND": "missing",
  };
  return map[key] ?? key;
};

describe("errorMessage", () => {
  it("prefers a stable details.reason over the generic INVALID_INPUT copy", () => {
    expect(
      errorMessage(
        { code: "INVALID_INPUT", message: "invalid input: EMPLOYEE_CODE_IN_USE", details: { reason: "EMPLOYEE_CODE_IN_USE" } },
        t,
      ),
    ).toBe("id taken");
  });

  it("falls back to the error code", () => {
    expect(errorMessage({ code: "NOT_FOUND", message: "not found: employee" }, t)).toBe("missing");
  });

  it("uses ImportIssue.kind from details", () => {
    const tKind = (key: string) => (key === "errors.HEADER_NOT_FOUND" ? "no header" : key);
    expect(
      errorMessage(
        { code: "IMPORT_ERROR", message: "import failed", details: { kind: "HEADER_NOT_FOUND" } },
        tKind,
      ),
    ).toBe("no header");
  });
});

describe("toAppError", () => {
  it("unwraps JSON strings from Tauri", () => {
    const raw = JSON.stringify({ code: "OPERATOR_INACTIVE", message: "operator inactive" });
    expect(toAppError(raw).code).toBe("OPERATOR_INACTIVE");
  });
});
