export type AppError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

function isAppError(e: unknown): e is AppError {
  return (
    !!e &&
    typeof e === "object" &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string" &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  );
}

export function toAppError(e: unknown): AppError {
  if (isAppError(e)) return e;
  if (typeof e === "string") {
    try {
      const parsed: unknown = JSON.parse(e);
      if (isAppError(parsed)) return parsed;
    } catch {
      /* fall through */
    }
    return { code: "INTERNAL", message: e };
  }
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const message = (e as { message: string }).message;
    try {
      const parsed: unknown = JSON.parse(message);
      if (isAppError(parsed)) return parsed;
    } catch {
      /* fall through */
    }
    return { code: "INTERNAL", message };
  }
  return { code: "INTERNAL", message: "Unknown error" };
}

type Translate = (key: string, vars?: Record<string, unknown>) => string;

export function errorMessage(e: unknown, t: Translate): string {
  const err = toAppError(e);
  const reason = typeof err.details?.reason === "string" ? err.details.reason : "";
  const kind = typeof err.details?.kind === "string" ? err.details.kind : "";
  if (reason) {
    const key = `errors.${reason}`;
    const translated = t(key, err.details);
    if (translated !== key) return translated;
  }
  if (kind) {
    const key = `errors.${kind}`;
    const translated = t(key, err.details);
    if (translated !== key) return translated;
  }
  const codeKey = `errors.${err.code}`;
  const translated = t(codeKey, err.details);
  if (translated !== codeKey) return translated;
  return t("errors.GENERIC");
}
