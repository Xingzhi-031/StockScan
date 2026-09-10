import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function EmployeesPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("settings.employeesTitle")} hint={t("common.comingSoon")} />;
}
