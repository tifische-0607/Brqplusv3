import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getDirectoryCompany } from "@/lib/member-profile.functions";
import { BackToDirectory, Field, Section, Tags } from "@/components/members/ProfileBits";
import { SkeletonRows, ErrorNote } from "@/components/members/portal-ui";

export const Route = createFileRoute("/_authenticated/directory_/companies/$companyId")({
  head: () => ({ meta: [{ title: "Company profile — BRQ+" }, { name: "robots", content: "noindex" }] }),
  component: CompanyProfilePage,
});

function CompanyProfilePage() {
  const { companyId } = Route.useParams();
  const fn = useServerFn(getDirectoryCompany);
  const q = useQuery({ queryKey: ["directory-company", companyId], queryFn: () => fn({ data: { id: companyId } }) });
  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNote error={q.error} />;
  const d: any = q.data;
  if (!d?.available) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="font-display text-2xl font-bold text-foreground">This company profile isn't available</h1>
        <div className="mt-6"><BackToDirectory /></div>
      </div>
    );
  }
  const c = d.company;
  const name = c.trading_name || c.legal_name;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BackToDirectory />
      <header className="flex items-center gap-5 rounded-xl border border-border bg-card p-6">
        {c.logo_url
          ? <img src={c.logo_url} alt={`${name} logo`} className="h-20 w-20 rounded-lg border border-border bg-background object-contain" />
          : <div aria-hidden className="grid h-20 w-20 place-items-center rounded-lg border border-border bg-muted text-xl font-semibold text-muted-foreground">{name[0]}</div>}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{name}</h1>
          <p className="text-sm text-muted-foreground">{[c.sector, c.hq_city, c.country].filter(Boolean).join(" · ")}</p>
          {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-cyan hover:underline">Website →</a>}
        </div>
      </header>
      {c.description && <Section title="About"><p className="whitespace-pre-wrap text-sm text-foreground">{c.description}</p></Section>}
      {c.markets?.length > 0 && <Section title="Markets"><Tags items={c.markets} tone="gold" /></Section>}
      <Section title="Members">
        {d.members.length === 0 ? <p className="text-sm text-muted-foreground">No visible members.</p> : (
          <ul className="divide-y divide-border">
            {d.members.map((m: any) => (
              <li key={m.id}>
                <Link to="/members/$memberId" params={{ memberId: m.id }} className="flex justify-between py-2.5 text-sm hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded">
                  <span className="text-foreground">{m.full_name ?? "Member"}</span>
                  <span className="text-muted-foreground">{m.job_title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <dl className="sr-only"><Field k="Legal name" v={c.legal_name} /></dl>
    </div>
  );
}
