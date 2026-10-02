import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/tp";

export function Placeholder({ icon, title }: { icon: ReactNode; title: string }) {
  return <EmptyState icon={icon} title={title} description="This screen is coming in the next build step." />;
}
