import { useTranslation } from "react-i18next";

export function InvariantBanner({ count }: { count: number }) {
  const { t } = useTranslation();
  if (count <= 0) return null;
  return (
    <div className="bg-neg text-white px-6 py-2 text-sm font-semibold">
      {t("app.invariantBanner", { count })}
    </div>
  );
}
