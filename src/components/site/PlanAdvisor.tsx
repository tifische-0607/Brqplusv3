import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recommendPlan, type PlanAdvice } from "@/lib/plan-advisor.functions";
import { usePublicPlans } from "@/components/site/PlanPicker";
import { planPrice, rm } from "@/lib/plans";

const field = "mt-2 w-full rounded-md border border-border bg-background px-4 py-3 text-foreground outline-none focus:border-gold";

export function PlanAdvisor() {
  const ask = useServerFn(recommendPlan);
  const { data: plans = [] } = usePublicPlans();
  const [memberType, setMemberType] = useState<"personal" | "corporate" | "unsure">("unsure");
  const [goals, setGoals] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PlanAdvice | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (goals.trim().length < 20) { setResult({ ok: false, error: "Please describe your goals in a little more detail (at least 20 characters)." }); return; }
    setBusy(true); setResult(null);
    try { setResult(await ask({ data: { memberType, goals } })); }
    catch { setResult({ ok: false, error: "The advisor couldn't respond. Please try again." }); }
    finally { setBusy(false); }
  }
  const plan = result?.ok ? plans.find((p) => p.code === result.plan_code) : undefined;

  return (
    <section aria-labelledby="advisor-title" className="mt-16 rounded-2xl border border-gold/40 bg-card p-6 md:p-8">
      <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-gold"><Sparkles className="h-4 w-4" aria-hidden />Plan advisor</p>
      <h2 id="advisor-title" className="font-display mt-2 text-2xl font-bold">Not sure which plan fits?</h2>
      <p className="mt-2 text-sm text-muted-foreground">Tell us what you want to achieve with BRQ+ and we'll suggest a plan. This is guidance only — you can choose any plan when you apply.</p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-5">
        <label className="block text-sm">Joining as
          <select className={field} value={memberType} onChange={(e) => setMemberType(e.target.value as typeof memberType)}>
            <option value="unsure">Not sure yet</option><option value="personal">An individual</option><option value="corporate">A company</option>
          </select>
        </label>
        <label className="block text-sm">Your goals
          <textarea className={`${field} min-h-28 resize-y`} maxLength={1500} value={goals} onChange={(e) => setGoals(e.target.value)} placeholder="e.g. I'm a senior payments executive looking to take on fractional mandates in Islamic fintech across ASEAN." />
          <span className="mt-1 block text-right text-xs text-muted-foreground">{goals.length}/1500</span>
        </label>
        <Button type="submit" disabled={busy} className="w-fit">{busy ? "Thinking…" : "Recommend a plan"}</Button>
      </form>
      <div aria-live="polite" className="mt-6">
        {result && !result.ok && <p role="alert" className="text-sm text-destructive">{result.error}</p>}
        {result?.ok && (
          <div className="rounded-xl border border-gold bg-gold/5 p-5">
            <p className="font-mono text-xs uppercase tracking-wider text-gold">Recommended · {result.member_type === "corporate" ? "Corporate" : "Personal"}</p>
            <h3 className="font-display mt-1 text-xl font-bold">{plan?.name ?? result.plan_code}{plan && <span className="ml-2 text-base font-normal text-muted-foreground">{rm(planPrice(plan, result.billing_cycle))}/{result.billing_cycle === "annual" ? "year" : "month"}</span>}</h3>
            <p className="mt-3 text-sm text-muted-foreground">{result.explanation}</p>
            <Link to={result.member_type === "corporate" ? "/membership/corporate" : "/membership/personal"} search={{ plan: result.plan_code, cycle: result.billing_cycle }}
              className="mt-4 inline-flex rounded-md border border-gold bg-gold/10 px-4 py-2 text-sm font-semibold text-gold hover:bg-gold/20">Apply with this plan →</Link>
          </div>
        )}
      </div>
    </section>
  );
}
