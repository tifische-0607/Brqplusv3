import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function Tags({ items, tone = "cyan" }: { items?: string[] | null; tone?: "cyan" | "gold" | "muted" }) {
  if (!items || items.length === 0) return null;
  const cls = tone === "gold" ? "border-gold/30 bg-gold/10 text-gold" : tone === "cyan" ? "border-cyan/30 bg-cyan/10 text-cyan" : "border-border text-muted-foreground";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t) => <li key={t} className={`rounded-full border px-2.5 py-0.5 text-xs ${cls}`}>{t}</li>)}
    </ul>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-gold">{title}</h2>
      {children}
    </section>
  );
}

export function Field({ k, v }: { k: string; v: ReactNode }) {
  if (v === null || v === undefined || v === "" ) return null;
  return <div><dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="mt-0.5 text-sm text-foreground">{v}</dd></div>;
}

export function Avatar({ url, name, size = 96 }: { url: string | null; name: string | null; size?: number }) {
  const ini = (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join("") || "?";
  return url
    ? <img src={url} alt="" width={size} height={size} style={{ width: size, height: size }} className="rounded-full border border-border object-cover" />
    : <div style={{ width: size, height: size }} aria-hidden className="grid place-items-center rounded-full border border-border bg-muted text-xl font-semibold text-muted-foreground">{ini}</div>;
}

export function BackToDirectory() {
  return <Link to="/directory" className="inline-flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold rounded">← Back to directory</Link>;
}

export function Unavailable() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-8 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">This profile isn't available</h1>
      <p className="mt-2 text-sm text-muted-foreground">The member may have chosen not to appear in the directory, or their membership isn't active.</p>
      <div className="mt-6"><BackToDirectory /></div>
    </div>
  );
}

export const availabilityLabel: Record<string, string> = { available: "Available", limited: "Limited", unavailable: "Unavailable", not_deployed: "Not deployed" };
