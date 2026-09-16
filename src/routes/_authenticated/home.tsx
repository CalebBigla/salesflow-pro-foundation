import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { homeForRoles } from "@/lib/roles";
import { useSessionProfile } from "@/hooks/useSessionProfile";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Opening your workspace — SalesFlow Pro" },
      { name: "description", content: "Redirecting you to the dashboard for your role." },
      { property: "og:title", content: "Opening your workspace — SalesFlow Pro" },
      { property: "og:description", content: "Redirecting you to your role's dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HomeRedirect,
});

function HomeRedirect() {
  const { data, error } = useSessionProfile();
  const navigate = useNavigate();

  useEffect(() => {
    if (data) navigate({ to: homeForRoles(data.roles), replace: true });
  }, [data, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-3">
      <p className="text-body text-muted-foreground">
        {error instanceof Error ? error.message : "Opening your workspace…"}
      </p>
    </main>
  );
}
