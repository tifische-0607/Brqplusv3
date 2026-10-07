import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SectionReveal } from "@/components/site/SectionReveal";
import { FounderApplicationForm } from "@/components/site/FounderApplicationForm";

export const Route = createFileRoute("/programs/founders")({
  head: () => ({ meta: [
    { title: "Founders @ BRQ+ — BRQ+ Programs" },
    { name: "description", content: "Founder support from veteran operators across fundraising, scaling, governance and market entry in Southeast Asia and the GCC." },
    { property: "og:title", content: "Founders @ BRQ+ — BRQ+ Programs" },
    { property: "og:description", content: "Veteran operators in your corner — from first raise to regional scale." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://v3.brqplus.ai/programs/founders" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs/founders" }] }),
  component: Founders,
});

const benefits = [
  { title: "Fundraising & investor readiness", text: "Work with senior operators to sharpen the case for investment and prepare for conversations with investors." },
  { title: "Scaling & operations", text: "Put experienced operating judgment alongside your team as you build systems for growth." },
  { title: "Governance, risk & compliance-by-design", text: "Bring governance and risk thinking into the business early, rather than retrofitting it later." },
  { title: "Market entry across ASEAN & GCC", text: "Plan expansion with operators who understand regional execution and regulated markets." },
];
const steps = ["Apply", "Fit call with a BRQ+ principal", "Matched with a fractional operator from The Collective", "Engagement tracked on the BRQ+ platform with clear milestones"];
const formats = [
  { title: "Advisory sprint", text: "Short, focused support for a defined challenge." },
  { title: "Fractional operator", text: "Ongoing part-time senior support." },
  { title: "Board / advisory seat", text: "Senior perspective on governance and direction." },
];

function Founders() {
  return <main>
    <section className="border-b border-border bg-charcoal px-5 py-20 sm:py-28 lg:px-8"><div className="mx-auto max-w-7xl">
      <Link to="/programs" className="font-mono text-xs uppercase tracking-widest text-gold hover:underline">Programs / Founders @ BRQ+</Link>
      <h1 className="font-display mt-7 text-5xl font-bold leading-tight sm:text-7xl">Founders @ BRQ+</h1>
      <p className="mt-6 max-w-3xl text-xl leading-relaxed sm:text-2xl">Veteran mentors in your corner — from first raise to regional scale.</p>
      <p className="mt-5 font-mono text-xs uppercase text-gold">BRQ+ Program</p>
      <Button className="mt-9" onClick={() => { window.history.replaceState(null, "", "#apply"); document.getElementById("apply")?.scrollIntoView({ behavior: "smooth" }); }}>Apply <ArrowDown size={16} /></Button>
    </div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="Who it's for" title="For founders who are building what comes next" description="Early-stage and growth founders building in Southeast Asia and the GCC — especially in fintech, payments, Islamic finance, digital banking, AI and social enterprise." /></section>
    <section className="border-y border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="The support" title="What founders get" /><div className="mt-10 grid gap-4 md:grid-cols-2">{benefits.map((item, index) => <SectionReveal key={item.title}><article className="h-full rounded-md border border-border bg-card p-7 sm:p-9"><span className="font-mono text-sm text-gold">0{index + 1}</span><h3 className="font-display mt-6 text-2xl font-bold">{item.title}</h3><p className="mt-4 leading-relaxed text-muted-foreground">{item.text}</p></article></SectionReveal>)}</div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="The process" title="How it works" /><div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <div key={step} className="border-t border-gold/50 pt-5"><div className="flex items-center justify-between font-mono text-sm text-gold">0{index + 1}{index < 3 && <ArrowRight size={16} />}</div><h3 className="font-display mt-5 text-lg font-semibold">{step}</h3></div>)}</div></section>
    <section className="border-y border-border bg-charcoal px-5 py-20 lg:px-8"><div className="mx-auto max-w-7xl"><SectionTitle eyebrow="Ways to work together" title="Engagement formats" /><div className="mt-10 grid gap-7 md:grid-cols-3">{formats.map(item => <div key={item.title} className="border-t border-border pt-5"><h3 className="font-display text-xl font-semibold">{item.title}</h3><p className="mt-3 text-sm text-muted-foreground">{item.text}</p></div>)}</div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8"><SectionTitle eyebrow="Connected programs" title="More ways to move forward" /><p className="mt-9 max-w-3xl leading-relaxed text-muted-foreground">Founders can also join Back2Basics cohorts via <Link to="/programs/give-network" className="font-semibold text-gold hover:underline">The Give Network</Link>. The operators behind Founders @ BRQ+ come from <Link to="/collective" className="font-semibold text-gold hover:underline">The Collective @ BRQ+</Link>.</p></section>
    <FounderApplicationForm />
  </main>;
}