import { createFileRoute } from "@tanstack/react-router";
import { LineChart } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/analyses")({
  head: () => ({
    meta: [
      { title: "Analyses — TalentPilot" },
      { name: "description", content: "ATS match analyses for your resume and jobs." },
      { property: "og:title", content: "Analyses — TalentPilot" },
      { property: "og:description", content: "ATS match analyses for your resume and jobs." },
    ],
  }),
  component: () => <Placeholder icon={<LineChart className="h-7 w-7" />} title="Analyses" />,
});
