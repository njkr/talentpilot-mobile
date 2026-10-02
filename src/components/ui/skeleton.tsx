import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("tp-shimmer rounded-md", className)} {...props} />;
}

export { Skeleton };
