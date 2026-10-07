import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

const quotes = [
  {
    quote:
      "BRQ+ deployed a fractional Chief Payments Officer within 72 hours of our brief. Exactly what we needed, no excessive overhead.",
    attribution: "Founder and CEO of a Rewards Company",
  },
  {
    quote:
      "Finally, a collective that understands both the regulatory landscape and ummatic objectives of our vision.",
    attribution: "CEO, Malaysian GLC",
  },
];

export function TestimonialBar() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % quotes.length), 6000);
    return () => clearInterval(t);
  }, []);

  const current = quotes[i];

  return (
    <section className="border-y border-border bg-background py-6">
      <div className="mx-auto max-w-6xl px-5 lg:px-8">
        <div className="relative min-h-[3.25rem] border-l-2 border-gold/60 pl-5">
          <AnimatePresence mode="wait">
            <motion.blockquote
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3"
            >
              <p className="italic text-sm leading-snug text-foreground/85 sm:text-[15px]">
                “{current.quote}”
              </p>
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-gold/80">
                — {current.attribution}
              </span>
            </motion.blockquote>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
