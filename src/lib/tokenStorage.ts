/**
 * Refresh-token storage. Prefers Capacitor secure storage, then Capacitor
 * Preferences, then localStorage (web preview). The access token is NEVER stored.
 */
const KEY = "tp_refresh_token";

type CapPlugins = {
  SecureStoragePlugin?: {
    get(o: { key: string }): Promise<{ value: string }>;
    set(o: { key: string; value: string }): Promise<unknown>;
    remove(o: { key: string }): Promise<unknown>;
  };
  Preferences?: {
    get(o: { key: string }): Promise<{ value: string | null }>;
    set(o: { key: string; value: string }): Promise<void>;
    remove(o: { key: string }): Promise<void>;
  };
};

async function plugins(): Promise<CapPlugins | null> {
  if (typeof window === "undefined") return null;
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  const out: CapPlugins = {};
  try {
    const m = (await import("capacitor-secure-storage-plugin")) as unknown as {
      SecureStoragePlugin?: NonNullable<CapPlugins["SecureStoragePlugin"]>;
    };
    if (m.SecureStoragePlugin) out.SecureStoragePlugin = m.SecureStoragePlugin;
  } catch {
    /* unavailable */
  }
  if (!out.SecureStoragePlugin)
    out.Preferences = (await import("@capacitor/preferences")).Preferences;
  return out;
}

export const tokenStorage = {
  async get(): Promise<string | null> {
    const p = await plugins();
    try {
      if (p?.SecureStoragePlugin)
        return (await p.SecureStoragePlugin.get({ key: KEY })).value || null;
    } catch {
      return null; // key missing throws in secure storage
    }
    if (p?.Preferences) return (await p.Preferences.get({ key: KEY })).value;
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(KEY);
  },
  async set(value: string): Promise<void> {
    const p = await plugins();
    if (p?.SecureStoragePlugin) return void (await p.SecureStoragePlugin.set({ key: KEY, value }));
    if (p?.Preferences) return p.Preferences.set({ key: KEY, value });
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, value);
  },
  async clear(): Promise<void> {
    const p = await plugins();
    try {
      if (p?.SecureStoragePlugin) await p.SecureStoragePlugin.remove({ key: KEY });
    } catch {
      /* ignore */
    }
    if (p?.Preferences) await p.Preferences.remove({ key: KEY });
    if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
  },
};
