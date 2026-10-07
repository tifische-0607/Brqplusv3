import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ProgressSteps } from "@/components/onboarding/ProgressSteps";

export const Route = createFileRoute("/onboarding/setup")({
  head: () => ({ meta: [{ title: "Set your password — BRQ+" }] }),
  component: SetupPage,
});

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; tone: string };

function scorePassword(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const map: Strength[] = [
    { score: 0, label: "Too short", tone: "bg-destructive" },
    { score: 1, label: "Weak", tone: "bg-destructive" },
    { score: 2, label: "Fair", tone: "bg-gold/80" },
    { score: 3, label: "Strong", tone: "bg-cyan" },
    { score: 4, label: "Excellent", tone: "bg-cyan" },
  ];
  return map[score];
}

function SetupPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const strength = useMemo(() => scorePassword(password), [password]);
  const mismatched = confirm.length > 0 && password !== confirm;

  async function onGoogle() {
    setError(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/onboarding/profile`,
      });
      if (result.error) {
        setError(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/onboarding/profile", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  }


  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate({ to: "/onboarding/profile", replace: true, search: (prev: Record<string, unknown>) => prev });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <ProgressSteps current="setup" />
      <h2 className="font-display text-xl font-bold text-foreground">Account setup</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Welcome to BRQ+. Set a password to secure your account, or continue with Google using the same email as your invite.
      </p>

      <button
        type="button"
        onClick={onGoogle}
        disabled={googleLoading}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
          <path className="fill-google-yellow" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
          <path className="fill-google-red" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/>
          <path className="fill-google-green" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
          <path className="fill-google-blue" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 35.5 44 30.3 44 24c0-1.2-.1-2.4-.4-3.5z"/>
        </svg>
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or set a password
        <div className="h-px flex-1 bg-border" />
      </div>


      <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="ob-pw" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New password
          </label>
          <input
            id="ob-pw"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          {password.length > 0 ? (
            <div className="mt-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden>
                <div
                  className={`h-full transition-all ${strength.tone}`}
                  style={{ width: `${(strength.score / 4) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {strength.label} · 12+ chars with mixed case, numbers, and a symbol is ideal.
              </p>
            </div>
          ) : null}
        </div>
        <div>
          <label htmlFor="ob-pw2" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Confirm password
          </label>
          <input
            id="ob-pw2"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground ${
              mismatched ? "border-destructive" : "border-border"
            }`}
            aria-invalid={mismatched}
          />
          {mismatched ? (
            <p className="mt-1 text-xs text-destructive">Passwords do not match.</p>
          ) : null}
        </div>

        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={loading || password.length < 8 || password !== confirm}
          className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
