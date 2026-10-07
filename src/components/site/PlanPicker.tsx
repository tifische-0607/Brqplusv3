import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DRAFT_PRICING_TEXT, planPrice, rm, seatLabel, type BillingCycle, type MembershipPlan } from "@/lib/plans";

export function usePublicPlans() {
  return useQuery({
    queryKey: ["public-membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MembershipPlan[];
    },
    staleTime: 60_000,
  });
}

export function CycleToggle({ value, onChange }: { value: BillingCycle; onChange: (c: BillingCycle) => void }) {
  return (
    <div role="radiogroup" aria-label="Billing cycle" className="inline-flex rounded-full border border-border bg-card p-1 text-sm">
      {(["monthly", "annual"] as const).map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} onClick={() => onChange(c)}
          className={`rounded-full px-4 py-1.5 font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold ${value === c ? "bg-gold text-navy" : "text-muted-foreground hover:text-foreground"}`}>
          {c === "monthly" ? "Monthly" : "Annual"}
        </button>
      ))}
    </div>
  );
}

export function DraftPricingNote({ plans }: { plans: MembershipPlan[] }) {
  if (!plans.some((p) => p.is_draft)) return null;
  return <p role="note" className="inline-block rounded-md border border-warning bg-warning/15 px-3 py-1.5 text-xs font-semibold text-warning">{DRAFT_PRICING_TEXT}</p>;
}

function PriceLine({ plan, cycle }: { plan: MembershipPlan; cycle: BillingCycle }) {
  return (
    <div className="mt-4">
      <span className="font-display text-3xl font-bold text-foreground">{rm(planPrice(plan, cycle))}</span>
      <span className="ml-1 text-sm text-muted-foreground">/{cycle === "annual" ? "year" : "month"}</span>
      {cycle === "annual" && <p className="mt-1 text-xs font-semibold text-gold">Save 2 months</p>}
    </div>
  );
}

export function PlanCard({ plan, cycle, action, selected }: { plan: MembershipPlan; cycle: BillingCycle; action?: React.ReactNode; selected?: boolean }) {
  return (
    <article className={`relative flex h-full flex-col rounded-2xl border bg-card p-6 ${selected ? "border-gold ring-1 ring-gold" : plan.is_popular ? "border-gold/60" : "border-border"}`}>
      {plan.is_popular && <span className="absolute -top-3 left-6 rounded-full bg-gold px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">Most popular</span>}
      <h3 className="font-display text-xl font-bold">{plan.name}</h3>
      {plan.tagline && <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>}
      <PriceLine plan={plan} cycle={cycle} />
      {plan.member_type === "corporate" && <p className="mt-2 text-xs uppercase tracking-wider text-cyan">{seatLabel(plan.max_users)}</p>}
      <ul className="mt-5 grid flex-1 gap-2 text-sm text-muted-foreground">
        {plan.benefits.map((b) => <li key={b} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden />{b}</li>)}
      </ul>
      {action && <div className="mt-6">{action}</div>}
    </article>
  );
}

/** Public /membership pricing section. */
export function PricingSection({ cycle, onCycle }: { cycle: BillingCycle; onCycle: (c: BillingCycle) => void }) {
  const q = usePublicPlans();
  const plans = q.data ?? [];
  return (
    <section aria-labelledby="pricing-title" className="mt-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-gold">Membership plans</p>
          <h2 id="pricing-title" className="font-display mt-2 text-3xl font-bold">Choose your BRQ+ plan</h2>
          <p className="mt-2 text-sm text-muted-foreground">Billed in MYR by invoice after your application is approved.</p>
          <div className="mt-3"><DraftPricingNote plans={plans} /></div>
        </div>
        <CycleToggle value={cycle} onChange={onCycle} />
      </div>
      {q.isLoading && <p className="mt-8 text-sm text-muted-foreground">Loading plans…</p>}
      {(["personal", "corporate"] as const).map((type) => {
        const group = plans.filter((p) => p.member_type === type);
        if (!group.length) return null;
        return (
          <div key={type} className="mt-12">
            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{type === "personal" ? "Personal" : "Corporate"}</h3>
            <div className="mt-6 grid gap-6 md:grid-cols-3">
              {group.map((p) => (
                <PlanCard key={p.id} plan={p} cycle={cycle} action={
                  <Link to={type === "personal" ? "/membership/personal" : "/membership/corporate"} search={{ plan: p.code, cycle } as any}
                    className="inline-flex w-full justify-center rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20">
                    Apply with this plan
                  </Link>
                } />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

/** Required "Choose your plan" step on the application forms. */
export function PlanStep({ type, planCode, cycle, onPlan, onCycle, recommend }: {
  type: "personal" | "corporate"; planCode: string; cycle: BillingCycle; onPlan: (code: string) => void; onCycle: (c: BillingCycle) => void; recommend?: string;
}) {
  const q = usePublicPlans();
  const plans = (q.data ?? []).filter((p) => p.member_type === type);
  const chosen = plans.find((p) => p.code === planCode);
  return (
    <fieldset className="grid gap-5">
      <legend className="font-mono text-xs uppercase tracking-wider text-gold">Choose your plan *</legend>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CycleToggle value={cycle} onChange={onCycle} />
        <DraftPricingNote plans={plans} />
      </div>
      {q.isLoading && <p className="text-sm text-muted-foreground">Loading plans…</p>}
      <div role="radiogroup" aria-label="Membership plan" className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <label key={p.id} className="cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-gold rounded-2xl">
            <input type="radio" name="plan" className="sr-only" checked={planCode === p.code} onChange={() => onPlan(p.code)} />
            <PlanCard plan={p} cycle={cycle} selected={planCode === p.code} action={recommend === p.code ? <p className="text-xs font-semibold text-cyan">Recommended for The Collective</p> : undefined} />
          </label>
        ))}
      </div>
      {chosen && (
        <p role="status" className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm">
          Selected: <strong>{chosen.name}</strong> · {cycle === "annual" ? "Annual" : "Monthly"} · <strong>{rm(planPrice(chosen, cycle))}</strong>{cycle === "annual" ? " per year" : " per month"}
          {type === "corporate" && <> · {seatLabel(chosen.max_users)}</>}. Invoiced after approval.
        </p>
      )}
    </fieldset>
  );
}
