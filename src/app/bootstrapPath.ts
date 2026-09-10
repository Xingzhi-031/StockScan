export function bootstrapPath(
  setupCompleted: boolean,
  hasOperator: boolean,
): "/setup" | "/operator" | "/scan" {
  if (!setupCompleted) return "/setup";
  if (!hasOperator) return "/operator";
  return "/scan";
}
