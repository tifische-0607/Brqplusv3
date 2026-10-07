import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SectionTitle } from "./SectionTitle";

export function ProgramsStrip() {
  return <section className="border-y border-border bg-charcoal px-5 py-16 lg:px-8">
    <div className="mx-auto max-w-7xl">
      <SectionTitle eyebrow="BRQ+" title="Our Programs" description="Senior expertise and community opportunity, brought into action." />
       <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/collective" className="group flex items-center justify-between gap-4 border-t border-border py-5 hover:text-gold"><div><span className="font-mono text-xs uppercase text-gold">BRQ+ Program</span><h3 className="font-display mt-2 text-xl font-semibold">The Collective @ BRQ+</h3><p className="mt-1 text-sm text-muted-foreground">A curated collective of fractional senior executives.</p></div><ArrowUpRight className="shrink-0" /></Link>
         <Link to="/programs/founders" className="group flex items-center justify-between gap-4 border-t border-border py-5 hover:text-gold"><div><span className="font-mono text-xs uppercase text-gold">BRQ+ Program</span><h3 className="font-display mt-2 text-xl font-semibold">Founders @ BRQ+</h3><p className="mt-1 text-sm text-muted-foreground">Founder support from veteran operators — fractional senior executives who help early-stage founders raise, scale, govern and enter new markets.</p></div><ArrowUpRight className="shrink-0" /></Link>
        <Link to="/programs/give-network" className="group flex items-center justify-between gap-4 border-t border-border py-5 hover:text-gold"><div><span className="font-mono text-xs uppercase text-gold">Supported by BRQ+</span><h3 className="font-display mt-2 text-xl font-semibold">The Give Network</h3><p className="mt-1 text-sm text-muted-foreground">Connecting professionals and founders to regional opportunities.</p></div><ArrowUpRight className="shrink-0" /></Link>
      </div><Link to="/programs" className="mt-6 inline-block text-sm font-semibold text-gold hover:underline">Explore all programs →</Link>
    </div>
  </section>;
}
