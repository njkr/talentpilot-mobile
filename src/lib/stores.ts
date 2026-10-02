/** Tiny global stores (no extra deps) for app-wide sheets and connectivity. */
import { useSyncExternalStore } from "react";

function createStore<T>(initial: T) {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set: (next: T) => {
      state = next;
      subs.forEach((s) => s());
    },
    subscribe: (fn: () => void) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
function useStore<T>(s: ReturnType<typeof createStore<T>>) {
  return useSyncExternalStore(s.subscribe, s.get, s.get);
}

// ── Upgrade sheet ─────────────────────────────────────────────────────
export type UpgradeInfo = {
  kind: "credits" | "limit";
  required?: number | undefined;
  balance?: number | undefined;
  limit?: number | undefined;
  current?: number | undefined;
  feature?: string | undefined;
} | null;
export const upgradeStore = createStore<UpgradeInfo>(null);
export const useUpgrade = () => useStore(upgradeStore);
export const openUpgrade = (i: NonNullable<UpgradeInfo>) => upgradeStore.set(i);
export const closeUpgrade = () => upgradeStore.set(null);

// ── New analysis sheet ────────────────────────────────────────────────
export type NewAnalysisInit = { resumeId?: string | undefined; jobId?: string | undefined } | null;
export const newAnalysisStore = createStore<NewAnalysisInit>(null);
export const useNewAnalysis = () => useStore(newAnalysisStore);
export const openNewAnalysis = (i: NonNullable<NewAnalysisInit> = {}) => newAnalysisStore.set(i);
export const closeNewAnalysis = () => newAnalysisStore.set(null);

// ── Connectivity ──────────────────────────────────────────────────────
export const onlineStore = createStore<boolean>(true);
export const useOnline = () => useStore(onlineStore);

// ── Open sheet stack (for Android back button) ────────────────────────
const sheetStack: (() => void)[] = [];
export function pushSheet(close: () => void) {
  sheetStack.push(close);
  return () => {
    const i = sheetStack.lastIndexOf(close);
    if (i >= 0) sheetStack.splice(i, 1);
  };
}
/** Closes the top-most open sheet. Returns true if one was closed. */
export function closeTopSheet(): boolean {
  const top = sheetStack[sheetStack.length - 1];
  if (!top) return false;
  top();
  return true;
}
