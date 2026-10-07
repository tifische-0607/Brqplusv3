import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AccessDeniedProps {
  title?: string;
  message?: string;
  /** Additional actions (e.g. Claim first admin button) rendered below the message. */
  children?: ReactNode;
  /** Wrap in a full-screen navy background. Defaults to true for use as a route errorComponent. */
  fullScreen?: boolean;
}

/**
 * Standard access-denied state for admin routes.
 * Renders no partial data — callers should mount this in place of any data UI
 * whenever isForbiddenError(error) is true.
 */
export function AccessDenied({
  title = "Access denied",
  message = "Your account does not have admin privileges required to view this page.",
  children,
  fullScreen = true,
}: AccessDeniedProps) {
  const card = (
    <div
      role="alert"
      aria-live="polite"
      className="mx-auto max-w-xl rounded-xl border border-border bg-card p-6"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
        Admin role required
      </p>
      <h2 className="mt-2 font-display text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      {children && <div className="mt-4">{children}</div>}
      <div className="mt-6 flex items-center gap-3 text-xs">
        <Link
          to="/admin/leads"
          className="rounded-md border border-border px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Go to leads
        </Link>
        <Link
          to="/"
          className="rounded-md border border-border px-3 py-2 font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          Home
        </Link>
      </div>
    </div>
  );

  if (!fullScreen) return card;
  return <div className="min-h-screen bg-navy px-5 py-12 lg:px-8">{card}</div>;
}
