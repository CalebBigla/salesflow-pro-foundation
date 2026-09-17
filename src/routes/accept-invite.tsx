import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? (search["token"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: "Accept your invitation — SalesFlow Pro" },
      {
        name: "description",
        content:
          "Create your SalesFlow Pro account from an invitation and join your team's workspace.",
      },
      { property: "og:title", content: "Accept your invitation — SalesFlow Pro" },
      { property: "og:description", content: "Join your team's workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
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
        data: { invite_token: token, full_name: fullName },
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

  if (!token) {
    return (
      <AuthShell
        title="Invitation link needed"
        subtitle="Open the full invitation link you were given."
        footer={
          <Link to="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        }
      >
        <p className="text-body text-card-foreground">
          This page needs the invitation code from your link. Ask whoever invited you to resend it.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Accept your invitation"
      subtitle="Use the same email address the invitation was sent to."
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Already registered? Sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="text-caption text-muted-foreground" htmlFor="name">
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
          {busy ? "Joining…" : "Join workspace"}
        </button>
      </form>
    </AuthShell>
  );
}
