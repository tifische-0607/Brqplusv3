import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const links = [
  { to: "/", label: "Main" },
  { to: "/advisory", label: "Advisory" },
  { to: "/membership", label: "Membership" },
  { to: "/contact", label: "Get In Touch" },
] as const;
const programs = [
  { to: "/programs", label: "All Programs" },
  { to: "/collective", label: "The Collective @ BRQ+" },
  { to: "/programs/founders", label: "Founders @ BRQ+" },
  { to: "/programs/give-network", label: "The Give Network @ BRQ+" },
  { to: "/programs/give-network/remote-advisory", label: "Workstream A · Remote Advisory", nested: true },
  { to: "/programs/give-network/back2basics", label: "Workstream B · Back2Basics", nested: true },
  { to: "/programs/give-network/missions", label: "Workstream C · Trade/Impact Missions", nested: true },
  { to: "/programs/give-network/immersion", label: "Workstream D · Employment Immersion", nested: true },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);
  const [programsOpen, setProgramsOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => setSignedIn(!error && !!data?.session))
      .catch(() => setSignedIn(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loginBtn = "inline-flex items-center gap-1 rounded-md border border-gold px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gold transition-colors hover:bg-gold/10";

  return (
    <header className="glass sticky top-0 z-50 w-full">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="font-display text-xl font-extrabold tracking-tight">
          BRQ<span className="text-gold">+</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {links.map((l, i) => (
            <div key={l.to} className="contents">
            {i === 2 && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-1 text-sm text-muted-foreground hover:text-cyan">Programs <ChevronDown size={15} /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="z-[100] min-w-64 rounded-none border-border bg-charcoal p-2 text-muted-foreground">
                  {programs.map(p => (
                    <DropdownMenuItem key={p.to} asChild className={`cursor-pointer rounded-sm py-2 text-sm text-muted-foreground focus:bg-secondary focus:text-gold ${"nested" in p ? "ml-2 border-l border-gold/40 pl-5 pr-3 text-xs" : "px-3"}`}>
                      <Link to={p.to}>{p.label}</Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link
              to={l.to}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-cyan hover:[text-shadow:0_0_12px_var(--cyan)]"
              activeProps={{ className: "text-foreground" }}
              activeOptions={l.to === "/" ? { exact: true } : undefined}
            >
              {l.label}
            </Link>
            </div>
          ))}
          {signedIn ? (
            <Link to="/dashboard" className={loginBtn}>My Portal</Link>
          ) : (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className={loginBtn}>Member Login <ChevronDown size={14} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[100] min-w-48 rounded-none border-border bg-charcoal p-2 text-muted-foreground">
                <DropdownMenuItem asChild className="cursor-pointer rounded-sm px-3 py-2 text-sm text-muted-foreground focus:bg-secondary focus:text-gold">
                  <Link to="/login" search={{ type: "personal" }}>Personal Member</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer rounded-sm px-3 py-2 text-sm text-muted-foreground focus:bg-secondary focus:text-gold">
                  <Link to="/login" search={{ type: "corporate" }}>Corporate Member</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </nav>


        <Button variant="ghost"
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-2 text-foreground md:hidden"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </Button>
      </div>

      {open && (
        <div className="border-t border-border bg-charcoal md:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-3">
            {links.map((l, i) => (
              <div key={l.to}>
              {i === 2 && <div className="px-3"><Button variant="ghost" className="w-full justify-between text-muted-foreground" onClick={() => setProgramsOpen(v => !v)} aria-expanded={programsOpen}>Programs <ChevronDown size={16} /></Button>
                 {programsOpen && <div className="ml-3 flex flex-col border-l border-gold/50 pl-2">{programs.map(p => <Link key={p.to} to={p.to} onClick={() => setOpen(false)} className={`py-2 text-sm text-muted-foreground hover:text-gold ${"nested" in p ? "ml-3 border-l border-gold/40 pl-4 text-xs" : "px-3"}`}>{p.label}</Link>)}</div>}
              </div>}
              <Link
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-cyan"
              >
                {l.label}
              </Link>
              </div>
            ))}
            <div className="mt-2 border-t border-border px-3 pt-3">
              {signedIn ? (
                <Link to="/dashboard" onClick={() => setOpen(false)} className={loginBtn}>My Portal</Link>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold">Member Login</p>
                  <div className="mt-1 flex flex-col border-l border-gold/50 pl-2">
                    <Link to="/login" search={{ type: "personal" }} onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-gold">Personal Member</Link>
                    <Link to="/login" search={{ type: "corporate" }} onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-muted-foreground hover:text-gold">Corporate Member</Link>
                  </div>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
