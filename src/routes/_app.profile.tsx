import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { qk } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { ActionButton, CardSkeletons, ErrorState, PageHeader, ProgressBar } from "@/components/app";
import { Card, Input } from "@/components/ui/tp";
import type { Profile, UpdateProfileRequest } from "@/types/api";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({
    meta: [
      { title: "Profile — TalentPilot" },
      { name: "description", content: "Your career profile used to tailor analyses." },
      { property: "og:title", content: "Profile — TalentPilot" },
      { property: "og:description", content: "Your career profile used to tailor analyses." },
    ],
  }),
  component: ProfilePage,
});

const CURRENCIES = [
  "USD",
  "EUR",
  "GBP",
  "AED",
  "INR",
  "CAD",
  "AUD",
  "SGD",
  "SAR",
  "CHF",
  "JPY",
  "CNY",
  "PKR",
  "EGP",
  "ZAR",
  "BRL",
  "MXN",
];

const hostEnds = (suffix: string) => (v: string) => {
  if (!v) return true;
  try {
    const h = new URL(v).hostname.toLowerCase();
    return h === suffix || h.endsWith("." + suffix);
  } catch {
    return false;
  }
};
const optUrl = z
  .string()
  .trim()
  .refine((v) => !v || /^https?:\/\/.+\..+/.test(v), "Enter a full URL (https://…)");

const schema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  targetRole: z.string().trim().max(150),
  yearsExperience: z
    .string()
    .refine((v) => v === "" || (/^\d+$/.test(v) && +v >= 0 && +v <= 60), "0–60"),
  phone: z.string().trim().max(30),
  linkedin: optUrl.refine(hostEnds("linkedin.com"), "Must be a linkedin.com link"),
  github: optUrl.refine(hostEnds("github.com"), "Must be a github.com link"),
  portfolio: optUrl,
  city: z.string().trim().max(100),
  country: z.string().trim().max(100),
  timezone: z.string().max(64),
  salaryExpectation: z.string().refine((v) => v === "" || /^\d+$/.test(v), "Whole number"),
  salaryCurrency: z.string(),
});
type F = z.infer<typeof schema>;
const KEYS = Object.keys(schema.shape) as (keyof F)[];

function ProfilePage() {
  const q = useQuery({ queryKey: qk.profile, queryFn: () => api.get<Profile>("/profiles/me") });
  const qc = useQueryClient();
  const tzs = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
        "timeZone",
      );
    } catch {
      return ["UTC"];
    }
  }, []);
  const form = useForm<F>({ resolver: zodResolver(schema) });
  const { register, handleSubmit, reset, setError, formState } = form;

  useEffect(() => {
    if (!q.data) return;
    const p = q.data;
    reset(Object.fromEntries(KEYS.map((k) => [k, p[k] == null ? "" : String(p[k])])) as F);
  }, [q.data, reset]);

  const save = useMutation({
    mutationFn: (f: F) => {
      const body: UpdateProfileRequest = {};
      for (const k of KEYS) {
        const v = f[k].trim();
        if (!v) continue;
        if (k === "yearsExperience" || k === "salaryExpectation") body[k] = Number(v);
        else (body as Record<string, string>)[k] = v;
      }
      return api.put<Profile>("/profiles/me", body);
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.profile, p);
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      toast.success("Profile saved");
    },
    onError: (e) => {
      if (e instanceof ApiError && e.code === "VALIDATION_FAILED" && e.fields) {
        let mapped = false;
        for (const [k, msgs] of Object.entries(e.fields)) {
          if ((KEYS as string[]).includes(k)) {
            setError(k as keyof F, { message: msgs[0] ?? "Invalid" });
            mapped = true;
          }
        }
        if (mapped) {
          toast.error("Please fix the highlighted fields");
          return;
        }
      }
      toastError(e);
    },
  });

  if (q.isPending)
    return (
      <>
        <PageHeader title="Profile" />
        <CardSkeletons count={6} h="h-14" />
      </>
    );
  if (q.isError)
    return (
      <>
        <PageHeader title="Profile" />
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      </>
    );
  const err = (k: keyof F) => formState.errors[k]?.message;
  const sel = "h-11 w-full rounded-lg border border-input bg-card px-3 text-base";

  return (
    <form onSubmit={handleSubmit((f) => save.mutate(f))} className="space-y-4">
      <PageHeader title="Profile" />
      <Card>
        <div className="mb-2 flex justify-between text-sm">
          <span className="font-medium">Profile completeness</span>
          <span className="font-semibold">{q.data.completeness}%</span>
        </div>
        <ProgressBar
          value={q.data.completeness}
          tone={q.data.completeness >= 80 ? "success" : "primary"}
        />
      </Card>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First name"
            {...register("firstName")}
            error={err("firstName")}
            autoComplete="given-name"
          />
          <Input
            label="Last name"
            {...register("lastName")}
            error={err("lastName")}
            autoComplete="family-name"
          />
        </div>
        <Input
          label="Target role"
          {...register("targetRole")}
          error={err("targetRole")}
          placeholder="e.g. Senior Backend Engineer"
        />
        <Input
          label="Years of experience"
          inputMode="numeric"
          {...register("yearsExperience")}
          error={err("yearsExperience")}
        />
        <Input
          label="Phone"
          type="tel"
          {...register("phone")}
          error={err("phone")}
          autoComplete="tel"
        />
      </Card>
      <Card className="space-y-3">
        <Input
          label="LinkedIn"
          type="url"
          {...register("linkedin")}
          error={err("linkedin")}
          placeholder="https://linkedin.com/in/…"
        />
        <Input
          label="GitHub"
          type="url"
          {...register("github")}
          error={err("github")}
          placeholder="https://github.com/…"
        />
        <Input
          label="Portfolio"
          type="url"
          {...register("portfolio")}
          error={err("portfolio")}
          placeholder="https://…"
        />
      </Card>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="City" {...register("city")} error={err("city")} />
          <Input label="Country" {...register("country")} error={err("country")} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium" htmlFor="timezone">
            Timezone
          </label>
          <select id="timezone" className={sel} {...register("timezone")}>
            <option value="">Select…</option>
            {tzs.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input
            label="Salary expectation"
            inputMode="numeric"
            {...register("salaryExpectation")}
            error={err("salaryExpectation")}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="salaryCurrency">
              Currency
            </label>
            <select id="salaryCurrency" className={sel} {...register("salaryCurrency")}>
              <option value="">—</option>
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>
      <div className="pb-safe sticky bottom-20 z-10">
        <ActionButton type="submit" size="full" loading={save.isPending}>
          Save profile
        </ActionButton>
      </div>
    </form>
  );
}
