import { createFileRoute } from "@tanstack/react-router";
import { checkBackendHealth } from "@/lib/health.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SalesFlow Pro — Sales & Inventory Management" },
      {
        name: "description",
        content:
          "SalesFlow Pro is a multi-tenant sales and inventory platform for stock requests, sales entries and team targets.",
      },
      { property: "og:title", content: "SalesFlow Pro — Sales & Inventory Management" },
      {
        property: "og:description",
        content:
          "Multi-tenant sales and inventory management: products, stock requests, sales entries, targets and audit trails.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => checkBackendHealth(),
  component: Landing,
  errorComponent: () => (
    <main className="flex min-h-screen items-center justify-center p-3">
      <p className="text-body text-muted-foreground">The page didn&apos;t load. Try refreshing.</p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="flex min-h-screen items-center justify-center p-3">
      <p className="text-body text-muted-foreground">Not found.</p>
    </main>
  ),
});

const phases = [
  { label: "Phase 0", title: "Skeleton", detail: "Design system, schema plan, tooling" },
  { label: "Phase 1", title: "Auth", detail: "Sign-in, tenants, roles, security policies" },
  { label: "Phase 2", title: "Operations", detail: "Products, stock, sales, targets" },
];

function Landing() {
  const health = Route.useLoaderData();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-6 px-3 py-8">
        <header className="flex flex-col gap-2">
          <span className="text-caption font-medium tracking-[0.18em] text-accent uppercase">
            Multi-tenant SaaS
          </span>
          <h1 className="text-display text-foreground">SalesFlow Pro</h1>
          <p className="text-body max-w-xl text-muted-foreground">
            Sales and inventory management for distributed teams. The foundation is in place —
            features land in the next phases.
          </p>
        </header>

        <section className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block size-1 rounded-full ${
                health.reachable ? "bg-success" : "bg-danger"
              }`}
              aria-hidden="true"
            />
            <h2 className="text-heading text-card-foreground">
              {health.reachable ? "App booted, backend connected" : "App booted, backend offline"}
            </h2>
          </div>
          <p className="text-caption mt-1 text-muted-foreground">
            {health.detail} · checked {new Date(health.checkedAt).toUTCString()}
          </p>
        </section>

        <section className="grid gap-2 sm:grid-cols-3">
          {phases.map((phase) => (
            <article key={phase.label} className="rounded-lg border border-border bg-card p-3">
              <span className="text-caption font-medium tracking-wider text-accent uppercase">
                {phase.label}
              </span>
              <h3 className="text-heading mt-1 text-card-foreground">{phase.title}</h3>
              <p className="text-caption mt-1 text-muted-foreground">{phase.detail}</p>
            </article>
          ))}
        </section>

        <footer className="text-caption text-muted-foreground">
          Schema plan lives in <code className="text-foreground">docs/SCHEMA.md</code>. No tables or
          feature logic exist yet.
        </footer>
      </div>
    </main>
  );
}
