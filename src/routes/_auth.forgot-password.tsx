import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { MailCheck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { friendlyError, retryAfter } from "@/lib/errors";
import { Button, EmptyState, Input } from "@/components/ui/tp";

export const Route = createFileRoute("/_auth/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — TalentPilot" },
      { name: "description", content: "Reset your TalentPilot password by email." },
      { property: "og:title", content: "Forgot password — TalentPilot" },
      { property: "og:description", content: "Reset your TalentPilot password by email." },
    ],
  }),
  component: ForgotPage,
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email") });

function ForgotPage() {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post("/auth/forgot-password", v);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 429
          ? `Try again in ${retryAfter(e)}s`
          : friendlyError(e),
      );
    }
  });

  if (done)
    return (
      <EmptyState
        icon={<MailCheck className="h-7 w-7" />}
        title="Check your email"
        description="If an account exists for that email, we've sent a link to reset your password."
        action={
          <div className="flex flex-col gap-3">
            <Link
              to="/reset-password"
              search={{ token: "" }}
              className="text-sm font-semibold text-primary"
            >
              I have a reset token
            </Link>
            <Link to="/login" className="text-sm font-medium text-muted-foreground">
              Back to sign in
            </Link>
          </div>
        }
      />
    );

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="h1">Forgot password?</h1>
      <p className="body-text mt-1">We'll email you a link to reset it.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          {...register("email")}
          error={formState.errors.email?.message}
        />
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button type="submit" size="full" loading={formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="body-text mt-auto pb-6 pt-10 text-center">
        <Link to="/login" className="font-semibold text-primary">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
