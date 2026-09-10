import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function ReconcilePage() {
  const { t } = useTranslation();
  return <EmptyState title={t("data.reconcileTitle")} hint={t("common.comingSoon")} />;
}
