import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — SalesFlow Pro" },
      {
        name: "description",
        content: "Sign in to your SalesFlow Pro sales and inventory workspace.",
      },
      { property: "og:title", content: "Sign in — SalesFlow Pro" },
      { property: "og:description", content: "Sign in to your SalesFlow Pro workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Use the email address your workspace was created with."
      footer={
        <div className="flex flex-wrap justify-between gap-2">
          <Link to="/forgot-password" className="text-accent hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="text-accent hover:underline">
            Register a business
          </Link>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="text-caption text-muted-foreground" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
        />
        <label className="text-caption mt-1 text-muted-foreground" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
        />
        {error ? <p className="text-caption text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="text-body mt-2 rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthShell>
  );
}
