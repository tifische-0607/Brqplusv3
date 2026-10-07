import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { createInvoiceCheckout, createSubscriptionCheckout, getInvoiceForPayment } from "@/lib/invoice-payments.functions";
import { PaymentTestModeBanner } from "@/components/billing/PaymentTestModeBanner";
import { rm } from "@/lib/plans";

export const Route = createFileRoute("/_authenticated/pay/$invoiceId")({
  validateSearch: (s: Record<string, unknown>): { session_id?: string } => ({ session_id: typeof s.session_id === "string" ? s.session_id : undefined }),
  head: () => ({ meta: [{ title: "Pay invoice — BRQ+" }, { name: "description", content: "Pay your BRQ+ membership invoice securely online." }] }),
  component: PayInvoice,
});

function PayInvoice() {
  const { invoiceId } = Route.useParams();
  const { session_id } = Route.useSearch();
  const getFn = useServerFn(getInvoiceForPayment);
  const checkoutFn = useServerFn(createInvoiceCheckout);
  const subFn = useServerFn(createSubscriptionCheckout);
  const [mode, setMode] = useState<"once" | "auto">("once");
  const q = useQuery({ queryKey: ["pay-invoice", invoiceId, session_id], queryFn: () => getFn({ data: { id: invoiceId } }), retry: false, refetchInterval: (qq) => (session_id && (qq.state.data as any)?.invoice?.status !== "paid" ? 3000 : false) });
  const options = useMemo(() => ({
    fetchClientSecret: async () => {
      const fn = mode === "auto" ? subFn : checkoutFn;
      const r = await fn({ data: { id: invoiceId, environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/pay/${invoiceId}?session_id={CHECKOUT_SESSION_ID}` } });
      if ("error" in r) throw new Error(r.error);
      return r.clientSecret;
    },
  }), [invoiceId, checkoutFn, subFn, mode]);

  const d = q.data as any;
  const inv = d?.invoice;
  const payable = inv && ["issued", "overdue"].includes(inv.status);
  let stripeErr: string | null = null;
  let stripe: ReturnType<typeof getStripe> | null = null;
  try { stripe = getStripe(); } catch (e) { stripeErr = (e as Error).message; }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PaymentTestModeBanner />
      <Link to="/account" className="text-sm text-muted-foreground hover:text-gold">← Back to billing</Link>
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Pay invoice</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-foreground">{inv?.number ?? "Invoice"}</h1>
      </header>
      {q.isLoading ? <p className="text-muted-foreground">Loading…</p>
        : d?.error ? <p role="alert" className="text-destructive">{d.error}</p>
        : q.isError ? <p role="alert" className="text-destructive">{(q.error as Error).message}</p>
        : inv && <>
          <div className="rounded-xl border border-border bg-card p-5 text-sm">
            <p>BRQ+ {inv.plan_name} membership · {inv.billing_cycle === "annual" ? "Annual" : "Monthly"}</p>
            <p className="mt-1 text-muted-foreground">Subtotal {rm(inv.amount_myr)} · SST {inv.tax_rate}% · Due {inv.due_at}</p>
            <p className="mt-2 font-display text-2xl font-bold text-gold">{rm(inv.total_myr)}</p>
          </div>
          {inv.status === "paid" ? <p role="status" className="rounded-md border border-gold/50 bg-gold/10 px-4 py-3 text-sm">Payment received on {inv.paid_at}. Thank you — your BRQ+ membership is active.</p>
            : session_id ? <p role="status" className="text-sm text-muted-foreground">Confirming your payment…</p>
            : !payable ? <p className="text-sm text-muted-foreground">This invoice is {inv.status} and can't be paid online.</p>
            : stripeErr ? <p role="alert" className="text-sm text-destructive">{stripeErr}</p>
            : <>
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-gold">How would you like to pay?</legend>
                {([["once", "Pay this invoice", "One-off card payment. Future renewals arrive as invoices you can pay by card or bank transfer."], ["auto", "Renew automatically", `Charged now, then every ${inv.billing_cycle === "annual" ? "year" : "month"} to this card. Cancel anytime; access continues to the end of the paid period.`]] as const).map(([v, t, dsc]) => (
                  <label key={v} className={`cursor-pointer rounded-xl border p-4 text-sm focus-within:ring-2 focus-within:ring-gold ${mode === v ? "border-gold bg-gold/10" : "border-border bg-card"}`}>
                    <input type="radio" name="paymode" value={v} checked={mode === v} onChange={() => setMode(v)} className="sr-only" />
                    <span className="block font-semibold text-foreground">{t}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{dsc}</span>
                  </label>
                ))}
              </fieldset>
              <div key={mode} id="checkout" className="overflow-hidden rounded-xl bg-white"><EmbeddedCheckoutProvider stripe={stripe} options={options}><EmbeddedCheckout /></EmbeddedCheckoutProvider></div>
            </>}
          <p className="text-xs text-muted-foreground">Prefer bank transfer? Download the invoice PDF from your billing page and quote {inv.number} as your reference.</p>
        </>}
    </div>
  );
}
