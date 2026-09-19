import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register your business — SalesFlow Pro" },
      {
        name: "description",
        content: "Create a SalesFlow Pro workspace as the business owner and invite your team.",
      },
      { property: "og:title", content: "Register your business — SalesFlow Pro" },
      { property: "og:description", content: "Create your workspace and invite your team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/home`,
        data: { business_name: businessName, full_name: fullName },
      },
    });
    setBusy(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/home", replace: true });
      return;
    }
    setNotice("Check your inbox to confirm the email address, then sign in.");
  }

  return (
    <AuthShell
      title="Register your business"
      subtitle="You become the business owner and can invite managers afterwards."
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Already have an account? Sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="text-caption text-muted-foreground" htmlFor="business">
          Business name
        </label>
        <input
          id="business"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
        />
        <label className="text-caption mt-1 text-muted-foreground" htmlFor="name">
          Your full name
        </label>
        <input
          id="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
        />
        <label className="text-caption mt-1 text-muted-foreground" htmlFor="email">
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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-body rounded-md border border-border bg-background px-2 py-1 text-foreground"
        />
        {error ? <p className="text-caption text-danger">{error}</p> : null}
        {notice ? <p className="text-caption text-success">{notice}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="text-body mt-2 rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </AuthShell>
  );
}
