import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function ExceptionsPanel() {
  const { t } = useTranslation();
  return <EmptyState title={t("exceptions.title")} hint={t("exceptions.empty")} />;
}
