import { describe, expect, it } from "vitest";
import { filterEmployees, initials } from "./filter";
import type { EmployeeDto } from "../../bindings/EmployeeDto";

const people: EmployeeDto[] = [
  { id: 1, employeeCode: "1024", name: "Alex", role: "ADMIN", isActive: true, lastUsedAt: "2026-09-10T08:00:00.000Z" },
  { id: 2, employeeCode: "1031", name: "Amy", role: "OPERATOR", isActive: true, lastUsedAt: null },
];

describe("filterEmployees", () => {
  it("matches name or employee code", () => {
    expect(filterEmployees(people, "am").map((e) => e.name)).toEqual(["Amy"]);
    expect(filterEmployees(people, "#1024").map((e) => e.name)).toEqual(["Alex"]);
  });
});

describe("initials", () => {
  it("uses the first letters", () => {
    expect(initials("Alex")).toBe("A");
    expect(initials("Ann Marie")).toBe("AM");
  });
});
