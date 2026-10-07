CREATE TABLE public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_type text NOT NULL CHECK (member_type IN ('personal','corporate')),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  monthly_price_myr numeric(12,2) NOT NULL DEFAULT 0,
  annual_price_myr numeric(12,2) NOT NULL DEFAULT 0,
  max_users integer,
  benefits text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_draft boolean NOT NULL DEFAULT true,
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.membership_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.membership_plans TO authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active plans" ON public.membership_plans FOR SELECT TO anon, authenticated USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage plans" ON public.membership_plans FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_membership_plans_updated BEFORE UPDATE ON public.membership_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.membership_applications
  ADD COLUMN plan_id uuid REFERENCES public.membership_plans(id),
  ADD COLUMN billing_cycle text CHECK (billing_cycle IN ('monthly','annual')),
  ADD COLUMN quoted_price_myr numeric(12,2);

CREATE TABLE public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.membership_applications(id),
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  price_myr numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment','active','payment_overdue','cancelled')),
  current_period_start date,
  current_period_end date,
  next_invoice_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR company_id IS NOT NULL)
);
CREATE INDEX memberships_user_idx ON public.memberships(user_id);
CREATE INDEX memberships_company_idx ON public.memberships(company_id);
GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or company membership readable" ON public.memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (company_id IS NOT NULL AND public.is_company_member(company_id, auth.uid())) OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_memberships_updated BEFORE UPDATE ON public.memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE SEQUENCE public.membership_invoice_seq;
GRANT USAGE ON SEQUENCE public.membership_invoice_seq TO service_role;

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  user_id uuid,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  billing_cycle text NOT NULL,
  period_start date,
  period_end date,
  amount_myr numeric(12,2) NOT NULL,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  total_myr numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','paid','void','overdue')),
  issued_at date NOT NULL DEFAULT current_date,
  due_at date NOT NULL DEFAULT (current_date + 14),
  paid_at date,
  payment_reference text,
  notes text,
  pdf_path text,
  draft_pricing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_membership_idx ON public.invoices(membership_id);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own or company admin invoices readable" ON public.invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (company_id IS NOT NULL AND public.is_company_admin(company_id, auth.uid())) OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.plan_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id uuid NOT NULL REFERENCES public.memberships(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_plan_id uuid REFERENCES public.membership_plans(id),
  requested_cycle text CHECK (requested_cycle IN ('monthly','annual')),
  note text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','completed','declined')),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_change_requests TO authenticated;
GRANT ALL ON public.plan_change_requests TO service_role;
ALTER TABLE public.plan_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own plan change requests readable" ON public.plan_change_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.next_membership_invoice_number()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'BRQ-INV-' || to_char(current_date,'YYYY') || '-' || lpad(nextval('public.membership_invoice_seq')::text, 4, '0');
$$;
REVOKE EXECUTE ON FUNCTION public.next_membership_invoice_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.next_membership_invoice_number() TO service_role;

-- Renewal + overdue housekeeping (run on admin load)
CREATE OR REPLACE FUNCTION public.billing_housekeeping(_tax_rate numeric DEFAULT 0)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; n integer := 0; p_end date;
BEGIN
  UPDATE public.invoices SET status = 'overdue' WHERE status = 'issued' AND due_at < current_date;
  UPDATE public.memberships ms SET status = 'payment_overdue'
   WHERE ms.status IN ('active','awaiting_payment')
     AND EXISTS (SELECT 1 FROM public.invoices i WHERE i.membership_id = ms.id AND i.status = 'overdue' AND i.due_at < current_date - 30);
  FOR m IN
    SELECT ms.*, pl.is_draft FROM public.memberships ms JOIN public.membership_plans pl ON pl.id = ms.plan_id
     WHERE ms.status IN ('active','payment_overdue') AND ms.next_invoice_date IS NOT NULL
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
END; $$;
REVOKE EXECUTE ON FUNCTION public.billing_housekeeping(numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_housekeeping(numeric) TO service_role;