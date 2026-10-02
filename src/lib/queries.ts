import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** Cursor-paginated list query (limit 20). */
export function useList<T>(key: readonly unknown[], path: string) {
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => api.list<T>(path, { cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : null),
  });
}

export const qk = {
  dashboard: ["dashboard"] as const,
  credits: ["credits"] as const,
  creditHistory: ["credits", "history"] as const,
  subscription: ["subscription"] as const,
  notifications: ["notifications", "list"] as const,
  unread: ["notifications", "unread-count"] as const,
  profile: ["profile"] as const,
  sessions: ["sessions"] as const,
  resumes: ["resumes"] as const,
  resume: (id: string) => ["resume", id] as const,
  sections: (id: string) => ["resume", id, "sections"] as const,
  jobs: ["jobs"] as const,
  job: (id: string) => ["job", id] as const,
  workspaces: ["workspaces"] as const,
  workspace: (id: string) => ["workspace", id] as const,
  run: (id: string) => ["run", id] as const,
  ws: (id: string, part: string) => ["workspace", id, part] as const,
};

export const ANALYZE_COST = 21;
export const RESCORE_COST = 5;
export const COVER_REGEN_COST = 2;
export const FEEDBACK_COST = 1;
