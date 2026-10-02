import { createFileRoute } from "@tanstack/react-router";
import { BriefcaseBusiness } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/jobs")({
  head: () => ({
    meta: [
      { title: "Jobs — TalentPilot" },
      { name: "description", content: "Target job descriptions you want to apply for." },
      { property: "og:title", content: "Jobs — TalentPilot" },
      { property: "og:description", content: "Target job descriptions you want to apply for." },
    ],
  }),
  component: () => <Placeholder icon={<BriefcaseBusiness className="h-7 w-7" />} title="Jobs" />,
});
