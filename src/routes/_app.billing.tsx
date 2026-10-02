import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Receipt, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { qk, useList } from "@/lib/queries";
import { openExternal, WEB_BILLING_URL } from "@/lib/native";
import { CardSkeletons, ErrorState, fmtDate, InfiniteList, PageHeader } from "@/components/app";
import { Badge, Button, Card, EmptyState } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { CreditBalance, CreditLedgerEntry, Subscription } from "@/types/api";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({
    meta: [
      { title: "Billing & credits — TalentPilot" },
      { name: "description", content: "Your plan, credit balance and credit history." },
      { property: "og:title", content: "Billing & credits — TalentPilot" },
      { property: "og:description", content: "Your plan, credit balance and credit history." },
    ],
  }),
  component: BillingPage,
});

const REASONS: Record<string, string> = {
  signup_bonus: "Sign-up bonus",
  analyze: "Analysis",
  refund: "Refund",
  grant: "Grant",
  cover_letter_regenerate: "Cover letter regenerated",
  answer_feedback: "Interview feedback",
  rescore: "Score recalculated",
  monthly_refill: "Monthly refill",
  purchase: "Purchase",
  admin_adjust: "Adjustment",
  retry_reversal: "Retry reversal",
  referral_reward: "Referral reward",
  referral_bonus: "Referral bonus",
  plan_upgrade: "Plan upgrade",
};

function BillingPage() {
  const sub = useQuery({ queryKey: qk.subscription, queryFn: () => api.get<Subscription>("/payments/subscription") });
  const credits = useQuery({ queryKey: qk.credits, queryFn: () => api.get<CreditBalance>("/credits") });
  const hist = useList<CreditLedgerEntry>(qk.creditHistory, "/credits/history");

  return (
    <div className="space-y-4">
      <PageHeader title="Billing & credits" />
      {sub.isPending ? (
        <CardSkeletons count={1} h="h-32" />
      ) : sub.isError ? (
        <ErrorState compact error={sub.error} onRetry={() => void sub.refetch()} />
      ) : (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="caption">Current plan</p>
              <p className="h2">{sub.data.planName}</p>
            </div>
            <Badge tone={sub.data.status === "active" ? "success" : "warning"}>{sub.data.status.replace("_", " ")}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-muted p-2"><b>{sub.data.monthlyCredits}</b><p className="caption">credits/mo</p></div>
            <div className="rounded-lg bg-muted p-2"><b>{sub.data.maxResumes}</b><p className="caption">resumes</p></div>
            <div className="rounded-lg bg-muted p-2"><b>{sub.data.maxWorkspaces}</b><p className="caption">analyses</p></div>
          </div>
          {sub.data.currentPeriodEnd && (
            <p className="caption">
              {sub.data.cancelAtPeriodEnd ? "Ends" : "Renews"} on {fmtDate(sub.data.currentPeriodEnd)}
            </p>
          )}
        </Card>
      )}

      <Card className="flex items-center justify-between">
        <div>
          <p className="caption">Credit balance</p>
          <p className="font-display text-3xl font-bold">{credits.data?.balance ?? "—"}</p>
        </div>
        <Zap className="h-8 w-8 text-primary" />
      </Card>

      <Button size="full" variant="secondary" onClick={() => void openExternal(WEB_BILLING_URL)}>
        <ExternalLink className="h-4 w-4" /> Manage plan on web
      </Button>

      <h2 className="h3 pt-2">Credit history</h2>
      <InfiniteList
        q={hist}
        skeleton={<CardSkeletons count={5} h="h-14" />}
        empty={<EmptyState icon={<Receipt className="h-7 w-7" />} title="No credit activity yet" />}
        render={(e) => (
          <div key={e.id} className="flex min-h-14 items-center justify-between rounded-xl border border-border bg-card px-3">
            <div>
              <p className="font-medium">{REASONS[e.reason] ?? e.reason}</p>
              <p className="caption">{fmtDate(e.createdAt)}</p>
            </div>
            <span className={cn("font-display font-bold", e.amount >= 0 ? "text-success" : "text-destructive")}>
              {e.amount >= 0 ? `+${e.amount}` : `−${Math.abs(e.amount)}`}
            </span>
          </div>
        )}
      />
    </div>
  );
}
