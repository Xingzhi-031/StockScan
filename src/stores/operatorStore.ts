import { create } from "zustand";

export type Operator = {
  id: number;
  name: string;
  employeeCode: string;
  role: "OPERATOR" | "ADMIN";
};

type OperatorState = {
  operator: Operator | null;
  setOperator: (operator: Operator | null) => void;
};

export const useOperatorStore = create<OperatorState>((set) => ({
  operator: null,
  setOperator: (operator) => set({ operator }),
}));
