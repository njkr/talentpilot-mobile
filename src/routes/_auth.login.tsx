import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { api, ApiError, type MobileSessionResponse } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { friendlyError, retryAfter } from "@/lib/errors";
import { Button, Input } from "@/components/ui/tp";

export const Route = createFileRoute("/_auth/login")({
  head: () => ({
    meta: [
      { title: "Sign in — TalentPilot" },
      { name: "description", content: "Sign in to TalentPilot to continue your job applications." },
      { property: "og:title", content: "Sign in — TalentPilot" },
      { property: "og:description", content: "Sign in to TalentPilot to continue your job applications." },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password"),
});

function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    try {
      const s = await api.post<MobileSessionResponse>("/auth/login", v);
      if (s.user.isVerified === false) {
        navigate({ to: "/verify-otp", search: { email: s.user.email } });
        return;
      }
      await signIn(s);
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 401) return setError("Email or password is incorrect");
        if (e.code === "ACCOUNT_SUSPENDED") return setError("This account has been suspended. Contact support for help.");
        if (e.code === "EMAIL_NOT_VERIFIED") return navigate({ to: "/verify-otp", search: { email: v.email } });
        if (e.status === 429) return setError(`Try again in ${retryAfter(e)}s`);
      }
      setError(friendlyError(e));
    }
  });

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="h1">Welcome back</h1>
      <p className="body-text mt-1">Sign in to continue.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" inputMode="email" {...register("email")} error={formState.errors.email?.message} />
        <Input label="Password" type="password" autoComplete="current-password" {...register("password")} error={formState.errors.password?.message} />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary">Forgot password?</Link>
        </div>
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="full" loading={formState.isSubmitting}>Sign in</Button>
      </form>
      <p className="body-text mt-auto pb-6 pt-10 text-center">
        New to TalentPilot? <Link to="/register" className="font-semibold text-primary">Create an account</Link>
      </p>
    </div>
  );
}
