import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function HistoryPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("history.title")} hint={t("history.empty")} />;
}
