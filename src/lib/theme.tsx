import { useEffect, useSyncExternalStore } from "react";
import { isNative } from "./native";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "tp-theme";
const listeners = new Set<() => void>();

/** Runs before React renders so there's no light flash on launch. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${KEY}');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

function read(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const resolve = (c: ThemeChoice) => (c === "system" ? (media().matches ? "dark" : "light") : c);

function apply() {
  const dark = resolve(read()) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0e121a" : "#ffffff");
  listeners.forEach((l) => l());
}

export function setTheme(c: ThemeChoice) {
  localStorage.setItem(KEY, c);
  apply();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);
  const resolved = useSyncExternalStore(
    subscribe,
    () => resolve(read()),
    () => "light" as const,
  );
  return { theme, resolved, setTheme };
}

/** Mount once: follows live phone theme changes and syncs the native status bar. */
export function ThemeSync() {
  const { resolved } = useTheme();
  useEffect(() => {
    apply();
    const m = media();
    const on = () => apply();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    if (!isNative()) return;
    void (async () => {
      try {
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: resolved === "dark" ? Style.Dark : Style.Light });
      } catch {
        /* not supported */
      }
    })();
  }, [resolved]);
  return null;
}
