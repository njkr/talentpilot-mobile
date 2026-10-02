import { createFileRoute } from "@tanstack/react-router";
import { Zap } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/billing")({
  head: () => ({
    meta: [
      { title: "Billing — TalentPilot" },
      { name: "description", content: "Your plan and credit balance." },
      { property: "og:title", content: "Billing — TalentPilot" },
      { property: "og:description", content: "Your plan and credit balance." },
    ],
  }),
  component: () => <Placeholder icon={<Zap className="h-7 w-7" />} title="Billing" />,
});
