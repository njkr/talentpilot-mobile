import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { friendlyError, retryAfter } from "@/lib/errors";
import { Button, Input } from "@/components/ui/tp";
import type { RegisterRequest, User } from "@/types/api";

export const Route = createFileRoute("/_auth/register")({
  head: () => ({
    meta: [
      { title: "Create account — TalentPilot" },
      { name: "description", content: "Create a TalentPilot account and start matching your resume to jobs." },
      { property: "og:title", content: "Create account — TalentPilot" },
      { property: "og:description", content: "Create a TalentPilot account and start matching your resume to jobs." },
    ],
  }),
  component: RegisterPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(72, "At most 72 characters")
    .regex(/[A-Za-z]/, "Include at least one letter")
    .regex(/\d/, "Include at least one number"),
  referralCode: z.string().trim().max(20).optional(),
});

function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError: setFieldError } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async (v) => {
    setError(null);
    const body: RegisterRequest = { email: v.email, password: v.password };
    if (v.referralCode) body.referralCode = v.referralCode;
    try {
      const user = await api.post<User>("/auth/register", body);
      navigate({ to: "/verify-otp", search: { email: user.email, sent: 1 } });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === "ALREADY_EXISTS")
          return setFieldError("email", { message: "An account with this email already exists. Sign in instead." });
        if (e.status === 429) return setError(`Try again in ${retryAfter(e)}s`);
      }
      setError(friendlyError(e));
    }
  });

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="h1">Create your account</h1>
      <p className="body-text mt-1">Land more interviews with AI-tailored applications.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" noValidate>
        <Input label="Email" type="email" autoComplete="email" inputMode="email" {...register("email")} error={formState.errors.email?.message} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="8+ characters with a letter and a number"
          {...register("password")}
          error={formState.errors.password?.message}
        />
        <Input label="Referral code (optional)" autoCapitalize="characters" {...register("referralCode")} error={formState.errors.referralCode?.message} />
        {error && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="full" loading={formState.isSubmitting}>Create account</Button>
      </form>
      <p className="body-text mt-auto pb-6 pt-10 text-center">
        Already have an account? <Link to="/login" className="font-semibold text-primary">Sign in</Link>
      </p>
    </div>
  );
}
