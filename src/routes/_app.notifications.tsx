import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { qk, useList } from "@/lib/queries";
import { toastError } from "@/lib/errors";
import { fmtDateTime, InfiniteList, PageHeader } from "@/components/app";
import { Button, EmptyState } from "@/components/ui/tp";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/types/api";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — TalentPilot" },
      { name: "description", content: "Updates on your analyses and account." },
      { property: "og:title", content: "Notifications — TalentPilot" },
      { property: "og:description", content: "Updates on your analyses and account." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const q = useList<AppNotification>(qk.notifications, "/notifications");
  const qc = useQueryClient();
  const nav = useNavigate();
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk.notifications });
    void qc.invalidateQueries({ queryKey: qk.unread });
  };

  const readAll = useMutation({
    mutationFn: () => api.patch("/notifications/read-all"),
    onSuccess: () => {
      toast.success("All caught up");
      refresh();
    },
    onError: (e) => toastError(e),
  });

  const open = async (n: AppNotification) => {
    if (!n.readAt) {
      try {
        await api.patch(`/notifications/${n.id}/read`);
        refresh();
      } catch (e) {
        toastError(e);
      }
    }
    const ws = typeof n.data?.["workspaceId"] === "string" ? (n.data["workspaceId"] as string) : null;
    const run = typeof n.data?.["runId"] === "string" ? (n.data["runId"] as string) : undefined;
    if (ws) void nav({ to: "/analyses/$id", params: { id: ws }, search: run ? { run } : {} });
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        right={
          <Button variant="ghost" size="sm" className="h-11" loading={readAll.isPending} onClick={() => readAll.mutate()}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      <InfiniteList
        q={q}
        empty={<EmptyState icon={<Bell className="h-7 w-7" />} title="You're all caught up" description="We'll let you know when an analysis finishes." />}
        render={(n) => (
          <button
            key={n.id}
            onClick={() => void open(n)}
            className={cn(
              "flex min-h-14 w-full items-start gap-3 rounded-xl border p-3 text-left",
              n.readAt ? "border-border bg-card" : "border-primary/30 bg-accent",
            )}
          >
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} />
            <span className="min-w-0 flex-1">
              <span className={cn("block", !n.readAt && "font-semibold")}>{n.title}</span>
              <span className="body-text block">{n.message}</span>
              <span className="caption">{fmtDateTime(n.createdAt)}</span>
            </span>
          </button>
        )}
      />
    </div>
  );
}
