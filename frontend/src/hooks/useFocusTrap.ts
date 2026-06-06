import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function useFocusTrap<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0];
      const last  = items[items.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
      }
    }

    const firstFocusable = focusable()[0];
    firstFocusable?.focus();

    el.addEventListener("keydown", handleKeyDown);
    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return ref;
}
