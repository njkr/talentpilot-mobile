import { ApiError } from "@/lib/api";

export function retryAfter(e: ApiError): number {
  const n = Number(e.details?.["retryAfterSec"]);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

/** Generic friendly message for an error. Screen-specific cases are handled by callers first. */
export function friendlyError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (e.code) {
    case "NETWORK_ERROR":
      return e.message;
    case "RATE_LIMITED":
      return `Too many attempts. Try again in ${retryAfter(e)}s.`;
    case "VALIDATION_FAILED": {
      const first = e.fields && Object.values(e.fields)[0]?.[0];
      return first ?? "Please check the form and try again.";
    }
    case "INTERNAL_ERROR":
      return "Something went wrong on our side. Please try again.";
    default:
      return e.message || "Something went wrong.";
  }
}
