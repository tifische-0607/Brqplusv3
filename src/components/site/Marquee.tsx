const sectors = [
  "Aviation",
  "Digital Banking",
  "Remittance",
  "Regulatory Bodies",
  "Islamic Finance",
  "Capital Markets",
  "AI Payments",
  "Cross-Border",
  "E-Wallets",
  "Sovereign Wealth",
];

export function Marquee() {
  const items = [...sectors, ...sectors];
  return (
    <section className="border-y border-border bg-charcoal py-10">
      <div className="mx-auto max-w-7xl px-5 lg:px-8">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          Sectors of Practice
        </p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
          <div className="animate-marquee flex w-max gap-12 whitespace-nowrap">
            {items.map((s, i) => (
              <span
                key={i}
                className="font-display text-xl font-bold uppercase tracking-wider text-muted-foreground/60 transition-colors hover:text-foreground sm:text-2xl"
              >
                {s}
                <span className="ml-12 text-gold/50">+</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
