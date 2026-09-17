import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { roleLabels, roleHome, homeForRoles, type AppRole } from "@/lib/roles";
import { useSessionProfile } from "@/hooks/useSessionProfile";

/**
 * Wraps a role dashboard root. If the signed-in account does not hold the
 * role this dashboard is for, it is sent to its own dashboard root instead —
 * dashboards are never shared with pieces hidden client-side.
 */
export function DashboardShell({ role, children }: { role: AppRole; children: ReactNode }) {
  const { data, isPending, error } = useSessionProfile();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-body text-muted-foreground">Loading your workspace…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-3">
        <div className="max-w-md rounded-lg border border-border bg-card p-3 text-center">
          <h1 className="text-heading text-card-foreground">
            We couldn&apos;t open your workspace
          </h1>
          <p className="text-caption mt-1 text-muted-foreground">
            {error instanceof Error ? error.message : "Please try signing in again."}
          </p>
          <div className="mt-3 flex justify-center gap-2">
            <button
              onClick={() => router.invalidate()}
              className="text-caption rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground"
            >
              Try again
            </button>
            <button
              onClick={signOut}
              className="text-caption rounded-md border border-border px-3 py-1 font-medium text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!data.roles.includes(role)) {
    const target = homeForRoles(data.roles);
    if (target !== roleHome[role]) {
      navigate({ to: target, replace: true });
      return null;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div>
            <span className="text-caption font-medium tracking-[0.18em] text-accent uppercase">
              {data.tenantName}
            </span>
            <p className="text-body text-card-foreground">
              {data.fullName ?? data.email} · {roleLabels[role]}
            </p>
          </div>
          <nav className="flex items-center gap-2">
            {(role === "owner" || role === "manager") && (
              <Link to="/team" className="text-caption font-medium text-accent hover:underline">
                Team
              </Link>
            )}
            <button
              onClick={signOut}
              className="text-caption rounded-md border border-border px-3 py-1 font-medium text-foreground hover:bg-accent/10"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-3 py-4">{children}</main>
    </div>
  );
}

export function PhaseTwoNote({ items }: { items: string[] }) {
  return (
    <section className="mt-3 grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <article key={item} className="rounded-lg border border-border bg-card p-3">
          <h3 className="text-body font-medium text-card-foreground">{item}</h3>
          <p className="text-caption mt-1 text-muted-foreground">Arrives in Phase 2.</p>
        </article>
      ))}
    </section>
  );
}
