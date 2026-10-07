import { useEffect, useState, type ReactNode } from "react";
import {
  createFileRoute,
  Outlet,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  validateOnboardingToken,
  resendOnboardingInvite,
  getMyOnboardingStatus,
} from "@/lib/onboarding.functions";

const SearchSchema = z.object({
  token: z.string().uuid().optional(),
});

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  validateSearch: (s) => SearchSchema.parse(s),
  head: () => ({ meta: [{ title: "Member onboarding — BRQ+" }] }),
  component: OnboardingLayout,
});

function OnboardingLayout() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/onboarding" });
  const resendFn = useServerFn(resendOnboardingInvite);
  const [state, setState] = useState<
    | { kind: "checking" }
    | { kind: "ok" }
    | { kind: "denied"; message: string }
    | { kind: "resending" }
    | { kind: "resent"; newToken: string }
  >({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !data.user) {
        navigate({ to: "/login", replace: true });
        return;
      }

      // Already-onboarded short-circuit: skip the wizard entirely.
      try {
        const { status } = await getMyOnboardingStatus();
        if (!cancelled && status.is_onboarded) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
      } catch {
        /* fall through to token check */
      }

      if (!token) {
        setState({
          kind: "denied",
          message:
            "Onboarding is invitation-only. Please open the secure link from your invitation email.",
        });
        return;
      }
      try {
        await validateOnboardingToken({ data: { token } });
        if (!cancelled) setState({ kind: "ok" });
      } catch (err) {
        if (cancelled) return;
        setState({
          kind: "denied",
          message:
            err instanceof Error
              ? err.message
              : "This invitation link is not valid.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const handleResend = async () => {
    setState({ kind: "resending" });
    try {
      const redirectTo = `${window.location.origin}/onboarding`;
      const result = await resendFn({ data: { redirect_to: redirectTo } });
      // Replace the URL token so validation re-runs
      navigate({
        to: "/onboarding",
        search: { token: result.token },
        replace: true,
      });
      setState({ kind: "resent", newToken: result.token });
    } catch (err) {
      setState({
        kind: "denied",
        message:
          err instanceof Error
            ? err.message
            : "Could not generate a new invitation. Please contact support.",
      });
    }
  };

  return (
    <Shell>
      {state.kind === "checking" || state.kind === "resending" || state.kind === "resent" ? (
        <div className="rounded-2xl border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {state.kind === "resending"
            ? "Generating a new invitation…"
            : state.kind === "resent"
            ? "Invitation refreshed — reloading…"
            : "Validating your invitation…"}
        </div>
      ) : state.kind === "denied" ? (
        <div className="rounded-2xl border border-destructive/40 bg-card/80 p-10 text-center">
          <div className="text-xs font-semibold uppercase tracking-widest text-destructive">
            Access denied
          </div>
          <h2 className="mt-3 font-display text-2xl font-bold text-foreground">
            Invitation required
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
            {state.message}
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={handleResend}
              className="inline-flex rounded-md bg-gold px-4 py-2 text-xs font-semibold text-navy hover:bg-gold/90"
            >
              Resend invite
            </button>
            <button
              onClick={() => navigate({ to: "/login" })}
              className="inline-flex rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted/20"
            >
              Return to sign in
            </button>
          </div>
        </div>
      ) : (
        <Outlet />
      )}
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy via-background to-navy">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-[420px_1fr]">
        {/* Left brand panel — distinct from /login */}
        <aside className="hidden flex-col justify-between border-r border-gold/20 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.18),_transparent_60%)] p-10 lg:flex">
          <div>
            <div className="font-display text-3xl font-extrabold tracking-tight text-foreground">
              BRQ<span className="text-gold">+</span>
            </div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
              Member onboarding
            </div>
          </div>

          <div className="space-y-6 text-sm text-muted-foreground">
            <p className="text-base text-foreground">
              Welcome to the Collective.
            </p>
            <p>
              You're a few short steps from joining a curated network of
              fractional executives advising the world's most ambitious
              operators.
            </p>
            <ol className="space-y-2 text-xs uppercase tracking-wider text-muted-foreground/80">
              <li>1 — Secure your account</li>
              <li>2 — Tell us about your practice</li>
              <li>3 — Countersign the membership agreement</li>
              <li>4 — Enter the Collective</li>
            </ol>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Questions? Reply to your invitation email and a partner will assist.
          </p>
        </aside>

        {/* Right content panel */}
        <main className="flex items-center justify-center px-4 py-12 lg:px-12">
          <div className="w-full max-w-xl">
            <div className="mb-6 lg:hidden">
              <div className="font-display text-2xl font-extrabold tracking-tight text-foreground">
                BRQ<span className="text-gold">+</span>
                <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-gold">
                  Onboarding
                </span>
              </div>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
