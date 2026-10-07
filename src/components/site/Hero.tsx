import { motion, useScroll, useTransform } from "motion/react";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { MeshBackground } from "./MeshBackground";
import { ArrowRight } from "lucide-react";

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, 120]);
  const opacity = useTransform(scrollY, [0, 500], [1, 0.4]);

  return (
    <section ref={ref} className="relative isolate overflow-hidden">
      <motion.div style={{ y, opacity }} className="absolute inset-0">
        <MeshBackground />
      </motion.div>

      <div className="relative mx-auto flex min-h-[92vh] max-w-7xl flex-col items-start justify-center px-5 py-24 lg:px-8">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-charcoal/60 px-3 py-1 text-xs font-medium tracking-wider text-muted-foreground uppercase backdrop-blur"
        >
          <span className="size-1.5 rounded-full bg-gold" />
          FRACTIONAL ADVISORY & EXECUTION COLLECTIVE ·
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-display mt-6 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-balance sm:text-6xl lg:text-7xl"
        >
          High Impact Advisory.<br />
          Veteran Leadership.<br />
          <span className="text-gradient-gold text-[0.8em] sm:text-[inherit]">
            Impact for the Community.
          </span>
        </motion.h1>

        <div className="mt-8 max-w-[58ch] space-y-5">
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.25 }}
            className="text-base leading-[1.7] text-muted-foreground text-balance sm:text-lg sm:leading-[1.6] lg:text-[1.125rem]"
          >
            BRQ+ is a curated collective of fractional senior executives — operators who have held C-suite and Senior Executive roles across corporates, NGOs, technology, fintech, financial services, education and compliance in regulated markets. We deploy the right operator for your mission, not a junior team. More than 35+ years of collective practitioner experience. 5 markets are served as of today. Outcomes, not decks.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-10 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            to="/collective"
            className="group inline-flex items-center justify-center gap-2 rounded-md bg-gold px-6 py-3.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 hover:shadow-[var(--shadow-gold)]"
          >
            Hire the Collective
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/join"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-cyan/60 bg-transparent px-6 py-3.5 text-sm font-semibold text-cyan transition hover:bg-cyan/10 hover:shadow-[var(--shadow-cyan)]"
          >
            Join the Collective
          </Link>
        </motion.div>

      </div>
    </section>
  );
}
