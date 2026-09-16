import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthShell } from "@/components/auth-shell";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — SalesFlow Pro" },
      { name: "description", content: "Set a new password for your SalesFlow Pro account." },
      { property: "og:title", content: "Choose a new password — SalesFlow Pro" },
      { property: "og:description", content: "Set a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate({ to: "/home", replace: true });
  }

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Open this page from the reset link in your email."
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-2">
        <label className="text-caption text-muted-foreground" htmlFor="password">
          New password
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
        <button
          type="submit"
          disabled={busy}
          className="text-body mt-2 rounded-md bg-primary px-3 py-1 font-medium text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save password"}
        </button>
      </form>
    </AuthShell>
  );
}
