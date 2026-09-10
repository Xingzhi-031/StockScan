import { invoke } from "@tauri-apps/api/core";
import type { EmployeeDto } from "../bindings/EmployeeDto";
import type { EmployeeInput } from "../bindings/EmployeeInput";
import type { OperatorContext } from "../bindings/OperatorContext";
import type { Settings } from "../bindings/Settings";
import type { SettingsPatch } from "../bindings/SettingsPatch";
import type { SetupInput } from "../bindings/SetupInput";
import type { StartupState } from "../bindings/StartupState";
import { toAppError, type AppError } from "./errors";

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toAppError(e);
  }
}

function fail(code: string, reason: string): never {
  const err: AppError = { code, message: reason, details: { reason } };
  throw err;
}

const defaultSettings = (): Settings => ({
  companyId: null,
  activeLocationId: null,
  language: "en",
  setupCompletedAt: null,
  scanner: {
    maxGapMs: 35,
    minLength: 6,
    idleFlushMs: 60,
    suffix: "Enter",
    dedupMs: 300,
  },
  scan: {
    quickScanEnabled: false,
    fkeysEnabled: true,
    autoCommitOnNextScan: false,
    secondaryLanguage: null,
  },
  session: { idleMinutes: 30, nextNumber: 1 },
  sound: { enabled: true },
  backup: {
    secondaryDir: null,
    lastSuccessAt: null,
    lastSecondarySuccessAt: null,
    staleWarningDays: 2,
  },
  import: { missingRowsMeanZero: false },
});

type MockDb = {
  setupCompleted: boolean;
  employees: EmployeeDto[];
  nextId: number;
  companyName: string | null;
  locationName: string | null;
  locationCode: string | null;
  settings: Settings;
};

const mock: MockDb = {
  setupCompleted: false,
  employees: [],
  nextId: 1,
  companyName: null,
  locationName: null,
  locationCode: null,
  settings: defaultSettings(),
};

function mockStartup(): StartupState {
  return {
    setupCompleted: mock.setupCompleted,
    invariantViolations: 0,
    lastBackupAt: mock.setupCompleted ? mock.settings.backup.lastSuccessAt : null,
    secondaryBackupStale: true,
    activeLocation: mock.locationName
      ? {
          id: 1,
          code: mock.locationCode ?? "GS8-21",
          name: mock.locationName,
          locationType: "WAREHOUSE",
        }
      : null,
    companyName: mock.companyName,
    dataDir: "",
    appVersion: "0.1.0",
  };
}

function normalizeCode(raw: string): string {
  const code = raw.trim().replace(/^#+/, "").trim();
  if (!code || code.length > 16 || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(code)) {
    fail("INVALID_INPUT", "EMPLOYEE_CODE_INVALID");
  }
  return code;
}

function normalizeName(raw: string): string {
  const name = raw.trim().split(/\s+/).join(" ");
  if (!name || name.length > 80) fail("INVALID_INPUT", "EMPLOYEE_NAME_INVALID");
  return name;
}

function upsertMock(input: EmployeeInput): EmployeeDto {
  const code = normalizeCode(input.employeeCode);
  const name = normalizeName(input.name);
  const clash = mock.employees.find((e) => e.employeeCode === code && e.id !== input.id);
  if (clash) fail("INVALID_INPUT", "EMPLOYEE_CODE_IN_USE");
  if (input.id != null) {
    const idx = mock.employees.findIndex((e) => e.id === input.id);
    if (idx < 0) fail("NOT_FOUND", "employee");
    const current = mock.employees[idx];
    const lastAdmin =
      current.role === "ADMIN" &&
      current.isActive &&
      mock.employees.filter((e) => e.isActive && e.role === "ADMIN").length <= 1;
    if (lastAdmin && input.role !== "ADMIN") fail("INVALID_INPUT", "LAST_ADMIN");
    mock.employees[idx] = { ...current, employeeCode: code, name, role: input.role };
    return mock.employees[idx];
  }
  const row: EmployeeDto = {
    id: mock.nextId++,
    employeeCode: code,
    name,
    role: input.role,
    isActive: true,
    lastUsedAt: null,
  };
  mock.employees.push(row);
  return row;
}

function applyPatch(patch: SettingsPatch): Settings {
  const s = mock.settings;
  if (patch.language) s.language = patch.language;
  if (patch.scanner) s.scanner = patch.scanner;
  if (patch.scan) s.scan = patch.scan;
  if (patch.sound) s.sound = patch.sound;
  if (patch.import) s.import = patch.import;
  if (patch.session?.idleMinutes != null) {
    if (patch.session.idleMinutes < 5 || patch.session.idleMinutes > 240) {
      fail("INVALID_INPUT", "SETTINGS_RANGE");
    }
    s.session.idleMinutes = patch.session.idleMinutes;
  }
  if (patch.backup) {
    if (patch.backup.secondaryDir !== undefined) {
      const dir = patch.backup.secondaryDir?.trim() ?? "";
      s.backup.secondaryDir = dir ? dir : null;
    }
    if (patch.backup.staleWarningDays != null) s.backup.staleWarningDays = patch.backup.staleWarningDays;
  }
  return s;
}

export const api = {
  getStartupState: () =>
    isTauriRuntime() ? call<StartupState>("get_startup_state") : Promise.resolve(mockStartup()),
  getSettings: () =>
    isTauriRuntime() ? call<Settings>("get_settings") : Promise.resolve({ ...mock.settings }),
  updateSettings: (patch: SettingsPatch) => {
    if (isTauriRuntime()) return call<Settings>("update_settings", { patch });
    return Promise.resolve({ ...applyPatch(patch) });
  },
  completeSetup: (input: SetupInput) => {
    if (isTauriRuntime()) return call<StartupState>("complete_setup", { input });
    if (mock.setupCompleted) fail("INVALID_INPUT", "SETUP_ALREADY_DONE");
    mock.companyName = input.companyName.trim();
    mock.locationName = input.location.name.trim();
    mock.locationCode = input.location.code.trim();
    if (!mock.companyName) fail("INVALID_INPUT", "COMPANY_NAME_INVALID");
    if (!mock.locationName || !mock.locationCode) fail("INVALID_INPUT", "WAREHOUSE_INVALID");
    mock.setupCompleted = true;
    mock.settings.language = input.language;
    mock.settings.setupCompletedAt = new Date().toISOString();
    mock.settings.companyId = 1;
    mock.settings.activeLocationId = 1;
    mock.settings.backup.lastSuccessAt = "2026-09-10T01:02:00.000Z";
    upsertMock({ ...input.admin, role: "ADMIN" });
    input.employees.forEach(upsertMock);
    return Promise.resolve(mockStartup());
  },
  listEmployees: (includeInactive = false) => {
    if (isTauriRuntime()) {
      return call<EmployeeDto[]>("list_employees", { includeInactive });
    }
    const rows = includeInactive ? mock.employees : mock.employees.filter((e) => e.isActive);
    return Promise.resolve(
      [...rows].sort((a, b) => {
        if (a.lastUsedAt && b.lastUsedAt) return b.lastUsedAt.localeCompare(a.lastUsedAt);
        if (a.lastUsedAt) return -1;
        if (b.lastUsedAt) return 1;
        return a.name.localeCompare(b.name);
      }),
    );
  },
  upsertEmployee: (input: EmployeeInput) =>
    isTauriRuntime()
      ? call<EmployeeDto>("upsert_employee", { input })
      : Promise.resolve(upsertMock(input)),
  setEmployeeActive: (id: number, active: boolean) => {
    if (isTauriRuntime()) return call<EmployeeDto>("set_employee_active", { id, active });
    const row = mock.employees.find((e) => e.id === id);
    if (!row) fail("NOT_FOUND", "employee");
    if (row.isActive && !active) {
      const activeCount = mock.employees.filter((e) => e.isActive).length;
      if (activeCount <= 1) fail("INVALID_INPUT", "LAST_ACTIVE_EMPLOYEE");
      const adminCount = mock.employees.filter((e) => e.isActive && e.role === "ADMIN").length;
      if (row.role === "ADMIN" && adminCount <= 1) fail("INVALID_INPUT", "LAST_ADMIN");
    }
    row.isActive = active;
    return Promise.resolve(row);
  },
  selectOperator: (employeeId: number) => {
    if (isTauriRuntime()) return call<OperatorContext>("select_operator", { employeeId });
    const employee = mock.employees.find((e) => e.id === employeeId);
    if (!employee) fail("NOT_FOUND", "employee");
    if (!employee.isActive) fail("OPERATOR_INACTIVE", "OPERATOR_INACTIVE");
    employee.lastUsedAt = new Date().toISOString();
    return Promise.resolve({ employee: { ...employee } });
  },
  devSeedDemo: () => {
    if (isTauriRuntime()) return call<StartupState>("dev_seed_demo");
    if (mock.setupCompleted) return Promise.resolve(mockStartup());
    mock.companyName = "PT. CHANG PING INDONESIA";
    mock.locationName = "GS 8A NO 21";
    mock.locationCode = "GS8-21";
    mock.setupCompleted = true;
    mock.settings = defaultSettings();
    mock.settings.companyId = 1;
    mock.settings.activeLocationId = 1;
    mock.settings.setupCompletedAt = new Date().toISOString();
    mock.settings.backup.lastSuccessAt = "2026-09-10T01:02:00.000Z";
    mock.employees = [];
    mock.nextId = 1;
    upsertMock({ id: null, employeeCode: "1024", name: "Alex", role: "ADMIN" });
    upsertMock({ id: null, employeeCode: "1031", name: "Amy", role: "OPERATOR" });
    upsertMock({ id: null, employeeCode: "1068", name: "John", role: "OPERATOR" });
    mock.employees[0].lastUsedAt = "2026-09-10T01:00:00.000Z";
    return Promise.resolve(mockStartup());
  },
};
