import { Link } from "@tanstack/react-router";

export const ONBOARDING_STEPS = [
  { key: "setup", label: "Account", to: "/onboarding/setup" as const },
  { key: "profile", label: "Profile", to: "/onboarding/profile" as const },
  { key: "agreement", label: "Agreement", to: "/onboarding/agreement" as const },
  { key: "welcome", label: "Welcome", to: "/onboarding/welcome" as const },
] as const;

export type OnboardingStepKey = (typeof ONBOARDING_STEPS)[number]["key"];

export function ProgressSteps({ current }: { current: OnboardingStepKey }) {
  const currentIndex = ONBOARDING_STEPS.findIndex((s) => s.key === current);

  return (
    <nav aria-label="Onboarding progress" className="mb-6">
      <ol className="flex items-center gap-2">
        {ONBOARDING_STEPS.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-current={active ? "step" : undefined}
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors",
                    active
                      ? "border-gold bg-gold text-navy"
                      : done
                      ? "border-gold/60 bg-gold/20 text-gold"
                      : "border-border bg-card text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={[
                    "hidden text-[11px] font-semibold uppercase tracking-wider sm:inline",
                    active ? "text-foreground" : done ? "text-gold/80" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </div>
              {i < ONBOARDING_STEPS.length - 1 ? (
                <div
                  className={[
                    "h-px flex-1",
                    done ? "bg-gold/40" : "bg-border",
                  ].join(" ")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Step {currentIndex + 1} of {ONBOARDING_STEPS.length}
      </p>
    </nav>
  );
}

export function StepBackLink({ to, label }: { to: "/onboarding/setup" | "/onboarding/profile" | "/onboarding/agreement"; label: string }) {
  return (
    <Link
      to={to}
      search={(prev: Record<string, unknown>) => prev}
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
    >
      ← {label}
    </Link>
  );
}
