import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function ImportPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("data.importTitle")} hint={t("common.comingSoon")} />;
}
