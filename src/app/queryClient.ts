import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

export const qk = {
  settings: ["settings"] as const,
  startup: ["startup"] as const,
  inventory: ["inventory"] as const,
  product: (id: number) => ["product", id] as const,
  transactions: (q: unknown) => ["transactions", q] as const,
  session: (operatorId: number) => ["session", operatorId] as const,
  exceptionsCount: ["exceptions", "count"] as const,
  exceptions: ["exceptions", "list"] as const,
  coverage: ["barcodes", "coverage"] as const,
  batches: ["exportBatches"] as const,
  employees: ["employees"] as const,
};

export function invalidateAfterStockChange(qc: QueryClient, productId: number) {
  void qc.invalidateQueries({ queryKey: qk.inventory });
  void qc.invalidateQueries({ queryKey: qk.product(productId) });
  void qc.invalidateQueries({ queryKey: ["transactions"] });
  void qc.invalidateQueries({ queryKey: ["session"] });
  void qc.invalidateQueries({ queryKey: qk.exceptionsCount });
}
