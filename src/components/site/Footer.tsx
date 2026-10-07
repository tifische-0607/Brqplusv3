import { Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";

// TODO: replace placeholder URLs with live BRQ+ social handles when available.
const SOCIALS = [
  { label: "Email", href: "mailto:hello@brqplus.ai", Icon: Mail },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-border bg-charcoal">
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Link to="/" className="font-display text-2xl font-extrabold">
              BRQ<span className="text-gold">+</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">
              {"BRQ Plus Sdn Bhd\nCompany Reg. 202601006582 (1668680-A)"}
            </p>
            <ul className="mt-5 space-y-2 text-sm text-muted-foreground">
              {SOCIALS.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={`${label}: hello@brqplus.ai`}
                    className="inline-flex items-center gap-2 transition-colors hover:text-gold"
                  >
                    <Icon size={15} className="shrink-0" aria-hidden="true" />
                    <span>hello@brqplus.ai</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4">
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gold">Firm</h4>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li><Link to="/advisory" className="hover:text-gold">Advisory</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gold">Programs</h4>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li><Link to="/programs" className="hover:text-gold">All Programs</Link></li>
                <li><Link to="/collective" className="hover:text-gold">The Collective @ BRQ+</Link></li>
                <li><Link to="/programs/founders" className="hover:text-gold">Founders @ BRQ+</Link></li>
                <li><Link to="/programs/give-network" className="hover:text-gold">The Give Network</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gold">Join</h4>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li><Link to="/membership/personal" className="hover:text-gold">Personal membership</Link></li>
                <li><Link to="/membership/corporate" className="hover:text-gold">Corporate membership</Link></li>
                <li><Link to="/membership/personal" search={{ collective: 1 }} className="hover:text-gold">Join the Collective</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-gold">Connect</h4>
              <ul className="mt-3 space-y-2 text-muted-foreground">
                <li><Link to="/contact" className="hover:text-gold">Consult the Collective</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <p className="flex flex-wrap gap-x-2 gap-y-1">
            <span>© {new Date().getFullYear()} BRQ+. All rights reserved.</span>
            <span aria-hidden>·</span><Link to="/terms" className="hover:text-gold">Terms of Service</Link>
            <span aria-hidden>·</span><Link to="/privacy" className="hover:text-gold">Privacy Policy</Link>
            <span aria-hidden>·</span><Link to="/membership/agreement" className="hover:text-gold">Membership Agreement</Link>
          </p>
          <p>Kuala Lumpur · Singapore · Indonesia</p>
        </div>
      </div>
    </footer>
  );
}
