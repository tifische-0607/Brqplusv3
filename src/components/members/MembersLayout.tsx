import { useEffect, useState, type ReactNode } from "react";
import { PaymentBanner } from "@/components/billing/MembershipBilling";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Briefcase, FileSignature, History, Inbox, Megaphone, Target, Building2, ChevronsLeft, ChevronsRight, FileText, Home, LayoutGrid, LifeBuoy, LogOut,
  Menu, MessageSquare, Newspaper, Shield, Sparkles, User, Users, UserCog,
  Receipt, Scale, Tag,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPortalContext, type PortalContext } from "@/lib/portal.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type NavItem = { to: string; label: string; icon: typeof Home; exact?: boolean; badge?: number };
type NavGroup = { heading?: string; items: NavItem[] };

export function usePortalContext() {
  const fn = useServerFn(getPortalContext);
  return useQuery({ queryKey: ["portal-context"], queryFn: () => fn(), staleTime: 60_000 });
}

function navFor(ctx: PortalContext | undefined): NavGroup[] {
  const groups: NavGroup[] = [];
  if (ctx?.company) {
    const items: NavItem[] = [
      { to: "/company", label: "Company Home", icon: Building2, exact: true },
      { to: "/company/profile", label: "Company Profile", icon: FileText },
    ];
    if (ctx.company.role === "admin") items.push({ to: "/company/team", label: "Team", icon: Users });
    items.push(
      { to: "/company/engagements", label: "Engagements", icon: Briefcase },
      { to: "/company/programs", label: "Programs & Sponsorships", icon: Sparkles },
      { to: "/directory", label: "Directory", icon: LayoutGrid },
      { to: "/chat", label: "Messages", icon: MessageSquare },
      { to: "/insights", label: "Insights", icon: Newspaper },
      { to: "/company/documents", label: "Documents", icon: FileText },
    );
    groups.push({ items });
    groups.push({ heading: "My account", items: [
      { to: "/profile", label: "My Profile", icon: User },
      { to: "/account", label: "Account & Security", icon: Shield },
    ] });
  } else {
    groups.push({ items: [
      { to: "/home", label: "Home", icon: Home },
      { to: "/engagements", label: "My Engagements", icon: Briefcase },
      { to: "/programs-me", label: "Programs", icon: Sparkles },
      { to: "/directory", label: "Directory", icon: LayoutGrid },
      { to: "/chat", label: "Messages", icon: MessageSquare },
      { to: "/insights", label: "Insights", icon: Newspaper },
      { to: "/documents", label: "Documents", icon: FileText },
      { to: "/profile", label: "My Profile", icon: User },
      { to: "/account", label: "Account & Security", icon: Shield },
    ] });
  }
  groups.push({ heading: "Legal", items: [
    { to: "/terms", label: "Terms of Service", icon: Scale },
    { to: "/privacy", label: "Privacy Policy", icon: Shield },
    { to: "/membership/agreement", label: "Membership Agreement", icon: FileSignature },
  ] });
  if (ctx?.is_admin) {
    groups.push({ heading: "Admin", items: [
      { to: "/admin", label: "Overview", icon: UserCog, exact: true },
      { to: "/admin/applications", label: "Applications", icon: Inbox, badge: ctx.pending_applications },
      { to: "/admin/users", label: "Members", icon: Users },
      { to: "/admin/companies", label: "Companies", icon: Building2 },
      { to: "/admin/programs", label: "Programs", icon: Sparkles },
      { to: "/admin/tgn-missions", label: "Give Network Missions", icon: Sparkles },
      { to: "/admin/agreements", label: "Agreements", icon: FileSignature },
      { to: "/admin/documents", label: "Documents", icon: FileText },
      { to: "/admin/missions", label: "Missions", icon: Briefcase },
      { to: "/admin/leads", label: "Leads", icon: Target },
      { to: "/admin/insights", label: "Insights", icon: Newspaper },
      { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
      { to: "/admin/billing", label: "Billing", icon: Receipt },
      { to: "/admin/pricing", label: "Pricing", icon: Tag },
      { to: "/admin/requests", label: "Requests", icon: LifeBuoy },
      { to: "/admin/audit", label: "Audit log", icon: History },
    ] });
  }
  return groups;
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

function initials(name: string | null | undefined, email: string) {
  const src = name?.trim() || email;
  return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join("") || "··";
}

export function MemberAvatar({ url, name, email, size = 32 }: { url: string | null; name: string | null; email: string; size?: number }) {
  return url ? (
    <img src={url} alt="" width={size} height={size} className="rounded-full border border-border object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex items-center justify-center rounded-full border border-gold/50 bg-gold/10 text-[11px] font-semibold text-gold" style={{ width: size, height: size }}>
      {initials(name, email)}
    </span>
  );
}

export function MembersLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ctxQ = usePortalContext();
  const ctx = ctxQ.data;
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("brq-portal-collapsed") === "1");
  }, []);
  useEffect(() => setMoreOpen(false), [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      window.localStorage.setItem("brq-portal-collapsed", c ? "0" : "1");
      return !c;
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/login", replace: true });
  }

  const groups = navFor(ctx);
  const flat = groups.flatMap((g) => g.items);
  const current = [...flat].sort((a, b) => b.to.length - a.to.length).find((i) => isActive(pathname, i));
  const title = current?.label ?? (pathname.startsWith("/mission") ? "Engagement" : pathname.startsWith("/admin") ? "Admin" : "BRQ+ Members");
  const docsHref = ctx?.company ? "/company/documents" : "/documents";
  const primary = flat.slice(0, 4);

  return (
    <div className="member-portal min-h-screen bg-navy">
      {/* Desktop sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card/60 backdrop-blur transition-[width] md:flex ${collapsed ? "w-16" : "w-60"}`}>
        <div className="flex h-16 items-center justify-between border-b border-border px-4">
          <Link to="/" className="font-display text-lg font-extrabold tracking-tight text-foreground" aria-label="BRQ+ home">
            BRQ<span className="text-gold">+</span>
            {!collapsed && <span className="ml-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Members</span>}
          </Link>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-4" aria-label="Member portal desktop navigation">
          {ctxQ.isLoading ? (
            <div className="space-y-2 px-2">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-8 animate-pulse rounded-md bg-muted/30" />)}</div>
          ) : groups.map((g, gi) => (
            <div key={gi} className={gi ? "mt-5 border-t border-border pt-4" : ""}>
              {g.heading && !collapsed && <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.heading}</p>}
              <ul className="space-y-0.5">
                {g.items.map((item) => {
                  const active = isActive(pathname, item);
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        title={collapsed ? item.label : undefined}
                         aria-label={collapsed ? item.label : undefined}
                         aria-current={active ? "page" : undefined}
                         className={`flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset ${active ? "bg-gold/10 text-gold" : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"}`}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {!!item.badge && <span className={`${collapsed ? "sr-only" : "ml-auto"} rounded-full bg-gold px-1.5 text-[10px] font-bold text-navy`} aria-label={`${item.badge} pending`}>{item.badge}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <button type="button" onClick={toggleCollapsed} className="flex min-h-11 items-center gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-inset" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed}>
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
        </button>
      </aside>

      <div className={`transition-[padding] ${collapsed ? "md:pl-16" : "md:pl-60"}`}>
        {/* Top bar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border px-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link to="/" className="font-display text-lg font-extrabold text-foreground md:hidden" aria-label="BRQ+ home">BRQ<span className="text-gold">+</span></Link>
            <h1 className="truncate font-display text-base font-semibold text-foreground md:text-lg">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link to={docsHref} className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-muted-foreground hover:bg-muted/20 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label={`Documents to sign${ctx?.pending_count ? `: ${ctx.pending_count}` : ": none"}`}>
              <Bell className="h-5 w-5" />
              {!!ctx?.pending_count && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">{ctx.pending_count}</span>
              )}
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Open account menu">
                <MemberAvatar url={ctx?.avatar_url ?? null} name={ctx?.full_name ?? null} email={ctx?.email ?? ""} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="truncate text-sm font-semibold text-foreground">{ctx?.full_name || ctx?.email || "Member"}</p>
                  <p className="truncate text-xs text-muted-foreground">{ctx?.email}</p>
                  <span className="mt-2 inline-block rounded-full border border-gold/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">
                    {ctx?.company ? `Corporate · ${ctx.company.name}` : "Personal"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link to="/profile"><User className="mr-2 h-4 w-4" />My Profile</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/account"><Shield className="mr-2 h-4 w-4" />Account & Security</Link></DropdownMenuItem>
                {ctx?.is_admin && <DropdownMenuItem asChild><Link to="/admin"><UserCog className="mr-2 h-4 w-4" />Admin</Link></DropdownMenuItem>}
                {ctx?.company && <DropdownMenuItem asChild><Link to="/company"><Building2 className="mr-2 h-4 w-4" />Company</Link></DropdownMenuItem>}
                <DropdownMenuItem asChild><Link to="/contact"><LifeBuoy className="mr-2 h-4 w-4" />Help / Contact BRQ+</Link></DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:pb-12 lg:px-8"><PaymentBanner />{children}</main>
      </div>

      {/* Mobile bottom tabs */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur md:hidden" aria-label="Member portal mobile navigation">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          return (
            <Link key={item.to} to={item.to} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold ${active ? "text-gold" : "text-muted-foreground"}`}>
              <Icon className="h-5 w-5" aria-hidden />
              <span className="max-w-full truncate px-1">{item.label.replace("Company ", "")}</span>
            </Link>
          );
        })}
        <button type="button" onClick={() => setMoreOpen(true)} aria-label="Open more navigation options" aria-expanded={moreOpen} className="flex min-h-14 flex-col items-center justify-center gap-1 py-2 text-[10px] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">
          <Menu className="h-5 w-5" aria-hidden />More
        </button>
      </nav>
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
          {groups.map((g, gi) => (
            <div key={gi} className="mt-4">
              {g.heading && <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{g.heading}</p>}
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.to} to={item.to} aria-current={isActive(pathname, item) ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${isActive(pathname, item) ? "border-gold/60 text-gold" : "border-border text-foreground"}`}>
                      <Icon className="h-4 w-4" aria-hidden />{item.label}
                      {!!item.badge && <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-bold text-navy" aria-label={`${item.badge} pending`}>{item.badge}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <button type="button" onClick={signOut} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
