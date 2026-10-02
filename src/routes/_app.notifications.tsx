import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — TalentPilot" },
      { name: "description", content: "Your TalentPilot notifications." },
      { property: "og:title", content: "Notifications — TalentPilot" },
      { property: "og:description", content: "Your TalentPilot notifications." },
    ],
  }),
  component: () => <Placeholder icon={<Bell className="h-7 w-7" />} title="Notifications" />,
});
