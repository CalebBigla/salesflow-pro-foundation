import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-3 py-8">
      <div className="w-full max-w-md">
        <Link to="/" className="text-caption font-medium tracking-[0.18em] text-accent uppercase">
          SalesFlow Pro
        </Link>
        <div className="mt-2 rounded-lg border border-border bg-card p-3">
          <h1 className="text-heading text-card-foreground">{title}</h1>
          <p className="text-caption mt-1 text-muted-foreground">{subtitle}</p>
          <div className="mt-3">{children}</div>
        </div>
        {footer ? <div className="text-caption mt-2 text-muted-foreground">{footer}</div> : null}
      </div>
    </main>
  );
}
