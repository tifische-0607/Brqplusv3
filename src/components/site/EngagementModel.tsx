import { motion } from "motion/react";
import { Lock, Users, Clock } from "lucide-react";

const features = [
  {
    icon: Lock,
    label: "Confidential Brief",
    description: "All engagements begin under NDA by default.",
  },
  {
    icon: Users,
    label: "Named Team Only",
    description: "You know exactly who is executing before you sign.",
  },
  {
    icon: Clock,
    label: "72-Hour Turnaround",
    description: "Scope, fee, and team confirmed within three days.",
  },
];

export function EngagementModel() {
  return (
    <section className="relative bg-charcoal px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan">
            THE ENGAGEMENT MODEL
          </div>
          <h2 className="font-display mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
            From Brief to Execution in{" "}
            <span className="text-gradient-gold">72 Hours.</span>
          </h2>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg"
        >
          Every engagement begins with a confidential briefing — a direct conversation between
          you and a senior BRQ+ operator, not a business development team. Within 72 hours, we
          return with a clear scope, a named team drawn from the collective, and a fixed fee.
          No lengthy discovery phases, no RFP theatre, no junior analysts learning on your
          budget. The operators we assign have sat in the exact roles your problem lives in —
          they have run payments infrastructure, built shariah-compliant product stacks,
          navigated central bank corridors across Asia and the Gulf, and shipped AI in
          production. From the first call to final delivery, you deal only with practitioners.
        </motion.p>

        <motion.blockquote
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 max-w-3xl border-l-2 border-gold/60 pl-6"
        >
          <p className="font-display text-lg font-semibold leading-snug italic text-foreground sm:text-xl lg:text-2xl">
            The engagement ends when the problem is fixed — not when the retainer runs out.
          </p>
        </motion.blockquote>

        <div className="mt-14 grid gap-5 sm:grid-cols-3">
          {features.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{
                  duration: 0.6,
                  delay: i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <div className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-charcoal">
                  <Icon className="text-cyan" size={18} />
                </div>
                <div className="font-display mt-5 text-sm font-bold uppercase tracking-wider text-foreground">
                  {f.label}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
