import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function BackupPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("data.backupTitle")} hint={t("common.comingSoon")} />;
}
