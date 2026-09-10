import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function BarcodeSetupPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("barcodes.title")} hint={t("common.comingSoon")} />;
}
