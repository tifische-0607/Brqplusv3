import { motion } from "motion/react";

export function UmmahBanner() {
  return (
    <section className="relative bg-background px-5 py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-gold/50 bg-gradient-to-br from-card via-card to-background p-10 sm:p-16"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 -bottom-24 size-72 rounded-full bg-cyan/10 blur-3xl" />

        <div className="relative grid gap-10 lg:grid-cols-5 lg:gap-16">
          <div className="lg:col-span-3">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-gold">The Mission</div>
            <h2 className="font-display mt-4 text-2xl font-extrabold leading-[1.1] text-balance sm:text-5xl lg:text-6xl">
              Impact for the <span className="text-gradient-gold">Community.</span>
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              BRQ+ is dedicated to ethical business transformations, shariah financial
              growth, digital inclusion, and community-centric projects across numerous
              verticals. We build the rails the community can rely on — halal by design,
              regulated by intent, scalable by architecture.
            </p>
          </div>
          <ul className="space-y-5 lg:col-span-2">
            {[
              { k: "Ethical Growth", v: "Shariah-aligned product architecture and risk." },
              { k: "Digital Inclusion", v: "Last-mile rails for diaspora and SME flows." },
              { k: "COMMUNITY IMPACT PROJECTS", v: "Trust-first design, governance, and disclosure." },
            ].map((i) => (
              <li key={i.k} className="rounded-xl border border-border bg-charcoal/60 p-5">
                <div className="font-display text-sm font-bold uppercase tracking-wider text-gold">{i.k}</div>
                <div className="mt-1.5 text-sm text-muted-foreground">{i.v}</div>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
