import { motion } from "motion/react";

export function AdvisoryHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-background px-5 py-24 lg:px-8">
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-gold/5 blur-[120px]" />

      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 md:grid-cols-12">
        {/* Content */}
        <div className="relative flex flex-col justify-center md:col-span-8">
          <div className="flex items-center gap-4">
            <span className="h-px w-12 bg-gold" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-gold">
              Practice Area / Advisory
            </p>
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
            className="font-display mt-6 text-6xl font-bold leading-[0.9] tracking-tighter text-foreground md:text-8xl lg:text-9xl"
          >
            Strategic
            <br />
            <span className="text-gradient-gold">Counsel.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-6 max-w-2xl whitespace-pre-line text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Navigating complex regional enterprise business engagements,
            architecture and regulatory shifts with expertise forged in{" "}
            <span className="font-medium text-foreground">
              more than 3 decades of practitioner work
            </span>
            .{"\n\n\n"}
            We don't just advise; we operate.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <a
              href="#advisory"
              className="inline-flex items-center justify-center rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
            >
              Explore Services
            </a>
            <a
              href="#contact"
              className="inline-flex items-center justify-center rounded-md border border-gold/60 bg-transparent px-5 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/10"
            >
              Start a Brief
            </a>
          </motion.div>

          <div className="mt-16 flex flex-wrap items-center gap-8">
            <div className="flex flex-col">
              <span className="font-display text-2xl font-light text-gold">{">"} 3 decades</span>
              <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Years Experience
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col">
              <span className="font-display text-2xl font-light text-foreground">Global</span>
              <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Market Reach
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col">
              <span className="font-display text-2xl font-light text-foreground">Senior</span>
              <span className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                Only Engagement
              </span>
            </div>
          </div>
        </div>

        {/* Architectural grid visual */}
        <div className="hidden items-center justify-end md:col-span-4 md:flex">
          <div className="relative flex h-[400px] w-full max-w-[280px] items-center justify-center overflow-hidden border border-border">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gold/5 to-transparent" />
            <div className="absolute left-1/4 h-full w-px bg-border" />
            <div className="absolute left-2/4 h-full w-px bg-border" />
            <div className="absolute left-3/4 h-full w-px bg-border" />
            <div className="absolute top-1/4 h-px w-full bg-border" />
            <div className="absolute top-2/4 h-px w-full bg-border" />
            <div className="absolute top-3/4 h-px w-full bg-border" />

            <div className="relative z-10 p-8 text-center">
              <div className="relative mx-auto mb-6 flex size-16 items-center justify-center border border-gold">
                <div className="absolute h-px w-8 rotate-45 bg-gold" />
                <div className="absolute h-px w-8 -rotate-45 bg-gold" />
              </div>
              <span className="block text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Operational
              </span>
              <span className="mt-1 block text-xs font-semibold text-gold">
                EXCELLENCE
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
