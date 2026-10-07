import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SectionTitle } from "@/components/site/SectionTitle";
import { SectionReveal } from "@/components/site/SectionReveal";

export const Route = createFileRoute("/programs/")({
  head: () => ({ meta: [
    { title: "Programs — BRQ+" },
    { name: "description", content: "Explore The Collective @ BRQ+, Founders @ BRQ+ and The Give Network: programs by and supported by BRQ+." },
    { property: "og:title", content: "Programs — BRQ+" },
    { property: "og:description", content: "Explore The Collective @ BRQ+, Founders @ BRQ+ and The Give Network: programs by and supported by BRQ+." },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://v3.brqplus.ai/programs" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://v3.brqplus.ai/programs" }] }),
  component: Programs,
});

function Programs() {
  return <main>
    <section className="border-b border-border bg-charcoal px-5 py-20 sm:py-28 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <p className="font-mono text-xs uppercase tracking-widest text-gold">BRQ+ / Programs</p>
        <h1 className="font-display mt-6 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Programs by and supported by BRQ+</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">BRQ+ provides the platform, coordination and senior operator bench behind community programmes that turn professional expertise into regional impact.</p>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
      <SectionTitle eyebrow="Explore" title="Our programs" description="Expertise put to work, from senior advisory to community-led opportunity." />
       <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <SectionReveal><Link to="/collective" className="group flex h-full flex-col rounded-md border border-border bg-card p-7 transition-colors hover:border-gold sm:p-9">
          <span className="font-mono text-xs uppercase tracking-widest text-gold">BRQ+ Program</span>
          <h2 className="font-display mt-8 text-2xl font-bold sm:text-3xl">The Collective @ BRQ+</h2>
          <p className="mt-4 grow leading-relaxed text-muted-foreground">A curated collective of fractional senior executives — operators who have held C-suite and Senior Executive roles across corporates, NGOs, technology, fintech, financial services, education and compliance in regulated markets.</p>
          <span className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-gold">Explore the program <ArrowUpRight size={17} /></span>
        </Link></SectionReveal>
         <SectionReveal><Link to="/programs/founders" className="group flex h-full flex-col rounded-md border border-border bg-card p-7 transition-colors hover:border-gold sm:p-9">
           <span className="font-mono text-xs uppercase tracking-widest text-gold">BRQ+ Program</span>
           <h2 className="font-display mt-8 text-2xl font-bold sm:text-3xl">Founders @ BRQ+</h2>
           <p className="mt-4 grow leading-relaxed text-muted-foreground">Founder support from veteran operators — fractional senior executives who help early-stage founders raise, scale, govern and enter new markets.</p>
           <span className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-gold">Explore the program <ArrowUpRight size={17} /></span>
         </Link></SectionReveal>
        <SectionReveal><Link to="/programs/give-network" className="group flex h-full flex-col rounded-md border border-border bg-card p-7 transition-colors hover:border-gold sm:p-9">
          <span className="font-mono text-xs uppercase tracking-widest text-gold">Supported by BRQ+</span>
          <h2 className="font-display mt-8 text-2xl font-bold sm:text-3xl">The Give Network</h2>
          <p className="mt-4 grow leading-relaxed text-muted-foreground">Connecting Muslim professionals and founders with real career and venture opportunities across Southeast Asia.</p>
          <p className="mt-6 text-xs text-muted-foreground">Ground-Up Initiative · AMP Muslim Professionals Collective</p>
          <span className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-gold">Explore the program <ArrowUpRight size={17} /></span>
        </Link></SectionReveal>
      </div>
    </section>
  </main>;
}
