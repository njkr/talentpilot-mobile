import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { openUpgrade } from "@/lib/stores";

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
      return `Too many requests, try again in ${retryAfter(e)}s.`;
    case "VALIDATION_FAILED": {
      const first = e.fields && Object.values(e.fields)[0]?.[0];
      return first ?? "Please check the form and try again.";
    }
    case "INTERNAL_ERROR":
      return "Something went wrong on our side. Please try again.";
    case "AI_PROVIDER_UNAVAILABLE":
      return "Our AI service is busy right now. Please try again shortly.";
    case "AI_BUDGET_EXCEEDED":
      return "AI usage limit reached for now. Please try again later.";
    case "EMAIL_NOT_VERIFIED":
      return "Please verify your email first.";
    case "NOT_FOUND":
      return "We couldn't find that. It may have been deleted.";
    default:
      return e.message || "Something went wrong.";
  }
}

const num = (v: unknown) => (typeof v === "number" ? v : v == null ? undefined : Number(v));

/** Opens the upgrade sheet for credit/plan errors. Returns true if handled. */
export function handleUpgradeError(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  if (e.code === "INSUFFICIENT_CREDITS") {
    openUpgrade({
      kind: "credits",
      required: num(e.details?.["required"]),
      balance: num(e.details?.["balance"]),
    });
    return true;
  }
  if (e.code === "PLAN_LIMIT_REACHED") {
    openUpgrade({
      kind: "limit",
      limit: num(e.details?.["limit"]),
      current: num(e.details?.["current"]),
      feature:
        typeof e.details?.["feature"] === "string" ? (e.details["feature"] as string) : undefined,
    });
    return true;
  }
  return false;
}

/** Default mutation error reaction: upgrade sheet, or an error toast. */
export function toastError(e: unknown, override?: Partial<Record<string, string>>) {
  if (handleUpgradeError(e)) return;
  const code = e instanceof ApiError ? e.code : "";
  toast.error(override?.[code] ?? friendlyError(e));
}
