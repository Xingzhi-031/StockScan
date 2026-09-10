import { Navigate, Route, Routes } from "react-router";
import { RequireShell, RootRedirect } from "./guards";
import { AppShell, BareLayout } from "./layouts";
import { SetupWizard } from "../features/setup/SetupWizard";
import { OperatorSelectPage } from "../features/operator/OperatorSelectPage";
import { ScanPage } from "../features/scan/ScanPage";
import { InventoryPage } from "../features/inventory/InventoryPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { DataLayout } from "../features/data/DataNav";
import { ImportPage } from "../features/data/ImportPage";
import { ReconcilePage } from "../features/data/ReconcilePage";
import { ExportPages } from "../features/data/ExportPages";
import { BackupPage } from "../features/data/BackupPage";
import { BarcodeSetupPage } from "../features/barcodes/BarcodeSetupPage";
import { BarcodeImportPage } from "../features/barcodes/BarcodeImportPage";
import { EmployeesPage } from "../features/settings/EmployeesPage";
import { PreferencesPage } from "../features/settings/PreferencesPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<BareLayout />}>
        <Route path="/setup" element={<SetupWizard />} />
        <Route path="/operator" element={<OperatorSelectPage />} />
      </Route>

      <Route element={<RequireShell />}>
        <Route element={<AppShell />}>
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/data" element={<DataLayout />}>
            <Route index element={<Navigate to="import" replace />} />
            <Route path="import" element={<ImportPage />} />
            <Route path="reconcile" element={<ReconcilePage />} />
            <Route path="export" element={<ExportPages />} />
            <Route path="backup" element={<BackupPage />} />
          </Route>
          <Route path="/settings/barcodes" element={<BarcodeSetupPage />} />
          <Route path="/settings/barcodes/import" element={<BarcodeImportPage />} />
          <Route path="/settings/employees" element={<EmployeesPage />} />
          <Route path="/settings/preferences" element={<PreferencesPage />} />
        </Route>
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
