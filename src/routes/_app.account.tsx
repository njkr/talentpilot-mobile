import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Trash2 } from "lucide-react";
import { api, clearSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { toastError } from "@/lib/errors";
import { ActionButton, PageHeader } from "@/components/app";
import { BottomSheet, Button, Card, Input } from "@/components/ui/tp";

export const Route = createFileRoute("/_app/account")({
  head: () => ({
    meta: [
      { title: "Account — TalentPilot" },
      { name: "description", content: "Export your data or delete your TalentPilot account." },
      { property: "og:title", content: "Account — TalentPilot" },
      { property: "og:description", content: "Export your data or delete your TalentPilot account." },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const [del, setDel] = useState(false);
  const [text, setText] = useState("");
  const { signOut } = useAuth();
  const nav = useNavigate();

  const exp = useMutation({
    mutationFn: () => api.post("/gdpr/export"),
    onSuccess: () => toast.success("We'll email your export when it's ready"),
    onError: (e) => toastError(e),
  });
  const remove = useMutation({
    mutationFn: () => api.delete("/users/me"),
    onSuccess: async () => {
      await clearSession();
      await signOut().catch(() => undefined);
      toast.success("Account deleted. You have 30 days to change your mind by contacting support.", { duration: 8000 });
      void nav({ to: "/login" });
    },
    onError: (e) => toastError(e),
  });

  return (
    <div className="space-y-4">
      <PageHeader title="Account" />
      <Card className="space-y-3">
        <h2 className="h3">Export my data</h2>
        <p className="body-text">We'll prepare a copy of your data and email it to you.</p>
        <ActionButton variant="secondary" size="full" loading={exp.isPending} onClick={() => exp.mutate()}>
          <Download className="h-4 w-4" /> Export my data
        </ActionButton>
      </Card>
      <Card className="space-y-3 border-destructive/30">
        <h2 className="h3 text-destructive">Delete account</h2>
        <p className="body-text">Your account is deactivated now and permanently deleted after 30 days.</p>
        <Button variant="danger" size="full" onClick={() => setDel(true)}>
          <Trash2 className="h-4 w-4" /> Delete account
        </Button>
      </Card>
      <BottomSheet open={del} onClose={() => setDel(false)} title="Delete your account?">
        <p className="body-text">This signs you out everywhere. Type <b>DELETE</b> to confirm.</p>
        <div className="mt-4 space-y-3">
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="DELETE" autoCapitalize="characters" aria-label="Type DELETE" />
          <ActionButton variant="danger" size="full" disabled={text !== "DELETE"} loading={remove.isPending} onClick={() => remove.mutate()}>
            Delete my account
          </ActionButton>
          <Button variant="secondary" size="full" onClick={() => setDel(false)}>
            Cancel
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
