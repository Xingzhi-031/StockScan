import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function InventoryPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("inventory.title")} hint={t("inventory.empty")} />;
}
