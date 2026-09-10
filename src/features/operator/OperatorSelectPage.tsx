import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button";
import { unlockAudio } from "../../lib/sound";
import { useOperatorStore } from "../../stores/operatorStore";

export function OperatorSelectPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setOperator = useOperatorStore((s) => s.setOperator);

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-[14px] border border-line bg-surface p-8 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold">{t("operator.title")}</h1>
          <p className="mt-2 text-sm text-sub">{t("operator.subtitle")}</p>
        </div>
        <p className="text-sm text-sub">{t("operator.empty")}</p>
        <Button
          onClick={() => {
            unlockAudio();
            setOperator({
              id: -1,
              name: t("common.guest"),
              employeeCode: "DEV",
              role: "ADMIN",
            });
            navigate("/scan");
          }}
        >
          {t("operator.enterGuest")}
        </Button>
      </div>
    </div>
  );
}
