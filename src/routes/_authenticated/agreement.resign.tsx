import { createFileRoute } from "@tanstack/react-router";
import { AgreementSigner } from "@/components/agreements/AgreementSigner";

export const Route = createFileRoute("/_authenticated/agreement/resign")({
  head: () => ({ meta: [{ title: "Updated membership agreement — BRQ+" }] }),
  component: ResignPage,
});

function ResignPage() {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-wider text-gold">Action required</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground">Updated BRQ+ Membership Agreement</h1>
      <p className="mt-2 text-sm text-muted-foreground">BRQ+ has published a new version of the Membership Agreement. Please review and sign it to continue using the member portal.</p>
      <div className="mt-6 rounded-xl border border-border bg-card p-6">
        {/* Full reload so the access check picks up the new signature. */}
        <AgreementSigner onSigned={() => window.location.assign("/dashboard")} />
      </div>
    </div>
  );
}
