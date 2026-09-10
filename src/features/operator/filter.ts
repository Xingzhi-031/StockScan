import type { EmployeeDto } from "../../bindings/EmployeeDto";

export function filterEmployees(list: EmployeeDto[], query: string): EmployeeDto[] {
  const s = query.trim().toLowerCase();
  if (!s) return list;
  return list.filter(
    (e) =>
      e.name.toLowerCase().includes(s) ||
      e.employeeCode.toLowerCase().includes(s) ||
      `#${e.employeeCode}`.toLowerCase().includes(s),
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
