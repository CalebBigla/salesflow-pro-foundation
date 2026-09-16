import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, PhaseTwoNote } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/sales-rep")({
  head: () => ({
    meta: [
      { title: "Sales rep dashboard — SalesFlow Pro" },
      { name: "description", content: "Sales representative view: own sales, stock requests and targets." },
      { property: "og:title", content: "Sales rep dashboard — SalesFlow Pro" },
      { property: "og:description", content: "Sales representative view of your own numbers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DashboardShell role="sales_rep">
      <h1 className="text-display text-foreground">Sales representative dashboard</h1>
      <p className="text-body mt-1 max-w-xl text-muted-foreground">
        Recording sales and requesting stock arrive in Phase 2. You will only ever see your own sales.
      </p>
      <PhaseTwoNote
        items={[
          "Own dashboard",
          "Record daily sale",
          "Submit stock request",
          "View inventory (read only)",
          "Own sales history",
          "Own reports",
        ]}
      />
    </DashboardShell>
  ),
});
