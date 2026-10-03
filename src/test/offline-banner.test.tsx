import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { AuthContext, type AuthCtx } from "@/lib/auth";
import { onlineStore } from "@/lib/stores";
import { OfflineBanner } from "@/components/OfflineBanner";
import { routeTree } from "@/routeTree.gen";

const ctx = (over: Partial<AuthCtx>) =>
  ({
    status: "authed",
    user: { id: "u1", email: "a@b.c", isVerified: true },
    offline: false,
    ...over,
  }) as unknown as AuthCtx;

const banner = () => screen.queryByRole("status");

beforeEach(() => {
  st.token = null;
  st.user = null;
  act(() => onlineStore.set(true));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("OfflineBanner", () => {
  it("does not throw when rendered outside AuthProvider (e.g. mid hot-reload)", () => {
    expect(() => render(<OfflineBanner />)).not.toThrow();
    expect(banner()).toBeNull();
  });

  it("still shows the no-network notice outside AuthProvider", () => {
    act(() => onlineStore.set(false));
    render(<OfflineBanner />);
    expect(banner()?.textContent).toMatch(/offline/i);
  });

  it.each([
    ["signed-in, online", ctx({}), true, null],
    ["guest, online", ctx({ status: "guest", user: null } as Partial<AuthCtx>), true, null],
    ["signed-in, server unreachable", ctx({ offline: true }), true, /can't reach/i],
    ["signed-in, no network", ctx({}), false, /offline/i],
    ["loading, no network", ctx({ status: "loading", user: null } as Partial<AuthCtx>), false, /offline/i],
  ])("%s", (_name, value, online, expected) => {
    act(() => onlineStore.set(online));
    render(
      <AuthContext.Provider value={value}>
        <OfflineBanner />
      </AuthContext.Provider>,
    );
    if (expected) expect(banner()?.textContent).toMatch(expected);
    else expect(banner()).toBeNull();
  });
});

function renderRoot(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}

describe("Root route never blanks", () => {
  it("renders with no stored session while the device is offline", async () => {
    act(() => onlineStore.set(false));
    const { container } = renderRoot("/login");
    await waitFor(() => expect(container.textContent?.length ?? 0).toBeGreaterThan(0));
    expect(banner()?.textContent).toMatch(/offline/i);
  });

  it("renders with a stored session when the server is unreachable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    st.token = "rt1";
    st.user = JSON.stringify({ id: "u1", email: "a@b.c", isVerified: true });
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
    const { container } = renderRoot("/login");
    await waitFor(() => expect(container.textContent?.length ?? 0).toBeGreaterThan(0));
    await waitFor(() => expect(banner()?.textContent).toMatch(/can't reach/i));
  });
});
