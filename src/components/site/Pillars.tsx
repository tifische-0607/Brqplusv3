import { motion } from "motion/react";
import { Activity, Brain, Globe2, Rocket } from "lucide-react";
import { SectionTitle } from "./SectionTitle";

const pillars = [
  {
    icon: Activity,
    title: "High-Impact Business Transformation",
    body: "Operating-model redesign, platform modernization, and post-merger acceleration for enterprises",
    accent: "cyan" as const,
    metrics: ["Operating model", "Org design", "Modernisation"],
  },
  {
    icon: Brain,
    title: "AI-Infused FinTech Innovation",
    body: "Productionising AI for risk, onboarding, and intelligent payments — from architecture to go-live.",
    accent: "gold" as const,
    metrics: ["AI risk", "Smart routing", "Agentic ops"],
  },
  {
    icon: Globe2,
    title: "EduTech",
    body: "Operating strategy, Innovation, EduPreneurship, Curriculum development.",
    accent: "mix" as const,
    metrics: ["EDUTECH", "CAMBRIDGE", "Curriculum"],
  },
  {
    icon: Rocket,
    title: "Market Entry",
    body: "Market expansion, local partnership structuring, and go-to-market acceleration for new regions and segments.",
    accent: "gold" as const,
    metrics: ["Market analysis", "Entry strategy", "Local partners"],
  },
];

export function Pillars() {
  return (
    <section id="advisory" className="relative scroll-mt-24 bg-background px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="Core Pillar"
          title={<>The Strategic <span className="text-gradient-gold">Foundation</span></>}
          description="Specialist business impact advisory grounded in more than 3 decades of practitioner work — not theory."
        />

        <div className="mt-14 grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            const glow = p.accent === "gold" ? "glow-gold" : "glow-cyan";
            const iconColor =
              p.accent === "gold" ? "text-gold" : p.accent === "cyan" ? "text-cyan" : "text-cyan";
            return (
              <motion.article
                key={p.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`group relative flex flex-col rounded-2xl border border-border bg-card p-7 transition-all duration-300 ${glow}`}
              >
                <div className="mb-6 inline-flex size-12 items-center justify-center rounded-xl border border-border bg-charcoal">
                  <Icon className={iconColor} size={22} />
                </div>
                <h3 className="font-display text-xl font-bold leading-snug">{p.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                <ul className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
                  {p.metrics.map((m) => (
                    <li
                      key={m}
                      className="rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted-foreground"
                    >
                      {m}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
