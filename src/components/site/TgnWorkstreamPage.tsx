import { Link, useLocation } from "@tanstack/react-router";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/site/SectionTitle";
import { workstreams } from "@/lib/tgn-workstreams";

export function TgnWorkstreamPage({ index }: { index: number }) {
  const location = useLocation();
  const rawSource = new URLSearchParams(location.searchStr).get("src");
  const src = rawSource && ["booth", "breakout", "qr"].includes(rawSource) ? rawSource : undefined;
  const item = workstreams[index];
  const previous = workstreams[index - 1];
  const next = workstreams[index + 1];
  if (!item) return null;
  const linkTo = (slug: string) => `/programs/give-network/${slug}` as "/programs/give-network/remote-advisory" | "/programs/give-network/back2basics" | "/programs/give-network/missions" | "/programs/give-network/immersion";
  return <main>
    <section className="border-b border-border bg-charcoal px-5 py-20 sm:py-28 lg:px-8"><div className="mx-auto max-w-7xl">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase text-gold"><Link to="/programs" className="hover:underline">Programs</Link><span>/</span><Link to="/programs/give-network" className="hover:underline">The Give Network</Link><span>/</span><span className="text-muted-foreground">Workstream {item.code}</span></nav>
      <p className="mt-12 font-mono text-sm text-gold">Workstream {item.code} / {item.action}</p>
      <h1 className="font-display mt-5 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">{item.name}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{item.summary}</p>
      <Button asChild className="mt-9"><Link to="/programs/give-network" search={{ workstream: item.code, src }} hash="interest">Register interest <ArrowRight size={16} /></Link></Button>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-16 lg:px-8"><SectionTitle eyebrow="At a glance" title="The essentials" /><dl className="mt-9 grid gap-6 md:grid-cols-3">{[["Commitment", item.commitment], ["Best suited for", item.suited], ["Cost basis", item.cost]].map(([label, value]) => <div key={label} className="border-t border-gold/50 pt-5"><dt className="font-mono text-xs uppercase text-gold">{label}</dt><dd className="mt-4 text-base leading-relaxed">{value}</dd></div>)}</dl></section>
    <section className="border-y border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="The process" title="How it works" /><ol className="mt-10 grid gap-6 md:grid-cols-2">{item.process.map((step, i) => <li key={step} className="border-t border-border pt-5"><span className="font-mono text-sm text-gold">0{i + 1}</span><p className="mt-4 max-w-xl leading-relaxed text-muted-foreground">{step}</p></li>)}</ol></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="Your fit" title="Is this for you?" /><p className="mt-8 max-w-2xl text-xl leading-relaxed">“{item.fit}”</p></section>
    {item.code === "B" && <section className="border-y border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="For corporate sponsors" title="An innovation pipeline with real-world momentum" /><p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">Support a bespoke R&amp;D pipeline, strengthen industry positioning and access a 250% tax deduction via AMP. Sponsorship is S$1,500 per session.</p><Button asChild variant="outline" className="mt-8"><Link to="/contact">Get in touch <ArrowRight size={16} /></Link></Button></div></section>}
    <section className="border-t border-border px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Take part" title="Register interest" /><Button asChild className="mt-8"><Link to="/programs/give-network" search={{ workstream: item.code, src }} hash="interest">Register interest <ArrowRight size={16} /></Link></Button><nav aria-label="Workstream navigation" className="mt-16 flex flex-wrap items-center justify-between gap-6 border-t border-border pt-6 text-sm text-gold">{previous ? <Link to={linkTo(previous.slug)} search={src ? { src } : {}} className="inline-flex items-center gap-2 hover:underline"><ArrowLeft size={16} /> Workstream {previous.code} · {previous.action}</Link> : <span />}{next ? <Link to={linkTo(next.slug)} search={src ? { src } : {}} className="inline-flex items-center gap-2 hover:underline">Workstream {next.code} · {next.action} <ArrowRight size={16} /></Link> : <span />}</nav><Link to="/programs/give-network" search={{ src }} className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold"><ArrowLeft size={16} /> Back to The Give Network</Link></div></section>
  </main>;
}