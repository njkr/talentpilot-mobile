import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { Placeholder } from "@/components/Placeholder";

export const Route = createFileRoute("/_app/resumes")({
  head: () => ({
    meta: [
      { title: "Resumes — TalentPilot" },
      { name: "description", content: "Upload and manage your resumes." },
      { property: "og:title", content: "Resumes — TalentPilot" },
      { property: "og:description", content: "Upload and manage your resumes." },
    ],
  }),
  component: () => <Placeholder icon={<FileText className="h-7 w-7" />} title="Resumes" />,
});
