import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Monitor, Smartphone } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { qk } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { CardSkeletons, ConfirmSheet, ErrorState, fmtDateTime, PageHeader } from "@/components/app";
import { Badge, Button, Card, EmptyState } from "@/components/ui/tp";
import type { SessionInfo } from "@/types/api";

export const Route = createFileRoute("/_app/security")({
  head: () => ({
    meta: [
      { title: "Security — TalentPilot" },
      { name: "description", content: "See and sign out devices that are signed in to your account." },
      { property: "og:title", content: "Security — TalentPilot" },
      { property: "og:description", content: "See and sign out devices that are signed in to your account." },
    ],
  }),
  component: SecurityPage,
});

function device(ua: string | null) {
  if (!ua) return "Unknown device";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad/i.test(ua)) return "iPhone / iPad";
  const b = /edg/i.test(ua) ? "Edge" : /chrome/i.test(ua) ? "Chrome" : /firefox/i.test(ua) ? "Firefox" : /safari/i.test(ua) ? "Safari" : "Browser";
  const os = /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "macOS" : /linux/i.test(ua) ? "Linux" : "";
  return os ? `${b} on ${os}` : b;
}

function SecurityPage() {
  const q = useQuery({ queryKey: qk.sessions, queryFn: () => api.get<SessionInfo[]>("/auth/sessions") });
  const qc = useQueryClient();
  const { signOut } = useAuth();
  const [target, setTarget] = useState<SessionInfo | null>(null);
  // The API doesn't flag the current session; the newest one is ours right after sign-in.
  const currentId = q.data?.[0]?.familyId;

  const revoke = useMutation({
    mutationFn: (s: SessionInfo) => api.delete(`/auth/sessions/${s.familyId}`),
    onSuccess: async (_d, s) => {
      setTarget(null);
      if (s.familyId === currentId) {
        toast.success("Signed out of this device");
        await signOut();
        return;
      }
      toast.success("Device signed out");
      void qc.invalidateQueries({ queryKey: qk.sessions });
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="space-y-3">
      <PageHeader title="Security" />
      <p className="body-text">Devices currently signed in to your account.</p>
      {q.isPending ? (
        <CardSkeletons count={3} h="h-24" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState title="No active sessions" />
      ) : (
        q.data.map((s) => {
          const mobile = /android|iphone|ipad/i.test(s.userAgent ?? "");
          return (
            <Card key={s.familyId} className="flex items-center gap-3">
              {mobile ? <Smartphone className="h-6 w-6 text-muted-foreground" /> : <Monitor className="h-6 w-6 text-muted-foreground" />}
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold">
                  {device(s.userAgent)} {s.familyId === currentId && <Badge tone="primary">This device</Badge>}
                </p>
                <p className="caption">{s.ip ?? "Unknown IP"}</p>
                <p className="caption">Signed in {fmtDateTime(s.createdAt)}</p>
              </div>
              <Button variant="secondary" size="sm" className="h-11" onClick={() => setTarget(s)}>
                Revoke
              </Button>
            </Card>
          );
        })
      )}
      <ConfirmSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title="Sign out this device?"
        body={target?.familyId === currentId ? "This is the device you're using now — you'll be signed out." : "That device will need to sign in again."}
        confirmLabel="Revoke"
        danger
        loading={revoke.isPending}
        onConfirm={() => target && revoke.mutate(target)}
      />
    </div>
  );
}
