import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { friendlyError, retryAfter } from "@/lib/errors";
import { Button, EmptyState, Input } from "@/components/ui/tp";

export const Route = createFileRoute("/_auth/reset-password")({
  validateSearch: (s) => z.object({ token: z.string().catch("") }).parse(s),
  head: () => ({
    meta: [
      { title: "Reset password — TalentPilot" },
      { name: "description", content: "Choose a new password for your TalentPilot account." },
      { property: "og:title", content: "Reset password — TalentPilot" },
      { property: "og:description", content: "Choose a new password for your TalentPilot account." },
    ],
  }),
  component: ResetPage,
});

const schema = z
  .object({
    token: z.string().trim().min(1, "Paste the token from your email"),
    password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

function ResetPage() {
  const { token } = Route.useSearch();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { token },
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      await api.post("/auth/reset-password", { token: v.token, password: v.password });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.code === "RESET_TOKEN_INVALID")
        return setError("This reset link is invalid or has expired. Request a new one.");
      setError(e instanceof ApiError && e.status === 429 ? `Try again in ${retryAfter(e)}s` : friendlyError(e));
    }
  });

  if (done)
    return (
      <EmptyState
        icon={<CheckCircle2 className="h-7 w-7" />}
        title="Password updated"
        description="You've been signed out everywhere. Sign in with your new password."
        action={<Link to="/login" className="text-sm font-semibold text-primary">Go to sign in</Link>}
      />
    );

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="h1">Set a new password</h1>
      <p className="body-text mt-1">Paste the token from your email if it isn't filled in.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        {!token && <Input label="Reset token" autoComplete="off" {...register("token")} error={formState.errors.token?.message} />}
        <Input label="New password" type="password" autoComplete="new-password" {...register("password")} error={formState.errors.password?.message} />
        <Input label="Confirm password" type="password" autoComplete="new-password" {...register("confirm")} error={formState.errors.confirm?.message} />
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="full" loading={formState.isSubmitting}>Update password</Button>
      </form>
      <p className="body-text mt-auto pb-6 pt-10 text-center">
        <Link to="/forgot-password" className="font-semibold text-primary">Request a new link</Link>
      </p>
    </div>
  );
}
