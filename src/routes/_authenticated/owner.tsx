import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell, PhaseTwoNote } from "@/components/dashboard-shell";

export const Route = createFileRoute("/_authenticated/owner")({
  head: () => ({
    meta: [
      { title: "Owner dashboard — SalesFlow Pro" },
      { name: "description", content: "Business owner view: team, targets, inventory and audit trail." },
      { property: "og:title", content: "Owner dashboard — SalesFlow Pro" },
      { property: "og:description", content: "Business owner view of your workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DashboardShell role="owner">
      <h1 className="text-display text-foreground">Owner dashboard</h1>
      <p className="text-body mt-1 max-w-xl text-muted-foreground">
        You can invite managers, storekeepers and sales representatives from the Team page. Business
        figures arrive in Phase 2.
      </p>
      <PhaseTwoNote
        items={[
          "All dashboards & sales",
          "Monthly targets",
          "Inventory & product catalogue",
          "Business settings",
          "Reports & exports",
          "Audit log",
        ]}
      />
    </DashboardShell>
  ),
});
