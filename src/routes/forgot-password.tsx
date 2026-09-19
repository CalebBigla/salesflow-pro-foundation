import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — SalesFlow Pro" },
      {
        name: "description",
        content: "Request a password reset link for your SalesFlow Pro account.",
      },
      { property: "og:title", content: "Reset your password — SalesFlow Pro" },
      { property: "og:description", content: "Request a password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setSent(true);
  }

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p className="text-body text-card-foreground">
          If that address has an account, a reset link is on its way.
        </p>
      ) : (
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
          {error ? <p className="text-caption text-danger">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="text-body mt-2 rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
