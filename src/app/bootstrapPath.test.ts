import { describe, expect, it } from "vitest";
import { bootstrapPath } from "./bootstrapPath";

describe("bootstrapPath", () => {
  it("sends unfinished installs to setup", () => {
    expect(bootstrapPath(false, false)).toBe("/setup");
    expect(bootstrapPath(false, true)).toBe("/setup");
  });

  it("requires an employee before Scan", () => {
    expect(bootstrapPath(true, false)).toBe("/operator");
    expect(bootstrapPath(true, true)).toBe("/scan");
  });
});
