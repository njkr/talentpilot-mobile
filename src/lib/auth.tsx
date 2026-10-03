import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  ApiError,
  applySession,
  clearSession,
  refreshSession,
  setAuthListener,
  type MobileSessionResponse,
} from "@/lib/api";
import { tokenStorage } from "@/lib/tokenStorage";
import { userCache, type CachedUser } from "@/lib/userCache";
import { onAppResume, onNetworkChange } from "@/lib/native";
import type { User } from "@/types/api";

/**
 * Launch / session state.
 *  - authed + offline:true → signed in from the cached user; server not reachable yet.
 *  - unreachable → we have a refresh token but no cached user and no server: show Retry.
 *
 * ⚠️ Only a 401 TOKEN_INVALID / TOKEN_REUSE_DETECTED (or no stored token) may sign the user
 * out. Network errors, 5xx and timeouts must keep the refresh token.
 */
type Status = "loading" | "authed" | "guest" | "unreachable";
type AuthCtx = {
  status: Status;
  user: User | null;
  offline: boolean;
  retry: () => void;
  signIn: (s: MobileSessionResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const isFatalAuthError = (e: unknown) =>
  e instanceof ApiError &&
  e.status === 401 &&
  (e.code === "TOKEN_INVALID" || e.code === "TOKEN_REUSE_DETECTED");

const fromCache = (c: CachedUser): User => ({ ...c, role: "user", createdAt: "" });
/** Backoff for launch retries: 2s, 4s, 8s … capped at 60s. */
export const backoffMs = (attempt: number) => Math.min(60_000, 2_000 * 2 ** attempt);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);
  const pending = useRef(false); // a launch refresh is still owed
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const toGuest = useCallback(async () => {
    pending.current = false;
    await clearSession();
    await userCache.clear();
    if (!alive.current) return;
    qc.clear();
    setUser(null);
    setOffline(false);
    setStatus("guest");
  }, [qc]);

  const tryRefresh = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    try {
      const s = await refreshSession(); // onSession listener sets user/status
      pending.current = false;
      attempt.current = 0;
      if (alive.current && s.user.isVerified === false) await toGuest();
    } catch (e) {
      if (isFatalAuthError(e)) return toGuest();
      // Network / 5xx / timeout: keep the token and stay where we are.
      pending.current = true;
      if (!alive.current) return;
      const cached = await userCache.get();
      if (cached) {
        setUser((u) => u ?? fromCache(cached));
        setOffline(true);
        setStatus("authed");
      } else {
        setStatus((s) => (s === "authed" ? s : "unreachable"));
      }
      const wait = backoffMs(attempt.current++);
      timer.current = setTimeout(() => void tryRefresh(), wait);
    }
  }, [toGuest]);

  useEffect(() => {
    alive.current = true;
    setAuthListener({
      onSession: (s) => {
        void userCache.set(s.user);
        pending.current = false;
        setUser(s.user);
        setOffline(false);
        setStatus("authed");
      },
      onLogout: () => {
        void userCache.clear();
        pending.current = false;
        qc.clear();
        setUser(null);
        setOffline(false);
        setStatus("guest");
      },
    });
    (async () => {
      const rt = await tokenStorage.get();
      if (!rt) {
        await userCache.clear();
        if (alive.current) setStatus("guest");
        return;
      }
      await tryRefresh();
    })();
    const now = () => {
      if (!pending.current) return;
      attempt.current = 0;
      void tryRefresh();
    };
    const offNet = onNetworkChange((online) => online && now());
    const offResume = onAppResume(now);
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
      offNet();
      offResume();
      setAuthListener(null);
    };
  }, [qc, tryRefresh]);

  const retry = useCallback(() => {
    attempt.current = 0;
    void tryRefresh();
  }, [tryRefresh]);

  const signIn = useCallback(async (s: MobileSessionResponse) => {
    await applySession(s);
    await userCache.set(s.user);
    pending.current = false;
    setUser(s.user);
    setOffline(false);
    setStatus("authed");
  }, []);

  const signOut = useCallback(async () => {
    const rt = await tokenStorage.get();
    try {
      await api.post("/auth/logout", rt ? { refreshToken: rt } : undefined);
    } catch {
      /* logout is idempotent; wipe locally regardless */
    }
    await toGuest();
  }, [toGuest]);

  const value = useMemo(
    () => ({ status, user, offline, retry, signIn, signOut }),
    [status, user, offline, retry, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
