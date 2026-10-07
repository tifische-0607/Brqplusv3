import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionTitle({
  eyebrow,
  title,
  description,
  align = "left",
  descriptionClassName,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  descriptionClassName?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6 }}
      className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}
    >
      {eyebrow && (
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{eyebrow}</div>
      )}
      <h2 className="font-display mt-3 whitespace-pre-wrap text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className={cn("mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg", descriptionClassName)}>
          {description}
        </p>
      )}
    </motion.div>
  );
}
