import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function ScanPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-1 flex-col gap-3.5 min-h-0">
      <div className="text-xs font-semibold tracking-wider uppercase text-sub">
        {t("scan.scannerReady")}
      </div>
      <EmptyState title={t("scan.waiting")} hint={t("scan.waitingHint")} />
    </div>
  );
}
