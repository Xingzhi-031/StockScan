import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Button } from "../../components/Button";
import { qk } from "../../app/queryClient";
import { api } from "../../lib/api";
import type { EmployeeDto } from "../../bindings/EmployeeDto";
import type { Role } from "../../bindings/Role";
import { errorMessage } from "../../lib/errors";
import { useOperatorStore } from "../../stores/operatorStore";

const emptyForm = { code: "", name: "", role: "OPERATOR" as Role };

export function EmployeesPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const operator = useOperatorStore((s) => s.operator);
  const setOperator = useOperatorStore((s) => s.setOperator);
  const canEdit = operator?.role === "ADMIN";
  const list = useQuery({
    queryKey: [...qk.employees, "all"],
    queryFn: () => api.listEmployees(true),
  });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function fill(emp: EmployeeDto) {
    setEditingId(emp.id);
    setForm({ code: emp.employeeCode, name: emp.name, role: emp.role });
    setConfirmId(null);
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setConfirmId(null);
  }

  const save = useMutation({
    mutationFn: () =>
      api.upsertEmployee({
        id: editingId,
        employeeCode: form.code,
        name: form.name,
        role: form.role,
      }),
    onSuccess: (row) => {
      if (operator && row.id === operator.id) {
        setOperator({
          id: row.id,
          name: row.name,
          employeeCode: row.employeeCode,
          role: row.role,
        });
      }
      resetForm();
      setError(null);
      void qc.invalidateQueries({ queryKey: qk.employees });
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.setEmployeeActive(id, active),
    onSuccess: (row) => {
      setError(null);
      setConfirmId(null);
      void qc.invalidateQueries({ queryKey: qk.employees });
      if (operator && row.id === operator.id && !row.isActive) {
        setOperator(null);
        navigate("/operator");
      }
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  return (
    <div className="flex flex-col gap-5 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold">{t("settings.employeesTitle")}</h1>
        <p className="text-sm text-sub mt-1">{t("employees.hint")}</p>
      </div>

      {canEdit ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-[14px] border border-line bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sub">{t("employees.code")}</span>
            <input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              className="h-10 w-28 px-3 rounded-[10px] border border-line font-mono outline-none focus:border-ink"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1 min-w-40">
            <span className="text-sub">{t("employees.name")}</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="h-10 px-3 rounded-[10px] border border-line outline-none focus:border-ink"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sub">{t("employees.role")}</span>
            <select
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              className="h-10 px-3 rounded-[10px] border border-line bg-surface"
            >
              <option value="OPERATOR">{t("employees.roleOperator")}</option>
              <option value="ADMIN">{t("employees.roleAdmin")}</option>
            </select>
          </label>
          <Button type="submit" disabled={save.isPending}>
            {editingId == null ? t("employees.add") : t("common.save")}
          </Button>
          {editingId != null ? (
            <Button type="button" variant="ghost" onClick={resetForm}>
              {t("common.cancel")}
            </Button>
          ) : null}
        </form>
      ) : (
        <p className="text-sm text-sub">{t("employees.adminOnly")}</p>
      )}

      {error ? <p className="text-sm text-neg">{error}</p> : null}

      <div className="rounded-[14px] border border-line bg-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-soft text-left text-sub">
            <tr>
              <th className="px-4 py-3 font-medium">{t("employees.name")}</th>
              <th className="px-4 py-3 font-medium font-mono">{t("employees.code")}</th>
              <th className="px-4 py-3 font-medium">{t("employees.role")}</th>
              <th className="px-4 py-3 font-medium">{t("employees.status")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(list.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sub">
                  {t("employees.empty")}
                </td>
              </tr>
            ) : (
              (list.data ?? []).map((emp) => (
                <tr key={emp.id} className="border-t border-line">
                  <td className="px-4 py-3 font-semibold">{emp.name}</td>
                  <td className="px-4 py-3 font-mono text-sub">#{emp.employeeCode}</td>
                  <td className="px-4 py-3">
                    {emp.role === "ADMIN" ? t("employees.roleAdmin") : t("employees.roleOperator")}
                  </td>
                  <td className="px-4 py-3 text-sub">
                    {emp.isActive ? t("employees.active") : t("employees.inactive")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" className="h-8 text-xs" onClick={() => fill(emp)}>
                          {t("employees.edit")}
                        </Button>
                        {confirmId === emp.id && emp.isActive ? (
                          <>
                            <Button
                              variant="danger"
                              className="h-8 text-xs"
                              onClick={() => toggle.mutate({ id: emp.id, active: false })}
                            >
                              {t("common.confirm")}
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={() => setConfirmId(null)}
                            >
                              {t("common.cancel")}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() =>
                              emp.isActive
                                ? setConfirmId(emp.id)
                                : toggle.mutate({ id: emp.id, active: true })
                            }
                          >
                            {emp.isActive ? t("employees.deactivate") : t("employees.activate")}
                          </Button>
                        )}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
