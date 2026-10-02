import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, applySession, clearSession, refreshSession, setAuthListener, type MobileSessionResponse } from "@/lib/api";
import { tokenStorage } from "@/lib/tokenStorage";
import type { User } from "@/types/api";

type Status = "loading" | "authed" | "guest";
type AuthCtx = {
  status: Status;
  user: User | null;
  signIn: (s: MobileSessionResponse) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    setAuthListener({
      onSession: (s) => {
        setUser(s.user);
        setStatus("authed");
      },
      onLogout: () => {
        qc.clear();
        setUser(null);
        setStatus("guest");
      },
    });
    let cancelled = false;
    (async () => {
      const rt = await tokenStorage.get();
      if (!rt) return !cancelled && setStatus("guest");
      try {
        const s = await refreshSession();
        if (!cancelled && s.user.isVerified === false) setStatus("guest");
      } catch {
        await clearSession();
        if (!cancelled) setStatus("guest");
      }
    })();
    return () => {
      cancelled = true;
      setAuthListener(null);
    };
  }, [qc]);

  const signIn = useCallback(async (s: MobileSessionResponse) => {
    await applySession(s);
    setUser(s.user);
    setStatus("authed");
  }, []);

  const signOut = useCallback(async () => {
    const rt = await tokenStorage.get();
    try {
      await api.post("/auth/logout", rt ? { refreshToken: rt } : undefined);
    } catch {
      /* logout is idempotent; wipe locally regardless */
    }
    await clearSession();
    qc.clear();
    setUser(null);
    setStatus("guest");
  }, [qc]);

  const value = useMemo(() => ({ status, user, signIn, signOut }), [status, user, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
