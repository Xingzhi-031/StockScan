import { useTranslation } from "react-i18next";
import { EmptyState } from "../../components/EmptyState";

export function BarcodeImportPage() {
  const { t } = useTranslation();
  return <EmptyState title={t("barcodes.importTitle")} hint={t("common.comingSoon")} />;
}
