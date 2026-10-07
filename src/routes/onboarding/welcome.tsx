import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { consumeOnboardingToken, getMyOnboardingStatus } from "@/lib/onboarding.functions";
import { ProgressSteps } from "@/components/onboarding/ProgressSteps";

const WEBHOOK_URL =
  (import.meta.env.VITE_ONBOARDING_WEBHOOK_URL as string | undefined) ||
  "https://hook.n8n.cloud/placeholder/brqplus-welcome";

export const Route = createFileRoute("/onboarding/welcome")({
  head: () => ({ meta: [{ title: "Welcome — BRQ+" }] }),
  component: WelcomePage,
});

function WelcomePage() {
  const navigate = useNavigate();
  const { token } = useSearch({ from: "/onboarding" });
  const fired = useRef(false);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    (async () => {
      try {
        const { status } = await getMyOnboardingStatus();
        setName(status.full_name);
        if (token) {
          await consumeOnboardingToken({ data: { token } }).catch(() => {});
        }
        await fetch(WEBHOOK_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "member.welcome",
            email: status.email,
            name: status.full_name,
            user_id: status.user_id,
          }),
        }).catch(() => {
          /* welcome webhook is best-effort */
        });
      } catch {
        /* ignore */
      }
    })();
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-gold/40 bg-gradient-to-br from-navy via-card to-navy p-10 text-center shadow-xl">
      <ProgressSteps current="welcome" />
      <h2 className="mt-4 font-display text-3xl font-extrabold text-foreground">
        Welcome to the Collective{name ? `, ${name.split(" ")[0]}` : ""}.
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        Your seat at BRQ+ is now active. You'll receive a welcome message shortly with introductions
        and your first mission briefings.
      </p>

      <div className="mt-8">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          className="inline-flex items-center justify-center rounded-md bg-gold px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:brightness-110"
        >
          Enter the Collective
        </button>
      </div>
    </div>
  );
}
