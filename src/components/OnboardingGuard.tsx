import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { getMyOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding.functions";

const ONBOARDING_PREFIX = "/onboarding";

export function OnboardingGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await getMyOnboardingStatus();
        if (cancelled) return;
        setStatus(status);
      } catch {
        // If status fetch fails, fail-open so the auth gate can handle it.
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!checked || !status) return;
    if (status.is_onboarded) {
      if (status.needs_resign && !status.is_admin && pathname !== "/agreement/resign") {
        navigate({ to: "/agreement/resign", replace: true });
      }
      return;
    }
    // Admins are exempt from the executive onboarding flow.
    if (status.is_admin) return;
    if (pathname.startsWith(ONBOARDING_PREFIX)) return;

    const dest = status.has_profile_details
      ? "/onboarding/agreement"
      : "/onboarding/profile";
    navigate({ to: dest, replace: true });
  }, [checked, status, pathname, navigate]);

  if (!checked) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return <>{children}</>;
}
