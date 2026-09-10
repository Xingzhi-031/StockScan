import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function ExportPages() {
  const { t } = useTranslation();
  return <EmptyState title={t("data.exportTitle")} hint={t("common.comingSoon")} />;
}
