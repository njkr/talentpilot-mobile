import { createFileRoute } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "Home — TalentPilot" },
      { name: "description", content: "Your TalentPilot dashboard: credits, scores and recent analyses." },
      { property: "og:title", content: "Home — TalentPilot" },
      { property: "og:description", content: "Your TalentPilot dashboard: credits, scores and recent analyses." },
    ],
  }),
  component: () => <Placeholder icon={<Home className="h-7 w-7" />} title="Home" />,
});
