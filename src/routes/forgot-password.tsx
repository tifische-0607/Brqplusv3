import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset password — BRQ+" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <h1 className="font-display text-2xl font-bold text-foreground">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll email you a link to set a new password.
        </p>

        {sent ? (
          <p className="mt-6 text-sm text-cyan">Check your inbox for the reset link.</p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-navy disabled:opacity-60"
            >
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-cyan hover:underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
