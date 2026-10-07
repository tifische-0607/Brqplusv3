import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getMemberProfile } from "@/lib/member-profile.functions";
import { getOrCreateDmChannel } from "@/lib/chat.functions";
import { Avatar, BackToDirectory, Field, Section, Tags, Unavailable, availabilityLabel } from "@/components/members/ProfileBits";
import { SkeletonRows, ErrorNote } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/members/$memberId")({
  head: () => ({ meta: [{ title: "Member profile — BRQ+" }, { name: "robots", content: "noindex" }] }),
  component: MemberProfilePage,
});

function MemberProfilePage() {
  const { memberId } = Route.useParams();
  const fn = useServerFn(getMemberProfile);
  const dmFn = useServerFn(getOrCreateDmChannel);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["member-profile", memberId], queryFn: () => fn({ data: { id: memberId } }) });
  const dm = useMutation({
    mutationFn: () => dmFn({ data: { other_user_id: memberId } }),
    onSuccess: (r) => navigate({ to: "/chat", search: { c: r.channel_id } }),
  });

  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const d = q.data!;
  if (!d.available) return <Unavailable />;
  const p: any = d.profile;
  const e: any = d.executive;
  const company = p.companies;
  const collective = p.collective_status === "approved";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackToDirectory />
      <header className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center">
        <Avatar url={p.avatar_url} name={p.full_name} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold text-foreground">{p.full_name ?? "Member"}</h1>
          <p className="text-sm text-muted-foreground">{[p.job_title, p.organisation].filter(Boolean).join(" · ")}</p>
          {(p.city || p.country) && <p className="mt-1 text-xs text-muted-foreground">{[p.city, p.country].filter(Boolean).join(", ")}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full border border-gold/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
              {company ? `Corporate · ${company.trading_name || company.legal_name}` : "Personal"}
            </span>
            {collective && <span className="rounded-full border border-gold/50 bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold text-gold">The Collective</span>}
            {d.isAdmin && !p.show_in_directory && <span className="rounded-full border border-border px-2.5 py-0.5 text-[10px] text-muted-foreground">Hidden from directory</span>}
          </div>
        </div>
        {!d.isSelf && (
          <button onClick={() => dm.mutate()} disabled={dm.isPending}
            className="rounded-md border border-gold bg-gold/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold hover:bg-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:opacity-60">
            {dm.isPending ? "Opening…" : "Message"}
          </button>
        )}
      </header>
      {dm.isError && <p role="alert" className="text-sm text-destructive">Couldn't open a conversation. Please try again.</p>}

      {p.bio && <Section title="About"><p className="whitespace-pre-wrap text-sm text-foreground">{p.bio}</p></Section>}

      <Section title="Details">
        <dl className="grid gap-4 sm:grid-cols-2">
          <Field k="Sector" v={p.sector} />
          <Field k="Years of experience" v={p.years_experience} />
          <Field k="Languages" v={(p.languages ?? []).join(", ")} />
          {collective && e && <Field k="Availability" v={availabilityLabel[e.availability] ?? e.availability} />}
        </dl>
        {p.expertise?.length > 0 && <div className="mt-4"><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Expertise</p><Tags items={p.expertise} /></div>}
        {p.markets?.length > 0 && <div className="mt-4"><p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Markets</p><Tags items={p.markets} tone="gold" /></div>}
      </Section>

      {(p.email || p.phone || p.linkedin_url) && (
        <Section title="Contact">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {p.email && <li><a href={`mailto:${p.email}`} className="text-gold hover:underline">{p.email}</a></li>}
            {p.phone && <li className="text-foreground">{p.phone}</li>}
            {p.linkedin_url && <li><a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-gold hover:underline">LinkedIn →</a></li>}
          </ul>
        </Section>
      )}

      {collective && e && (
        <Section title="Executive profile">
          <dl className="grid gap-4 sm:grid-cols-2"><Field k="Domain" v={e.role} /></dl>
          {e.expertise?.length > 0 && <div className="mt-4"><Tags items={e.expertise} /></div>}
          {e.markets?.length > 0 && <div className="mt-3"><Tags items={e.markets} tone="gold" /></div>}
          {e.bio && <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{e.bio}</p>}
        </Section>
      )}

      {company && (
        <Section title="Company">
          <Link to="/directory/companies/$companyId" params={{ companyId: company.id }} className="block rounded-lg border border-border p-4 hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
            <p className="font-semibold text-foreground">{company.trading_name || company.legal_name}</p>
            <p className="text-xs text-muted-foreground">{[company.sector, company.country].filter(Boolean).join(" · ")}</p>
            <p className="mt-2 text-xs text-cyan">View company →</p>
          </Link>
        </Section>
      )}
    </div>
  );
}
