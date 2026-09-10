import { describe, expect, it } from "vitest";
import en from "../i18n/en.json";
import zh from "../i18n/zh.json";
import id from "../i18n/id.json";

function keysOf(obj: unknown, prefix = ""): string[] {
  if (!obj || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) out.push(...keysOf(v, path));
    else out.push(path);
  }
  return out;
}

describe("i18n key parity", () => {
  const enKeys = keysOf(en).sort();

  it("zh has the same keys as en", () => {
    expect(keysOf(zh).sort()).toEqual(enKeys);
  });

  it("id has the same keys as en", () => {
    expect(keysOf(id).sort()).toEqual(enKeys);
  });
});
