ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_environment text,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_past_due_since date;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS stripe_invoice_id text UNIQUE;

CREATE OR REPLACE FUNCTION public.billing_housekeeping(_tax_rate numeric DEFAULT 0)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE m record; n integer := 0; p_end date;
BEGIN
  UPDATE public.invoices SET status = 'overdue' WHERE status = 'issued' AND due_at < current_date;
  UPDATE public.memberships ms SET status = 'payment_overdue'
   WHERE ms.status IN ('active','awaiting_payment')
     AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.membership_id = ms.id AND i.status = 'overdue' AND i.due_at < current_date - 30);
  -- Subscriptions: 30-day grace after a failed renewal, then lapse
  UPDATE public.memberships SET status = 'payment_overdue'
   WHERE stripe_subscription_id IS NOT NULL AND status = 'active'
     AND payment_past_due_since IS NOT NULL AND payment_past_due_since < current_date - 30;
  FOR m IN
    SELECT ms.*, pl.is_draft FROM public.memberships ms JOIN public.membership_plans pl ON pl.id = ms.plan_id
     WHERE ms.status IN ('active','payment_overdue') AND ms.next_invoice_date IS NOT NULL
       AND ms.stripe_subscription_id IS NULL
       AND ms.next_invoice_date - 14 <= current_date
       AND NOT EXISTS (SELECT 1 FROM public.invoices i WHERE i.membership_id = ms.id AND i.period_start = ms.next_invoice_date AND i.status <> 'void')
  LOOP
    p_end := CASE WHEN m.billing_cycle = 'annual' THEN (m.next_invoice_date + interval '1 year')::date ELSE (m.next_invoice_date + interval '1 month')::date END - 1;
    INSERT INTO public.invoices (number, membership_id, user_id, company_id, plan_id, billing_cycle, period_start, period_end, amount_myr, tax_rate, total_myr, due_at, draft_pricing, notes)
    VALUES (public.next_membership_invoice_number(), m.id, m.user_id, m.company_id, m.plan_id, m.billing_cycle, m.next_invoice_date, p_end,
            m.price_myr, _tax_rate, round(m.price_myr * (1 + _tax_rate/100), 2), current_date + 14, m.is_draft, 'Renewal');
    INSERT INTO public.application_review_audit (action, subject_user_id, subject_company_id, reason)
    VALUES ('invoice_issued', m.user_id, m.company_id, 'Renewal invoice auto-issued');
    n := n + 1;
  END LOOP;
  RETURN n;
END; $function$;