import { useEffect, useRef } from "react";
import { ScanRouter, type RouterEvent, type ScannerConfig, DEFAULT_SCANNER } from "./ScanRouter";

function isEditable(t: EventTarget | null) {
  return (
    t instanceof HTMLElement &&
    (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))
  );
}

export function useScanner(
  enabled: boolean,
  cfg: ScannerConfig | undefined,
  onEvent: (e: RouterEvent) => void,
) {
  const handler = useRef(onEvent);
  handler.current = onEvent;
  const resolved = cfg ?? DEFAULT_SCANNER;

  useEffect(() => {
    if (!enabled) return;
    const router = new ScanRouter(resolved, (e) => handler.current(e));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isEditable(e.target)) return;
      if (router.handleKey(e.key, e.timeStamp)) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      router.dispose();
    };
  }, [enabled, resolved.maxGapMs, resolved.minLength, resolved.idleFlushMs, resolved.dedupMs]);
}
