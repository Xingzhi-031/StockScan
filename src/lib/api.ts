import { invoke } from "@tauri-apps/api/core";
import type { BaselineApplyResult } from "../bindings/BaselineApplyResult";
import type { EmployeeDto } from "../bindings/EmployeeDto";
import type { EmployeeInput } from "../bindings/EmployeeInput";
import type { IdentifierDto } from "../bindings/IdentifierDto";
import type { ImportPurpose } from "../bindings/ImportPurpose";
import type { InventoryRow } from "../bindings/InventoryRow";
import type { OperatorContext } from "../bindings/OperatorContext";
import type { ProductDetail } from "../bindings/ProductDetail";
import type { Settings } from "../bindings/Settings";
import type { SettingsPatch } from "../bindings/SettingsPatch";
import type { SetupInput } from "../bindings/SetupInput";
import type { StartupState } from "../bindings/StartupState";
import type { StockReportPreview } from "../bindings/StockReportPreview";
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
  nextImportId: number;
  companyName: string | null;
  locationName: string | null;
  locationCode: string | null;
  settings: Settings;
  inventory: InventoryRow[];
  identifiers: Map<number, IdentifierDto[]>;
};

const mock: MockDb = {
  setupCompleted: false,
  employees: [],
  nextId: 1,
  nextImportId: 1,
  companyName: null,
  locationName: null,
  locationCode: null,
  settings: defaultSettings(),
  inventory: [],
  identifiers: new Map(),
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

function mockCatalog(kind: "demo" | "synthetic", n: number, barcodeCount: number): void {
  const packs = kind === "demo" ? [12, 24, 60, 100, 450] : [12, 24, 60, 80, 100, 450];
  const asOf = "2026-09-09";
  const inventory: InventoryRow[] = [];
  const identifiers = new Map<number, IdentifierDto[]>();
  let nextIdentifierId = 1;
  for (let i = 1; i <= n; i += 1) {
    const pad = String(i).padStart(4, "0");
    const name = kind === "demo" ? `DEMO ITEM ${pad}` : `SYNTHETIC ITEM ${pad} DM-${pad}`;
    const pack = packs[(i - 1) % packs.length];
    const qty = 10 + (i % 500);
    const barcodes: string[] = [];
    const ids: IdentifierDto[] = [];
    if (i <= barcodeCount) {
      const code = String(8_000_000_000_000 + i);
      barcodes.push(code);
      ids.push({
        id: nextIdentifierId++,
        code,
        identifierType: "EAN13",
        unitMultiplier: 1,
      });
    }
    inventory.push({
      productId: i,
      name,
      modelCode: `DM-${pad}`,
      externalCode: null,
      packSize: pack,
      referencePrice: 10_000 + (i % 50) * 500,
      baselineQuantity: qty,
      currentQuantity: qty,
      barcodeCount: barcodes.length,
      barcodes,
      lastChangedAt: null,
      baselineAsOf: asOf,
      openExceptionCount: 0,
    });
    identifiers.set(i, ids);
  }
  mock.inventory = inventory;
  mock.identifiers = identifiers;
}

function mockPreview(fileName: string, baselineExists: boolean): StockReportPreview {
  const stockColumn = mock.locationName ?? "GS 8A NO 21";
  return {
    importId: mock.nextImportId++,
    purpose: "BASELINE",
    fileName,
    fileFormat: "XLSX",
    companyName: "PT. CHANG PING INDONESIA",
    reportName: "Kuantitas Barang GS 8 No.21",
    asOfDate: "2026-09-09",
    printedAt: "2026-09-09T08:53:00.000Z",
    cutoffAt: "2026-09-09T16:59:59.999Z",
    stockColumn,
    stockColumnCandidates: [stockColumn],
    columns: [
      { source: "DESKRIPSI BARANG", target: "NAME", firstValue: "SYNTHETIC ITEM 0001 DM-0001" },
      { source: "ISI", target: "PACK_SIZE", firstValue: "12" },
      { source: stockColumn, target: "STOCK", firstValue: "11" },
      { source: "KOLI", target: "KOLI_CHECK", firstValue: "0.92" },
      { source: "HARGA", target: "PRICE", firstValue: "10500" },
    ],
    counts: { dataRows: 1284, matched: 0, new: 1284, ambiguous: 0, invalid: 0, packSizeMissing: 0 },
    fileIssues: baselineExists
      ? [
          { kind: "BASELINE_EXISTS", message: "Stock is already imported. Use Reconcile for a new report." },
          { kind: "NO_BARCODE_COLUMN", message: "No barcode column found." },
        ]
      : [{ kind: "NO_BARCODE_COLUMN", message: "No barcode column found." }],
    sampleRows: [],
    problemRows: [],
    canApply: !baselineExists,
  };
}

async function pickStockReportFile(): Promise<string | null> {
  if (!isTauriRuntime()) return "stock gs8 09.09.2026.xls";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    filters: [{ name: "Stock report", extensions: ["xls", "xlsx", "html", "htm", "xml"] }],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
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
    mockCatalog("demo", 2000, 1500);
    return Promise.resolve(mockStartup());
  },
  pickStockReport: () => pickStockReportFile(),
  previewStockReport: (path: string, operatorId: number, purpose: ImportPurpose) => {
    if (isTauriRuntime()) {
      return call<StockReportPreview>("preview_stock_report", { path, operatorId, purpose });
    }
    return Promise.resolve(mockPreview(path.split(/[\\/]/).pop() ?? path, mock.inventory.length > 0));
  },
  setReportOptions: (
    importId: number,
    opts: { stockColumn?: string | null; cutoffAt?: string | null; asOfDate?: string | null },
  ) => {
    if (isTauriRuntime()) {
      return call<StockReportPreview>("set_report_options", { importId, ...opts });
    }
    return Promise.resolve(mockPreview("stock gs8 09.09.2026.xls", mock.inventory.length > 0));
  },
  applyBaselineImport: (importId: number, operatorId: number) => {
    if (isTauriRuntime()) {
      return call<BaselineApplyResult>("apply_baseline_import", { importId, operatorId });
    }
    if (mock.inventory.length > 0) fail("BASELINE_EXISTS", "BASELINE_EXISTS");
    mockCatalog("synthetic", 1284, 0);
    return Promise.resolve({ products: 1284, balances: 1284 });
  },
  cancelImport: (importId: number) => {
    if (isTauriRuntime()) return call<void>("cancel_import", { importId });
    return Promise.resolve();
  },
  listInventory: () =>
    isTauriRuntime() ? call<InventoryRow[]>("list_inventory") : Promise.resolve([...mock.inventory]),
  getProductDetail: (productId: number) => {
    if (isTauriRuntime()) return call<ProductDetail>("get_product_detail", { productId });
    const row = mock.inventory.find((r) => r.productId === productId);
    if (!row) fail("NOT_FOUND", "product");
    return Promise.resolve({
      productId: row.productId,
      name: row.name,
      modelCode: row.modelCode,
      externalCode: row.externalCode,
      packSize: row.packSize,
      referencePrice: row.referencePrice,
      locationName: mock.locationName ?? "GS 8A NO 21",
      baselineQuantity: row.baselineQuantity,
      currentQuantity: row.currentQuantity,
      baselineAsOf: row.baselineAsOf,
      identifiers: mock.identifiers.get(productId) ?? [],
      lastChangedAt: row.lastChangedAt,
      openExceptionCount: row.openExceptionCount,
    });
  },
  countOpenExceptions: () => {
    if (isTauriRuntime()) return call<number>("count_open_exceptions");
    return Promise.resolve(mock.inventory.reduce((n, r) => n + r.openExceptionCount, 0));
  },
  devWriteSampleReport: (rows?: number) => {
    if (isTauriRuntime()) return call<string>("dev_write_sample_report", { rows: rows ?? null });
    return Promise.resolve(`accurate_stock_${rows ?? 1284}.xlsx`);
  },
};
