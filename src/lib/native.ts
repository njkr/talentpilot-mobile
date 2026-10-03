/**
 * Thin wrappers over Capacitor plugins with web fallbacks, so the browser
 * preview keeps working. Plugins are imported lazily (never during SSR).
 */
import { Capacitor } from "@capacitor/core";

export const isNative = () => typeof window !== "undefined" && Capacitor.isNativePlatform();

export async function openExternal(url: string) {
  if (isNative()) {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export const WEB_BILLING_URL = "https://talentpilot-fe.vercel.app/billing";

export async function copyText(text: string) {
  if (isNative()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ string: text });
    return;
  }
  await navigator.clipboard.writeText(text);
}

export async function readClipboard(): Promise<string> {
  if (isNative()) {
    const { Clipboard } = await import("@capacitor/clipboard");
    const r = await Clipboard.read();
    return r.value ?? "";
  }
  return navigator.clipboard.readText();
}

/** Returns false when sharing isn't available (caller can fall back to copy). */
export async function shareText(title: string, text: string): Promise<boolean> {
  if (isNative()) {
    const { Share } = await import("@capacitor/share");
    await Share.share({ title, text });
    return true;
  }
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return true; // user cancelled
    }
  }
  return false;
}

/** Subscribe to connectivity changes. Returns unsubscribe. */
export function onNetworkChange(cb: (online: boolean) => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (isNative()) {
    let remove: (() => void) | null = null;
    let dead = false;
    void import("@capacitor/network").then(async ({ Network }) => {
      cb((await Network.getStatus()).connected);
      const h = await Network.addListener("networkStatusChange", (s) => cb(s.connected));
      if (dead) void h.remove();
      else remove = () => void h.remove();
    });
    return () => {
      dead = true;
      remove?.();
    };
  }
  const update = () => cb(navigator.onLine);
  update();
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  return () => {
    window.removeEventListener("online", update);
    window.removeEventListener("offline", update);
  };
}

/** App returned to foreground (Capacitor appStateChange, or visibilitychange on web). */
export function onAppResume(cb: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (isNative()) {
    let remove: (() => void) | null = null;
    let dead = false;
    void import("@capacitor/app").then(async ({ App }) => {
      const h = await App.addListener("appStateChange", (s) => s.isActive && cb());
      if (dead) void h.remove();
      else remove = () => void h.remove();
    });
    return () => {
      dead = true;
      remove?.();
    };
  }
  const fn = () => document.visibilityState === "visible" && cb();
  document.addEventListener("visibilitychange", fn);
  return () => document.removeEventListener("visibilitychange", fn);
}

/** Android hardware back button. No-op on web. */
export function onBackButton(cb: () => void): () => void {
  if (!isNative()) return () => undefined;
  let remove: (() => void) | null = null;
  let dead = false;
  void import("@capacitor/app").then(async ({ App }) => {
    const h = await App.addListener("backButton", cb);
    if (dead) void h.remove();
    else remove = () => void h.remove();
  });
  return () => {
    dead = true;
    remove?.();
  };
}

export async function exitApp() {
  if (!isNative()) return;
  const { App } = await import("@capacitor/app");
  await App.exitApp();
}

export async function initNativeChrome() {
  if (!isNative()) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setOverlaysWebView({ overlay: true });
    void Style; /* style is set by ThemeSync */
  } catch {
    /* not supported */
  }
  try {
    /* splash is hidden by LaunchScreen once it has mounted */
  } catch {
    /* ignore */
  }
}

export type HapticKind = "light" | "success" | "warning" | "error";
/** Haptic feedback via @capacitor/haptics. No-op on web. Never throws. */
export function haptic(kind: HapticKind = "light") {
  if (!isNative()) return;
  void import("@capacitor/haptics")
    .then(({ Haptics, ImpactStyle, NotificationType }) =>
      kind === "light"
        ? Haptics.impact({ style: ImpactStyle.Light })
        : Haptics.notification({
            type:
              kind === "success"
                ? NotificationType.Success
                : kind === "warning"
                  ? NotificationType.Warning
                  : NotificationType.Error,
          }),
    )
    .catch(() => undefined);
}
