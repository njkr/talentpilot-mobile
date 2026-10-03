import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronRight, CreditCard, LogOut, Monitor, Moon, Palette, Shield, Sun, UserRound, UserCog } from "lucide-react";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { useAuth } from "@/lib/auth";
import { Badge, BottomSheet, Button, Card } from "@/components/ui/tp";

import { CheckUpdatesRow, VersionFooter } from "@/components/UpdateSheets";

export const Route = createFileRoute("/_app/me")({
  head: () => ({
    meta: [
      { title: "Me — TalentPilot" },
      { name: "description", content: "Your TalentPilot profile, billing, security and account." },
      { property: "og:title", content: "Me — TalentPilot" },
      { property: "og:description", content: "Your TalentPilot profile, billing, security and account." },
    ],
  }),
  component: MePage,
});

const ROWS = [
  { to: "/profile", label: "Profile", icon: UserRound },
  { to: "/billing", label: "Billing & credits", icon: CreditCard },
  { to: "/security", label: "Security", icon: Shield },
  { to: "/account", label: "Account", icon: UserCog },
] as const;

const THEMES: { value: ThemeChoice; label: string; caption?: string; icon: typeof Sun }[] = [
  { value: "system", label: "System", caption: "Match your phone's setting", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function MePage() {
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appearance, setAppearance] = useState(false);
  const { theme, setTheme } = useTheme();
  const initial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="space-y-4">
      <Card className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent font-display text-lg font-bold text-accent-foreground">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="h3 truncate">{user?.email}</p>
          <div className="mt-1">
            {user?.isVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Unverified</Badge>}
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border p-0">
        {ROWS.map((r) => (
          <Link key={r.to} to={r.to} className="flex min-h-14 items-center gap-3 px-4">
            <r.icon className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 font-medium">{r.label}</span>
            <ChevronRight className="h-4 w-4 text-subtle" />
          </Link>
        ))}
        <button onClick={() => setAppearance(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <span className="flex-1 font-medium">Appearance</span>
          <span className="body-text">{THEMES.find((t) => t.value === theme)?.label}</span>
          <ChevronRight className="h-4 w-4 text-subtle" />
        </button>
        <CheckUpdatesRow />
        <button onClick={() => setConfirm(true)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-destructive">
          <LogOut className="h-5 w-5" />
          <span className="flex-1 font-medium">Sign out</span>
        </button>
      </Card>

      <VersionFooter />

      <BottomSheet open={appearance} onClose={() => setAppearance(false)} title="Appearance">
        <div className="space-y-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setTheme(t.value);
                setAppearance(false);
              }}
              className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 text-left ${theme === t.value ? "border-primary bg-accent" : "border-border bg-card"}`}
            >
              <t.icon className="h-6 w-6 text-primary" />
              <span className="flex-1">
                <span className="block font-semibold">{t.label}</span>
                {t.caption && <span className="caption block">{t.caption}</span>}
              </span>
              {theme === t.value && <Check className="h-5 w-5 text-primary" />}
            </button>
          ))}
        </div>
      </BottomSheet>

      <BottomSheet open={confirm} onClose={() => setConfirm(false)} title="Sign out?">
        <p className="body-text">You'll need to sign in again on this device.</p>
        <div className="mt-5 space-y-3">
          <Button
            variant="danger"
            size="full"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await signOut();
            }}
          >
            Sign out
          </Button>
          <Button variant="secondary" size="full" onClick={() => setConfirm(false)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
