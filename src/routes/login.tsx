import { useState, useEffect, type FormEvent } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { z } from "zod";
import { MembershipQr } from "@/components/site/MembershipQr";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => z.object({ type: z.enum(["personal", "corporate"]).optional().catch(undefined) }).parse(s),
  head: () => ({ meta: [{ title: "Member sign in — BRQ+" }] }),
  component: LoginPage,
});

type Mode = "password" | "magic";

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [memberType, setMemberType] = useState<"personal" | "corporate">(search.type ?? "personal");
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        setInfo("Check your email for a sign-in link.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setInfo(null);
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/dashboard`,
      });
      if (result.error) {
        setError(result.error.message ?? "Google sign-in failed");
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy px-4 py-16">
      {/* subtle ambient backdrop — distinct from onboarding's split layout */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,_rgba(56,189,248,0.12),_transparent_60%)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link to="/" className="inline-block font-display text-2xl font-extrabold tracking-tight text-foreground">
            BRQ<span className="text-cyan">+</span>
          </Link>
          <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Member portal
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card/80 p-7 shadow-2xl backdrop-blur">
          <div className="mb-4 inline-flex rounded-md border border-border p-0.5 text-xs" role="group" aria-label="Member type">
            {(["personal", "corporate"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={memberType === t}
                onClick={() => { setMemberType(t); navigate({ to: "/login", search: { type: t }, replace: true }); }}
                className={`rounded px-3 py-1 capitalize transition-colors ${memberType === t ? "bg-gold text-navy" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <h1 className="font-display text-xl font-bold text-foreground">{memberType === "corporate" ? "Corporate" : "Personal"} member sign in</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Returning members only. New here?{" "}
            <Link to="/register" className="text-cyan hover:underline">
              See membership
            </Link>
            .
          </p>

          <button
            type="button"
            onClick={onGoogle}
            disabled={googleLoading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-60"
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
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="mb-4 inline-flex rounded-md border border-border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => { setMode("password"); setError(null); setInfo(null); }}
              className={`rounded px-3 py-1 transition-colors ${mode === "password" ? "bg-cyan text-navy" : "text-muted-foreground hover:text-foreground"}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode("magic"); setError(null); setInfo(null); }}
              className={`rounded px-3 py-1 transition-colors ${mode === "magic" ? "bg-cyan text-navy" : "text-muted-foreground hover:text-foreground"}`}
            >
              Magic link
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
              />
            </div>
            {mode === "password" && (
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-cyan focus:outline-none"
                />
              </div>
            )}

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {info && <p role="status" className="text-sm text-cyan">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-cyan px-4 py-2 text-sm font-semibold text-navy transition-colors hover:brightness-110 disabled:opacity-60"
            >
              {loading
                ? (mode === "magic" ? "Sending link…" : "Signing in…")
                : (mode === "magic" ? "Send magic link" : "Sign in")}
            </button>
          </form>

          {mode === "password" && (
            <div className="mt-5 flex items-center justify-center text-xs text-muted-foreground">
              <Link to="/forgot-password" className="hover:text-cyan">
                Forgot password?
              </Link>
            </div>
          )}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Not a member yet? Apply for{" "}
            <Link to="/membership/personal" className="text-gold hover:underline">Personal</Link> or{" "}
            <Link to="/membership/corporate" className="text-gold hover:underline">Corporate</Link> membership
          </p>
          <div className="mt-4 hidden justify-center gap-4 md:flex">
            <MembershipQr kind="personal" size={80} caption="Personal" />
            <MembershipQr kind="corporate" size={80} caption="Corporate" />
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          Onboarding a new member?{" "}
          <span className="text-foreground/80">
            Open the secure invitation link from your email.
          </span>
        </p>
      </div>
    </div>
  );
}
