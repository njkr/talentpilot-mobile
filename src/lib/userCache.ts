/**
 * Minimal cached user (id, email, isVerified) so the app can open signed-in while the
 * server is unreachable. Capacitor Preferences on native, localStorage on web.
 * Not a secret: the refresh token stays in tokenStorage.
 */
export type CachedUser = { id: string; email: string; isVerified: boolean };
const KEY = "tp_cached_user";

async function prefs() {
  if (typeof window === "undefined") return null;
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return null;
  return (await import("@capacitor/preferences")).Preferences;
}

export const userCache = {
  async get(): Promise<CachedUser | null> {
    try {
      const p = await prefs();
      const raw = p ? (await p.get({ key: KEY })).value : typeof window !== "undefined" ? window.localStorage.getItem(KEY) : null;
      if (!raw) return null;
      const u = JSON.parse(raw) as Partial<CachedUser>;
      return typeof u.id === "string" && typeof u.email === "string" ? { id: u.id, email: u.email, isVerified: u.isVerified !== false } : null;
    } catch {
      return null;
    }
  },
  async set(u: { id: string; email: string; isVerified?: boolean | undefined }): Promise<void> {
    const value = JSON.stringify({ id: u.id, email: u.email, isVerified: u.isVerified !== false });
    try {
      const p = await prefs();
      if (p) await p.set({ key: KEY, value });
      else if (typeof window !== "undefined") window.localStorage.setItem(KEY, value);
    } catch {
      /* best effort */
    }
  },
  async clear(): Promise<void> {
    try {
      const p = await prefs();
      if (p) await p.remove({ key: KEY });
      if (typeof window !== "undefined") window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
