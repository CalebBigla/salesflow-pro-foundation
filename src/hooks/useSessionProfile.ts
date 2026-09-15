import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { resolveSession, type SessionProfile } from "@/lib/auth.functions";

/**
 * The signed-in account's tenant profile and roles. Resolved on the server;
 * the client never decides what a role is allowed to do.
 */
export function useSessionProfile() {
  const fetchSession = useServerFn(resolveSession);
  return useQuery<SessionProfile>({
    queryKey: ["session-profile"],
    queryFn: () => fetchSession({}),
    staleTime: 60_000,
    retry: false,
  });
}
