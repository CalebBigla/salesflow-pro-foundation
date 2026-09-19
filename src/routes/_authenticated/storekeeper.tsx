import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard-shell";
import { StockQueue } from "@/components/stock-queue";

export const Route = createFileRoute("/_authenticated/storekeeper")({
  head: () => ({
    meta: [
      { title: "Storekeeper dashboard — SalesFlow Pro" },
      {
        name: "description",
        content: "Storekeeper view: stock levels, stock requests and catalogue.",
      },
      { property: "og:title", content: "Storekeeper dashboard — SalesFlow Pro" },
      { property: "og:description", content: "Storekeeper view of stock and requests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <DashboardShell role="storekeeper">
      <h1 className="text-display text-foreground">Storekeeper dashboard</h1>
      <p className="text-body mt-1 max-w-xl text-muted-foreground">
        Approve or reject stock requests, watch stock levels and keep the product list up to date.
      </p>
      <StockQueue />
    </DashboardShell>
  ),
});
