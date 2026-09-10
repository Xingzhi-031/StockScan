import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function PreferencesPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("settings.preferencesTitle")} hint={t("common.comingSoon")} />;
}
