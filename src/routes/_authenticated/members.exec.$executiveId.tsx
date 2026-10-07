import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getExecutiveProfile } from "@/lib/member-profile.functions";
import { Avatar, BackToDirectory, Field, Section, Tags, Unavailable, availabilityLabel } from "@/components/members/ProfileBits";
import { SkeletonRows, ErrorNote } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/members/exec/$executiveId")({
  head: () => ({ meta: [{ title: "Collective executive — BRQ+" }, { name: "robots", content: "noindex" }] }),
  component: ExecProfilePage,
});

function ExecProfilePage() {
  const { executiveId } = Route.useParams();
  const fn = useServerFn(getExecutiveProfile);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["exec-profile", executiveId], queryFn: () => fn({ data: { id: executiveId } }) });
  const redirectTo = q.data && q.data.available && "redirectTo" in q.data ? q.data.redirectTo : null;
  useEffect(() => {
    if (redirectTo) navigate({ to: "/members/$memberId", params: { memberId: redirectTo }, replace: true });
  }, [redirectTo, navigate]);

  if (q.isLoading || redirectTo) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const d: any = q.data;
  if (!d?.available || !d.executive) return <Unavailable />;
  const e = d.executive;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackToDirectory />
      <header className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        <Avatar url={e.avatar_url} name={e.name} />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{e.name}</h1>
          <p className="text-sm text-muted-foreground">{e.role}</p>
          <span className="mt-3 inline-block rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold text-gold">The Collective</span>
        </div>
      </header>
      <Section title="Executive profile">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field k="Domain" v={e.role} />
          <Field k="Availability" v={availabilityLabel[e.availability] ?? e.availability} />
        </dl>
        {e.expertise?.length > 0 && <div className="mt-4"><Tags items={e.expertise} /></div>}
        {e.markets?.length > 0 && <div className="mt-3"><Tags items={e.markets} tone="gold" /></div>}
        {e.bio && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{e.bio}</p>}
        {e.linkedin_url && <a href={e.linkedin_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-gold hover:underline">LinkedIn →</a>}
      </Section>
    </div>
  );
}
