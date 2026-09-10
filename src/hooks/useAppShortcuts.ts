import { useEffect } from "react";

const CTRL_BLOCK = new Set(["r", "f", "g", "p", "u", "s"]);
const FN_BLOCK = new Set(["F1", "F2", "F3", "F4", "F5"]);

export function useAppShortcuts() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (FN_BLOCK.has(e.key)) {
        e.preventDefault();
        return;
      }
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (CTRL_BLOCK.has(key)) e.preventDefault();
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      if (import.meta.env.PROD) e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    window.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown, { capture: true });
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);
}
