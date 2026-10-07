import { motion } from "motion/react";

export function MissionImpactBanner() {
  return (
    <section className="relative bg-navy px-5 py-20 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.7 }}
        className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-cyan/40 bg-gradient-to-br from-navy via-charcoal to-charcoal p-10 sm:p-16"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-cyan/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 -bottom-20 size-72 rounded-full bg-gold/10 blur-3xl" />

        <div className="relative max-w-2xl">
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan">
            Mission Impact
          </div>
          <h2 className="font-display mt-4 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            Outcomes, <span className="text-gradient-gold">not decks.</span>
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
            The Collective @ BRQ+ is measured by what ships — regulatory licences won, rails switched
            on, communities served. These numbers move every quarter.
          </p>
        </div>
      </motion.div>
    </section>
  );
}