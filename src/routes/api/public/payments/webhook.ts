import { createFileRoute } from "@tanstack/react-router";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

async function settle(session: any, env: StripeEnv) {
  if (session?.mode === "subscription") {
    const { onSubscriptionCheckout } = await import("@/lib/subscriptions.server");
    return onSubscriptionCheckout(session, env);
  }
  const invoiceId = session?.metadata?.invoice_id;
  if (!invoiceId || session.payment_status === "unpaid") return;
  const { applyInvoicePayment } = await import("@/lib/invoice.server");
  const ref = typeof session.payment_intent === "string" ? session.payment_intent : session.id;
  const r = await applyInvoicePayment(invoiceId, new Date().toISOString().slice(0, 10), `Card ${ref}`, null);
  if (!r.ok) console.log("[payments] invoice not updated:", invoiceId, r.reason);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") return Response.json({ received: true, ignored: "invalid env" });
        const env: StripeEnv = rawEnv;
        try {
          const event = await verifyWebhook(request, env);
          const obj = event.data.object;
          const s = await import("@/lib/subscriptions.server");
          switch (event.type) {
            case "checkout.session.completed":
            case "checkout.session.async_payment_succeeded":
              await settle(obj, env); break;
            case "invoice.paid": await s.onStripeInvoicePaid(obj, env); break;
            case "invoice.payment_failed": await s.onStripeInvoiceFailed(obj); break;
            case "customer.subscription.updated": await s.onSubscriptionUpdated(obj); break;
            case "customer.subscription.deleted": await s.onSubscriptionDeleted(obj); break;
            default: break;
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
