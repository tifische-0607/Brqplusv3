import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowDown, ArrowRight, ExternalLink } from "lucide-react";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SectionReveal } from "@/components/site/SectionReveal";
import { InterestForm, RsvpForm } from "@/components/site/TgnForms";
import { Button } from "@/components/ui/button";
import { workstreams } from "@/lib/tgn-workstreams";
import { TgnMissionListings } from "@/components/site/TgnMissionListings";

export const Route = createFileRoute("/programs/give-network/")({
  head: () => ({ meta: [
    { title: "The Give Network — BRQ+ Programs" },
    { name: "description", content: "The Give Network connects Muslim professionals and founders with real career and venture opportunities across Southeast Asia through four workstreams." },
    { property: "og:title", content: "The Give Network — BRQ+ Programs" },
    { property: "og:description", content: "Career, Venture & Impact — four workstreams for professional growth in the AI era. A ground-up initiative supported by BRQ+." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://v3.brqplus.ai/programs/give-network" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs/give-network" }] }),
  component: GiveNetwork,
});

const EVENTS = [
  { title: "MPS 2026 Breakout — Career, Venture & Impact", when: "Sat 31 Oct 2026 · 1:30–2:30 PM", where: "Begonia Ballroom, Marina Bay Sands Expo & Convention Centre" },
  { title: "Give Network Booth", when: "Sat 31 Oct 2026 · 9 AM–5 PM", where: "Exhibition, Cassia Ballroom" },
  { title: "Overseas Partners Session", when: "Sun 1 Nov 2026 · 10 AM–1 PM", where: "AMP Singapore (venue TBC)" },
];
const FUNCTIONS = [
  { title: "Vetting & Matching", text: "Identify the right experience and connect it with real opportunities." },
  { title: "Coordination", text: "Align professionals, founders, organisations and partners across engagements." },
  { title: "Platform (BRQ+)", text: "Opportunity tracking, collaboration, outcome measurement and transparent reporting." },
  { title: "Community", text: "1-1 sessions, monthly webinars, peer circles and case studies." },
];
const STAKEHOLDERS = [
  ["Professionals", "Apply your expertise to meaningful regional opportunities."],
  ["Founders", "Find guidance and a path to test and grow your venture."],
  ["Corporates", "Access a founder pipeline and experienced practitioners."],
  ["Overseas partners", "Connect with talent and collaborators across markets."],
  ["AMP & community", "Turn professional connections into sustained impact."],
];

function GiveNetwork() {
  const location = useLocation();
  const params = new URLSearchParams(location.searchStr);
  const requested = params.get("workstream");
  const selected = requested && ["A", "B", "C", "D"].includes(requested) ? requested : null;
  const src = params.get("src") ?? undefined;
  useEffect(() => {
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView(), 150);
    return () => window.clearTimeout(timer);
  }, []);
  const jump = (id: string) => { window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${id}`); document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); };
  return <main>
    <section className="border-b border-border bg-charcoal px-5 py-20 sm:py-28 lg:px-8"><div className="mx-auto max-w-7xl">
      <Link to="/programs" className="font-mono text-xs uppercase tracking-widest text-gold hover:underline">Programs / Supported by BRQ+</Link>
      <h1 className="font-display mt-7 text-5xl font-bold leading-tight sm:text-7xl">The Give Network</h1>
      <p className="mt-6 max-w-3xl text-xl leading-relaxed sm:text-2xl">Career, Venture & Impact — Four Workstreams for Professional Growth in the AI Era</p>
      <p className="mt-5 max-w-3xl text-sm text-muted-foreground">A Ground-Up Initiative under AMP's Muslim Professionals Collective · Platform & coordination by BRQ+</p>
      <div className="mt-9 flex flex-wrap gap-3"><Button onClick={() => jump("interest")}>Find your workstream <ArrowDown size={16} /></Button><Button variant="outline" onClick={() => jump("rsvp")}>RSVP for 1 Nov <ArrowDown size={16} /></Button></div>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="The approach" title="An ecosystem integrator, not a funder" description="The Give Network connects the people, opportunities and partners needed to translate expertise into regional impact." />
      <div className="mt-10 grid gap-2 sm:grid-cols-4">{["Professionals & Founders", "The Give Network\nVet · Match · Coordinate", "Ventures, Corporates & Partners", "Regional Impact"].map((step, i) => <div key={step} className="flex items-center gap-3 border-t border-gold/40 py-5 text-sm font-semibold whitespace-pre-line sm:items-start sm:justify-between">{step}{i < 3 && <ArrowRight className="shrink-0 text-gold" size={17} />}</div>)}</div>
      <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">{FUNCTIONS.map(f => <SectionReveal key={f.title}><div className="border-t border-border pt-5"><h3 className="font-display font-semibold">{f.title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.text}</p></div></SectionReveal>)}</div>
    </section>
    <section id="models" className="border-y border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Ways to engage" title="Four workstreams. Different ways forward." /><div className="mt-10 grid gap-4 md:grid-cols-2">{workstreams.map(m => <Link key={m.code} to={`/programs/give-network/${m.slug}`} search={src ? { src } : {}} className={`group block scroll-mt-24 rounded-md border p-7 transition-colors hover:border-gold focus-visible:border-gold sm:p-9 ${selected === m.code ? "border-gold bg-gold/5" : "border-border bg-card"}`}><span className="font-mono text-sm text-gold">Workstream {m.code} / {m.action}</span><h3 className="font-display mt-6 text-2xl font-bold">{m.name}</h3><p className="mt-5 text-sm font-semibold text-foreground">{m.details}</p><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{m.audience}</p><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{m.terms}</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-gold">Explore workstream <ArrowRight size={16} /></span></Link>)}</div></div></section>
    <TgnMissionListings />
    <section className="border-t border-border mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="Workstream-fit guide" title="Where do you see yourself?" description="Find the workstream that fits your next step." /><div className="mt-10 grid gap-3 md:grid-cols-2">{workstreams.map(item => <Link key={item.code} to={`/programs/give-network/${item.slug}`} search={src ? { src } : {}} className="flex min-h-20 items-center rounded-md border border-border px-5 py-4 text-left text-sm transition-colors hover:border-gold hover:text-gold"><span className="mr-3 shrink-0 font-mono text-gold">{item.code}</span>{item.fit}<ArrowRight size={16} className="ml-auto shrink-0 text-gold" /></Link>)}</div></section>
    <section className="border-y border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Meet us" title="Upcoming events" /><div className="mt-9 divide-y divide-border border-y border-border">{EVENTS.map((event, i) => <div key={event.title} className="grid gap-2 py-6 sm:grid-cols-[3rem_1fr_1fr] sm:gap-5"><span className="font-mono text-sm text-gold">0{i + 1}</span><h3 className="font-display text-lg font-semibold">{event.title}</h3><p className="text-sm text-muted-foreground">{event.when}<br />{event.where}</p></div>)}</div><a href="https://bit.ly/AMPS2026" target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline">MPS registration <ExternalLink size={16} /></a></div></section>
    <InterestForm selectedModel={selected ?? null} />
    <RsvpForm />
    <section className="border-y border-border bg-charcoal px-5 py-10 lg:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 text-sm"><span className="mr-3 text-muted-foreground">Prepared by</span>{["The Give Network", "GIV", "Ventura", "WSF", "BRQ+"].map(name => <span key={name} className="rounded-sm border border-border px-3 py-2 font-mono text-xs">{name}</span>)}</div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="Shared value" title="Built for the whole ecosystem" /><div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">{STAKEHOLDERS.map(([name, text]) => <div key={name} className="border-t border-gold/50 pt-5"><h3 className="font-display font-semibold">{name}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{text}</p></div>)}</div></section>
  </main>;
}
