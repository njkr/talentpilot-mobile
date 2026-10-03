import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config", () => ({ API_BASE_URL: "https://api.test/api/v1", IS_NGROK: false }));
const store = vi.hoisted(() => ({ token: null as string | null, log: [] as string[] }));
vi.mock("@/lib/tokenStorage", () => ({
  tokenStorage: {
    get: vi.fn(async () => store.token),
    set: vi.fn(async (v: string) => {
      store.log.push(`persist:${v}`);
      store.token = v;
    }),
    clear: vi.fn(async () => {
      store.token = null;
    }),
  },
}));

import { api, setAccessToken, setAuthListener } from "@/lib/api";

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[] = [];
const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data, meta: { requestId: "r" } }), { status: 200 });
const fail = (status: number, code: string) =>
  new Response(JSON.stringify({ success: false, error: { code, message: code }, meta: { requestId: "r" } }), { status });
const session = (rt: string, at = `at-${rt}`) => ({ accessToken: at, refreshToken: rt, user: { id: "u1", email: "a@b.c", isVerified: true } });

function mockFetch(handler: (c: Call, n: number) => Response | Promise<Response>) {
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      const c: Call = {
        url: String(url).replace("https://api.test/api/v1", ""),
        method: init.method ?? "GET",
        headers: init.headers as Record<string, string>,
        body: init.body ? JSON.parse(String(init.body)) : undefined,
      };
      calls.push(c);
      if (c.url === "/auth/refresh") store.log.push(`refresh:${(c.body as { refreshToken: string }).refreshToken}`);
      else store.log.push(`req:${c.url}:${c.headers["Authorization"] ?? "none"}`);
      return handler(c, n++);
    }),
  );
}

const onLogout = vi.fn();
beforeEach(() => {
  calls = [];
  store.token = "rt1";
  store.log = [];
  onLogout.mockReset();
  setAccessToken("old");
  setAuthListener({ onSession: () => undefined, onLogout });
});
afterEach(() => vi.unstubAllGlobals());

describe("api auth handling", () => {
  it("TOKEN_EXPIRED: parallel requests share ONE refresh, then replay", async () => {
    mockFetch((c) => {
      if (c.url === "/auth/refresh") return ok(session("rt2"));
      return c.headers["Authorization"] === "Bearer old" ? fail(401, "TOKEN_EXPIRED") : ok({ path: c.url });
    });
    const res = await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);
    expect(res).toEqual([{ path: "/a" }, { path: "/b" }, { path: "/c" }]);
    expect(calls.filter((c) => c.url === "/auth/refresh")).toHaveLength(1);
    expect(calls.filter((c) => c.headers["Authorization"] === "Bearer at-rt2")).toHaveLength(3);
  });

  it("persists the rotated refresh token before replaying", async () => {
    mockFetch((c) => {
      if (c.url === "/auth/refresh") return ok(session("rt2"));
      return c.headers["Authorization"] === "Bearer old" ? fail(401, "TOKEN_EXPIRED") : ok(1);
    });
    await api.get("/a");
    const persist = store.log.indexOf("persist:rt2");
    const replay = store.log.indexOf("req:/a:Bearer at-rt2");
    expect(persist).toBeGreaterThan(-1);
    expect(persist).toBeLessThan(replay);
  });

  it("refresh TOKEN_SUPERSEDED: re-reads the rotated token and retries once", async () => {
    mockFetch((c) => {
      if (c.url === "/auth/refresh") {
        const rt = (c.body as { refreshToken: string }).refreshToken;
        if (rt === "rt1") {
          store.token = "rt-other"; // a concurrent rotation landed
          return fail(401, "TOKEN_SUPERSEDED");
        }
        return ok(session("rt3"));
      }
      return c.headers["Authorization"] === "Bearer old" ? fail(401, "TOKEN_EXPIRED") : ok("done");
    });
    await expect(api.get("/a")).resolves.toBe("done");
    expect(store.log.filter((l) => l.startsWith("refresh:"))).toEqual(["refresh:rt1", "refresh:rt-other"]);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it.each(["TOKEN_INVALID", "TOKEN_REUSE_DETECTED"])("%s logs out", async (code) => {
    mockFetch(() => fail(401, code));
    await expect(api.get("/a")).rejects.toMatchObject({ code });
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(store.token).toBeNull();
  });

  it("a network error never logs out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("offline"))));
    await expect(api.get("/a")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(onLogout).not.toHaveBeenCalled();
    expect(store.token).toBe("rt1");
  });

  it("reuses the same Idempotency-Key on replay", async () => {
    mockFetch((c) => {
      if (c.url === "/auth/refresh") return ok(session("rt2"));
      return c.headers["Authorization"] === "Bearer old" ? fail(401, "TOKEN_EXPIRED") : ok(1);
    });
    await api.postIdempotent("/workspaces", { x: 1 });
    const keys = calls.filter((c) => c.url === "/workspaces").map((c) => c.headers["Idempotency-Key"]);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBeTruthy();
    expect(keys[0]).toBe(keys[1]);
  });

  it("does not send the ngrok header for non-ngrok URLs", async () => {
    mockFetch(() => ok(1));
    await api.get("/a");
    expect(calls[0]!.headers["ngrok-skip-browser-warning"]).toBeUndefined();
  });
});
