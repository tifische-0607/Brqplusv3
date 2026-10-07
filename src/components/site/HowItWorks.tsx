import { motion } from "motion/react";
import { FileText, Target, Rocket } from "lucide-react";
import { SectionTitle } from "./SectionTitle";

const steps = [
  {
    n: "01",
    title: "Brief the Collective",
    Icon: FileText,
    body: "Submit a confidential mission brief. Tell us the mandate, the timeline, and the outcome you need. All briefs are under NDA by default.",
  },
  {
    n: "02",
    title: "We Match the Operator",
    Icon: Target,
    body: "Within 24 hours we identify the right fractional executive from our collective — someone who has done this exact thing before, in your region, in your sector.",
  },
  {
    n: "03",
    title: "Deploy & Execute",
    Icon: Rocket,
    body: "Clear scope, agreed fee, and your operator on-mission within 72 hours. No juniors. No bait-and-switch. Just senior execution.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative bg-background px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="How the Collective Works"
          title={<>From Brief to Deployed —{"\n"}<span className="text-gradient-gold">in 72 Hours</span>.</>}
        />

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="card-lift-gold group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

              <div className="flex items-start justify-between">
                <span className="font-display text-2xl font-bold tracking-tight text-gold">
                  {s.n}
                </span>
                <span className="flex size-10 items-center justify-center rounded-xl border border-border bg-charcoal text-gold transition-colors group-hover:border-gold/40">
                  <s.Icon size={18} />
                </span>
              </div>

              <h3 className="font-display mt-6 text-xl font-semibold leading-snug">
                {s.title}
              </h3>
              <p className="mt-3 text-[14px] leading-[1.7] text-muted-foreground">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
