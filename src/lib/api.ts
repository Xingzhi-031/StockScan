import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../bindings/Settings";
import type { StartupState } from "../bindings/StartupState";
import { toAppError } from "./errors";

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

const MOCK_STARTUP: StartupState = {
  setupCompleted: false,
  invariantViolations: 0,
  lastBackupAt: null,
  secondaryBackupStale: true,
  activeLocation: null,
  companyName: null,
  dataDir: "",
  appVersion: "0.1.0",
};

const MOCK_SETTINGS: Settings = {
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
};

export const api = {
  getStartupState: () =>
    isTauriRuntime() ? call<StartupState>("get_startup_state") : Promise.resolve(MOCK_STARTUP),
  getSettings: () =>
    isTauriRuntime() ? call<Settings>("get_settings") : Promise.resolve(MOCK_SETTINGS),
};
