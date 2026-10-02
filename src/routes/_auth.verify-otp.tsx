import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { api, ApiError, type MobileSessionResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError, retryAfter } from "@/lib/errors";
import { Button } from "@/components/ui/tp";

const searchSchema = z.object({
  email: z.string().catch(""),
  sent: z.number().optional().catch(undefined),
});

export const Route = createFileRoute("/_auth/verify-otp")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Verify email — TalentPilot" },
      { name: "description", content: "Enter the 6-digit code we emailed you to verify your TalentPilot account." },
      { property: "og:title", content: "Verify email — TalentPilot" },
      { property: "og:description", content: "Enter the 6-digit code we emailed you." },
    ],
  }),
  component: VerifyOtpPage,
});

function VerifyOtpPage() {
  const { email, sent } = Route.useSearch();
  const { signIn } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(sent ? 60 : 0);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!email) return <Navigate to="/login" replace />;

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setError(null);
    setLoading(true);
    try {
      const s = await api.post<MobileSessionResponse>("/auth/verify-email", { email, code });
      await signIn(s);
    } catch (err) {
      setCode("");
      if (err instanceof ApiError) {
        if (err.code === "OTP_INVALID") {
          const r = Number(err.details?.["remaining"]);
          setError(Number.isFinite(r) ? `Incorrect code. ${r} attempt${r === 1 ? "" : "s"} left.` : "Incorrect code.");
        } else if (err.code === "OTP_EXPIRED") setError("This code has expired. Request a new one.");
        else if (err.code === "OTP_MAX_ATTEMPTS") {
          setLocked(true);
          setError("Too many attempts. Request a new code.");
        } else setError(friendlyError(err));
      } else setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post("/auth/resend-otp", { email });
      setCooldown(60);
      setLocked(false);
      setError(null);
      toast.success("New code sent");
    } catch (err) {
      if (err instanceof ApiError && (err.code === "OTP_COOLDOWN" || err.status === 429)) setCooldown(retryAfter(err));
      else toast.error(friendlyError(err));
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="h1">Check your email</h1>
      <p className="body-text mt-1">
        We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <input
          aria-label="Verification code"
          value={code}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(v);
            setError(null);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          disabled={locked}
          placeholder="••••••"
          className="h-14 w-full rounded-xl border border-input bg-card text-center font-display text-2xl font-bold tracking-[0.5em] text-foreground placeholder:text-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30"
        />
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="full" loading={loading} disabled={locked || code.length !== 6}>Verify</Button>
        <Button type="button" variant="secondary" size="full" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </Button>
      </form>
      <p className="body-text mt-auto pb-6 pt-10 text-center">
        Wrong email? <Link to="/register" className="font-semibold text-primary">Start over</Link>
      </p>
    </div>
  );
}
