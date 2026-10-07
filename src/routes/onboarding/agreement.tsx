import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProgressSteps, StepBackLink } from "@/components/onboarding/ProgressSteps";
import { AgreementSigner } from "@/components/agreements/AgreementSigner";

export const Route = createFileRoute("/onboarding/agreement")({
  head: () => ({ meta: [{ title: "Membership agreement — BRQ+" }] }),
  component: AgreementPage,
});

function AgreementPage() {
  const navigate = useNavigate();
  return (
    <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
      <ProgressSteps current="agreement" />
      <h2 className="font-display text-xl font-bold text-foreground">BRQ+ Membership Agreement</h2>
      <p className="mt-2 text-sm text-muted-foreground">Please read the agreement in full, then sign electronically to continue.</p>
      <div className="mt-6">
        <AgreementSigner
          back={<StepBackLink to="/onboarding/profile" label="Back" />}
          onSigned={() => navigate({ to: "/onboarding/welcome", replace: true, search: (prev: Record<string, unknown>) => prev })}
        />
      </div>
    </div>
  );
}
