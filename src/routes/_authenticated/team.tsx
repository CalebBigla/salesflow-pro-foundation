import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { createInvite, listTeam } from "@/lib/auth.functions";
import { roleLabels, type AppRole } from "@/lib/roles";
import { useSessionProfile } from "@/hooks/useSessionProfile";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team — SalesFlow Pro" },
      {
        name: "description",
        content: "Invite managers, storekeepers and sales representatives to your workspace.",
      },
      { property: "og:title", content: "Team — SalesFlow Pro" },
      { property: "og:description", content: "Invite and review the people in your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TeamPage,
});

const invitableByRole: Record<string, AppRole[]> = {
  owner: ["manager", "storekeeper", "sales_rep"],
  manager: ["storekeeper", "sales_rep"],
};

function TeamPage() {
  const session = useSessionProfile();
  const fetchTeam = useServerFn(listTeam);
  const sendInvite = useServerFn(createInvite);
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("sales_rep");
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam({}),
    retry: false,
  });

  const invite = useMutation({
    mutationFn: (input: { email: string; role: AppRole }) => sendInvite({ data: input }),
    onSuccess: (created) => {
      setError(null);
      setEmail("");
      setInviteLink(`${window.location.origin}/accept-invite?token=${created.token}`);
      void queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err) => {
      setInviteLink(null);
      setError(err instanceof Error ? err.message : "Could not create the invitation.");
    },
  });

  const roles = session.data?.roles ?? [];
  const allowed = roles.includes("owner")
    ? invitableByRole["owner"]!
    : roles.includes("manager")
      ? invitableByRole["manager"]!
      : [];

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-3 py-4">
        <Link to="/home" className="text-caption text-accent hover:underline">
          Back to dashboard
        </Link>
        <h1 className="text-display mt-2 text-foreground">Team</h1>

        {allowed.length === 0 ? (
          <p className="text-body mt-2 text-muted-foreground">
            Only the business owner and managers can invite people.
          </p>
        ) : (
          <section className="mt-3 rounded-lg border border-border bg-card p-3">
            <h2 className="text-heading text-card-foreground">Invite someone</h2>
            <form
              className="mt-2 flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                invite.mutate({ email, role });
              }}
            >
              <div className="flex min-w-56 flex-1 flex-col gap-1">
                <label className="text-caption text-muted-foreground" htmlFor="invite-email">
                  Email
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-caption text-muted-foreground" htmlFor="invite-role">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as AppRole)}
                  className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
                >
                  {allowed.map((option) => (
                    <option key={option} value={option}>
                      {roleLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={invite.isPending}
                className="text-body rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-60"
              >
                {invite.isPending ? "Creating…" : "Create invite"}
              </button>
            </form>
            {error ? <p className="text-caption mt-2 text-danger">{error}</p> : null}
            {inviteLink ? (
              <p className="text-caption mt-2 break-all text-success">
                Share this link with them: <span className="text-foreground">{inviteLink}</span>
              </p>
            ) : null}
          </section>
        )}

        <section className="mt-3 rounded-lg border border-border bg-card p-3">
          <h2 className="text-heading text-card-foreground">People</h2>
          {team.isPending ? (
            <p className="text-caption mt-1 text-muted-foreground">Loading…</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {(team.data?.members ?? []).map((member) => (
                <li key={member.id} className="flex flex-wrap justify-between gap-2">
                  <span className="text-body text-card-foreground">
                    {member.full_name ?? member.email}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {member.roles.map((r) => roleLabels[r]).join(", ") || "No role"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-3 rounded-lg border border-border bg-card p-3">
          <h2 className="text-heading text-card-foreground">Pending invitations</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {(team.data?.invites ?? [])
              .filter((row) => !row.accepted_at)
              .map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2">
                  <span className="text-body text-card-foreground">{row.email}</span>
                  <span className="text-caption text-muted-foreground">
                    {roleLabels[row.role as AppRole]} · expires{" "}
                    {new Date(row.expires_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            {(team.data?.invites ?? []).filter((row) => !row.accepted_at).length === 0 ? (
              <li className="text-caption text-muted-foreground">Nothing pending.</li>
            ) : null}
          </ul>
        </section>
      </main>
    </div>
  );
}
