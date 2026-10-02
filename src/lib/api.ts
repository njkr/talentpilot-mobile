import { API_BASE_URL } from "@/config";
import { tokenStorage } from "@/lib/tokenStorage";
import type { ApiErrorBody, ApiResponse, ErrorCode, Page, SessionResponse } from "@/types/api";

/** Mobile clients receive the refresh token in the JSON body. */
export type MobileSessionResponse = SessionResponse & { refreshToken?: string };

/** ngrok dev tunnel header — remove for production. */
const NGROK_HEADERS: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
export const NGROK_QUERY = "ngrok-skip-browser-warning=true";

export class ApiError extends Error {
  constructor(
    public code: ErrorCode | "NETWORK_ERROR",
    message: string,
    public status: number,
    public details?: Record<string, unknown>,
    public fields?: Record<string, string[]>,
    public requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ── session state (access token in memory only) ─────────────────────────
let accessToken: string | null = null;
let refreshInFlight: Promise<MobileSessionResponse> | null = null;
type Listener = { onSession: (s: SessionResponse) => void; onLogout: () => void };
let listener: Listener | null = null;

export function setAuthListener(l: Listener | null) {
  listener = l;
}
export function setAccessToken(t: string | null) {
  accessToken = t;
}

export async function applySession(s: MobileSessionResponse) {
  accessToken = s.accessToken;
  if (s.refreshToken) await tokenStorage.set(s.refreshToken); // rotated: persist immediately
}

export async function clearSession() {
  accessToken = null;
  await tokenStorage.clear();
}

async function hardLogout() {
  await clearSession();
  listener?.onLogout();
}

/** Single shared in-flight refresh. */
export function refreshSession(): Promise<MobileSessionResponse> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const rt = await tokenStorage.get();
      if (!rt) throw new ApiError("TOKEN_INVALID", "No session", 401);
      const s = await rawRequest<MobileSessionResponse>("POST", "/auth/refresh", { refreshToken: rt }, false);
      await applySession(s);
      listener?.onSession(s);
      return s;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

// ── low level ───────────────────────────────────────────────────────────
type Envelope<T> = { data: T; meta: { requestId: string; nextCursor?: string | null; hasMore?: boolean } };

async function rawRequest<T>(
  method: string,
  path: string,
  body?: unknown,
  withAuth = true,
  extraHeaders: Record<string, string> = {},
  full = false,
): Promise<T> {
  const headers: Record<string, string> = { ...NGROK_HEADERS, "X-Client": "mobile", ...extraHeaders };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (withAuth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers,
      body: body === undefined ? null : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Can't reach the server. Check your connection.", 0);
  }

  if (res.status === 204) return undefined as T;
  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    /* non-JSON */
  }
  if (!res.ok || !json || json.success === false) {
    const err: Partial<ApiErrorBody> = json && json.success === false ? json.error : {};
    throw new ApiError(
      (err.code as ErrorCode) ?? "INTERNAL_ERROR",
      err.message ?? `Request failed (${res.status})`,
      res.status,
      err.details,
      err.fields,
      json?.meta?.requestId,
    );
  }
  return (full ? json : json.data) as T;
}

const PUBLIC_AUTH = /^\/auth\/(login|register|verify-email|resend-otp|refresh|forgot-password|reset-password)/;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>,
  full = false,
): Promise<T> {
  const isPublic = PUBLIC_AUTH.test(path);
  try {
    return await rawRequest<T>(method, path, body, !isPublic, headers, full);
  } catch (e) {
    if (isPublic || !(e instanceof ApiError) || e.status !== 401) throw e;
    if (e.code === "TOKEN_EXPIRED") {
      try {
        await refreshSession();
      } catch (re) {
        if (re instanceof ApiError && re.status === 401) await hardLogout();
        throw re;
      }
      return rawRequest<T>(method, path, body, true, headers, full);
    }
    if (e.code === "TOKEN_SUPERSEDED") {
      if (refreshInFlight) await refreshInFlight.catch(() => undefined);
      return rawRequest<T>(method, path, body, true, headers, full);
    }
    if (e.code === "TOKEN_INVALID" || e.code === "TOKEN_REUSE_DETECTED") await hardLogout();
    throw e;
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, file: File, field = "file") => {
    const fd = new FormData();
    fd.append(field, file);
    return request<T>("POST", path, fd);
  },
  postIdempotent: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, body, { "Idempotency-Key": crypto.randomUUID() }),
  /** Multipart upload with progress (XHR). Retries once after a silent refresh. */
  uploadWithProgress: async <T>(path: string, file: File, onProgress: (pct: number) => void): Promise<T> => {
    const send = () =>
      new Promise<T>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", API_BASE_URL + path);
        for (const [k, v] of Object.entries(NGROK_HEADERS)) xhr.setRequestHeader(k, v);
        xhr.setRequestHeader("X-Client", "mobile");
        if (accessToken) xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onerror = () => reject(new ApiError("NETWORK_ERROR", "Can't reach the server. Check your connection.", 0));
        xhr.onload = () => {
          let json: ApiResponse<T> | null = null;
          try {
            json = JSON.parse(xhr.responseText) as ApiResponse<T>;
          } catch {
            /* non-JSON */
          }
          if (xhr.status >= 200 && xhr.status < 300 && json && json.success) return resolve(json.data);
          const err: Partial<ApiErrorBody> = json && json.success === false ? json.error : {};
          reject(
            new ApiError(
              (err.code as ErrorCode) ?? "INTERNAL_ERROR",
              err.message ?? `Upload failed (${xhr.status})`,
              xhr.status,
              err.details,
              err.fields,
              json?.meta?.requestId,
            ),
          );
        };
        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });
    try {
      return await send();
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOKEN_EXPIRED") {
        await refreshSession();
        onProgress(0);
        return send();
      }
      if (e instanceof ApiError && (e.code === "TOKEN_INVALID" || e.code === "TOKEN_REUSE_DETECTED")) await hardLogout();
      throw e;
    }
  },
  list: async <T>(path: string, q: { cursor?: string | null; limit?: number } = {}): Promise<Page<T>> => {
    const params = new URLSearchParams();
    if (q.cursor) params.set("cursor", q.cursor);
    params.set("limit", String(q.limit ?? 20));
    const sep = path.includes("?") ? "&" : "?";
    const env = await request<Envelope<T[]>>("GET", `${path}${sep}${params}`, undefined, undefined, true);
    return { data: env.data, nextCursor: env.meta.nextCursor ?? null, hasMore: !!env.meta.hasMore };
  },
};
