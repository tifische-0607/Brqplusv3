import { motion } from "motion/react";
import { Landmark, Sparkles, Network, ShieldCheck, Globe2, LineChart } from "lucide-react";
import { SectionTitle } from "./SectionTitle";

const tiles = [
  {
    icon: Landmark,
    title: "Ethical Finance",
    body: "Shariah-aligned structuring, sukuk, takaful and halal product architecture for regulated balance sheets.",
    accent: "gold" as const,
    span: "lg:col-span-2 lg:row-span-2",
  },
  {
    icon: Sparkles,
    title: "Social Enterprise",
    body: "Blended-capital ventures with community-first governance.",
    accent: "cyan" as const,
    span: "lg:col-span-2",
  },
  {
    icon: Network,
    title: "Digital Inclusion",
    body: "Last-mile rails for diaspora, migrant and SME flows.",
    accent: "cyan" as const,
    span: "",
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Transformation",
    body: "Operating-model redesign and modernisation playbooks for banks and fintechs.",
    accent: "gold" as const,
    span: "",
  },
  {
    icon: Globe2,
    title: "Emerging Markets",
    body: "On-the-ground licensing, sponsor banking and regulator dialog across Asia and MENA.",
    accent: "cyan" as const,
    span: "lg:col-span-2",
  },
  {
    icon: LineChart,
    title: "AI & Intelligent Ops",
    body: "Production AI for risk, onboarding, smart routing and agentic operations.",
    accent: "gold" as const,
    span: "lg:col-span-2",
  },
];

export function ExpertBento() {
  return (
    <section className="relative bg-charcoal px-5 py-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <SectionTitle
          eyebrow="Areas of Expertise"
          title={<>Mandates We <span className="text-gradient-gold">Execute</span></>}
          description="Six interlocking practice areas where operator-grade execution meets ethical ambition."
        />

        <div className="mt-14 grid auto-rows-[minmax(180px,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => {
            const Icon = t.icon;
            const glow = t.accent === "gold" ? "glow-gold" : "glow-cyan";
            const iconColor = t.accent === "gold" ? "text-gold" : "text-cyan";
            return (
              <motion.article
                key={t.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.06 }}
                className={`group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 ${glow} ${t.span}`}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <div className="mb-5 inline-flex size-12 items-center justify-center rounded-xl border border-border bg-charcoal">
                  <Icon className={iconColor} size={22} />
                </div>
                <h3 className="font-display text-lg font-bold leading-snug sm:text-xl">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t.body}</p>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
