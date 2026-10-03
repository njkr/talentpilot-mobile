/**
 * API base URL (incl. /api/v1). Comes ONLY from VITE_API_BASE_URL:
 *  - CI / production builds: the VITE_API_BASE_URL repo secret (build fails without it).
 *  - local dev: put it in .env.local (gitignored) — see .env.example.
 * Never hardcode a URL here.
 */
const raw = (import.meta.env["VITE_API_BASE_URL"] as string | undefined)?.trim() ?? "";

if (!raw) {
  const msg = "VITE_API_BASE_URL is not set. Add it to .env.local (see .env.example) or the build environment.";
  if (import.meta.env.PROD && !import.meta.env["VITEST"]) throw new Error(msg);
  if (typeof console !== "undefined") console.error(msg);
}

export const API_BASE_URL: string = raw.replace(/\/+$/, "");

/** ngrok dev tunnels need a header/query flag to skip their browser warning page. */
export const IS_NGROK = API_BASE_URL.includes("ngrok");
