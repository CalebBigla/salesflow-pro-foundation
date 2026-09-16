import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/no-access")({
  head: () => ({
    meta: [
      { title: "No role assigned — SalesFlow Pro" },
      { name: "description", content: "Your account has no role in this workspace yet." },
      { property: "og:title", content: "No role assigned — SalesFlow Pro" },
      { property: "og:description", content: "Your account has no role in this workspace yet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NoAccess,
});

function NoAccess() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-3">
      <div className="max-w-md rounded-lg border border-border bg-card p-3 text-center">
        <h1 className="text-heading text-card-foreground">No role assigned yet</h1>
        <p className="text-caption mt-1 text-muted-foreground">
          Ask the business owner or your manager to give your account a role, then sign in again.
        </p>
      </div>
    </main>
  );
}
