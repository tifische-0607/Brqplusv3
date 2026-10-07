import { Link } from "@tanstack/react-router";
import { FileCheck2, Scale, ShieldCheck } from "lucide-react";

const documents = [
  {
    to: "/terms" as const,
    title: "Terms of Service",
    description: "Rules for using the BRQ+ website, portal and services.",
    icon: Scale,
  },
  {
    to: "/privacy" as const,
    title: "Privacy Policy",
    description: "How BRQ+ collects, uses, shares and protects personal data.",
    icon: ShieldCheck,
  },
  {
    to: "/membership/agreement" as const,
    title: "Membership Agreement",
    description: "The terms accepted by Personal and Corporate members.",
    icon: FileCheck2,
  },
] as const;

export function LegalDocumentLinks() {
  return (
    <ul className="grid gap-3 md:grid-cols-3">
      {documents.map(({ to, title, description, icon: Icon }) => (
        <li key={to}>
          <Link
            to={to}
            target="_blank"
            rel="noopener"
            className="group flex h-full min-h-28 gap-3 rounded-md border border-border p-4 transition-colors hover:border-gold/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            aria-label={`${title} (opens in a new tab)`}
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden />
            <span>
              <span className="block text-sm font-semibold text-foreground group-hover:text-gold">{title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}