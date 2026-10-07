import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMemberNdaSigning, signNdaAsMember } from "@/lib/nda.functions";
import { SigningForm } from "@/components/agreements/SigningForm";

export const Route = createFileRoute("/_authenticated/nda/$partyId")({
  head: () => ({ meta: [{ title: "Sign Engagement NDA — BRQ+" }] }),
  component: Page,
});

function Page() {
  const { partyId } = Route.useParams();
  const fn = useServerFn(getMemberNdaSigning);
  const sign = useServerFn(signNdaAsMember);
  const q = useQuery({ queryKey: ["nda-signing", partyId], queryFn: () => fn({ data: { party_id: partyId } }), retry: false });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading NDA…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">{(q.error as Error).message}</p>;
  const d = q.data!;
  return (
    <div className="max-w-3xl">
      <Link to="/mission/$missionId" params={{ missionId: d.mission_id }} className="text-xs text-muted-foreground hover:text-gold">← Back to mission</Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-gold">Documents to sign</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-foreground">BRQ+ Engagement NDA</h1>
      {d.status === "signed" ? (
        <p className="mt-6 rounded-md border border-gold/40 bg-gold/10 p-4 text-sm text-foreground">This NDA has already been signed. Your signed PDF is in the Documents section of your profile.</p>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-6">
          <SigningForm
            heading={d.heading}
            body={d.body}
            isDraft={d.is_draft}
            consent={d.consent}
            needsTitle
            profileName={d.profile_name}
            defaultTitle={d.job_title}
            submitLabel="Sign NDA"
            onSubmit={async (s) => {
              await sign({ data: { party_id: partyId, ...s, agreed: true } });
              window.location.assign(`/mission/${d.mission_id}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
