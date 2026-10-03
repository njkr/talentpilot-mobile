import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/config", () => ({ API_BASE_URL: "https://api.test/api/v1", IS_NGROK: false }));
const st = vi.hoisted(() => ({ token: null as string | null, user: null as string | null }));
vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    get: vi.fn(async () => st.token),
    set: vi.fn(async (v: string) => void (st.token = v)),
    clear: vi.fn(async () => void (st.token = null)),
  },
}));
vi.mock("@/lib/userCache", () => ({
  userCache: {
    get: vi.fn(async () => (st.user ? JSON.parse(st.user) : null)),
    set: vi.fn(async (u: unknown) => void (st.user = JSON.stringify(u))),
    clear: vi.fn(async () => void (st.user = null)),
  },
}));
const net = vi.hoisted(() => ({ cb: null as ((o: boolean) => void) | null }));
vi.mock("@/lib/native", () => ({
  onNetworkChange: (cb: (o: boolean) => void) => ((net.cb = cb), () => undefined),
  onAppResume: () => () => undefined,
}));

import { AuthProvider, useAuth } from "@/lib/auth";
import { setAccessToken } from "@/lib/api";

function Probe() {
  const { status, offline, user } = useAuth();
  return <div data-testid="s">{`${status}|${offline}|${user?.email ?? ""}`}</div>;
}
const renderAuth = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
const text = () => screen.getByTestId("s").textContent;
const fail = (status: number, code: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message: code }, meta: { requestId: "r" } }), { status });
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data, meta: { requestId: "r" } }), { status: 200 });

beforeEach(() => {
  st.token = "rt1";
  st.user = null;
  setAccessToken(null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("auth bootstrap", () => {
  it("offline launch keeps the token and enters offline mode from the cached user", async () => {
    st.user = JSON.stringify({ id: "u1", email: "a@b.c", isVerified: true });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    renderAuth();
    await waitFor(() => expect(text()).toBe("authed|true|a@b.c"));
    expect(st.token).toBe("rt1");
  });

  it("a 5xx on launch also keeps the token", async () => {
    st.user = JSON.stringify({ id: "u1", email: "a@b.c", isVerified: true });
    vi.stubGlobal("fetch", vi.fn(async () => fail(503, "INTERNAL_ERROR")));
    renderAuth();
    await waitFor(() => expect(text()).toBe("authed|true|a@b.c"));
    expect(st.token).toBe("rt1");
  });

  it("no cached user + unreachable server → 'unreachable', token kept", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    renderAuth();
    await waitFor(() => expect(text()).toBe("unreachable|false|"));
    expect(st.token).toBe("rt1");
  });

  it("recovers when the network comes back", async () => {
    st.user = JSON.stringify({ id: "u1", email: "a@b.c", isVerified: true });
    const f = vi.fn(async () => Promise.reject(new TypeError("offline")));
    vi.stubGlobal("fetch", f);
    renderAuth();
    await waitFor(() => expect(text()).toBe("authed|true|a@b.c"));
    f.mockImplementation(async () =>
      ok({ accessToken: "at", refreshToken: "rt2", user: { id: "u1", email: "a@b.c", isVerified: true } }) as never,
    );
    await act(async () => net.cb?.(true));
    await waitFor(() => expect(text()).toBe("authed|false|a@b.c"));
    expect(st.token).toBe("rt2");
  });

  it.each(["TOKEN_INVALID", "TOKEN_REUSE_DETECTED"])("a 401 %s on launch logs out", async (code) => {
    st.user = JSON.stringify({ id: "u1", email: "a@b.c", isVerified: true });
    vi.stubGlobal("fetch", vi.fn(async () => fail(401, code)));
    renderAuth();
    await waitFor(() => expect(text()).toBe("guest|false|"));
    expect(st.token).toBeNull();
    expect(st.user).toBeNull();
  });

  it("no stored token → guest without calling the server", async () => {
    st.token = null;
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    renderAuth();
    await waitFor(() => expect(text()).toBe("guest|false|"));
    expect(f).not.toHaveBeenCalled();
  });
});
