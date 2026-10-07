import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/register")({
  ssr: false,
  head: () => ({ meta: [{ title: "Invitation only — BRQ+" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">Invitation only</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          BRQ+ membership is by invitation. Accounts are provisioned by an
          administrator — public sign-up is disabled.
        </p>
        <Link to="/membership" className="mt-6 inline-block rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20">
          Apply for BRQ+ membership
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">
          Already a member?{" "}
          <Link to="/login" className="text-cyan hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
