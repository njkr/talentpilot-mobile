import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Badge, BottomSheet, Button, Card } from "@/components/ui/tp";

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

function MePage() {
  const { user, signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
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
      <p className="caption px-1">Profile, billing, security and account settings are coming next.</p>
      <Button variant="secondary" size="full" className="text-destructive" onClick={() => setConfirm(true)}>
        <LogOut className="h-4 w-4" /> Sign out
      </Button>

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
          <Button variant="secondary" size="full" onClick={() => setConfirm(false)}>Cancel</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
