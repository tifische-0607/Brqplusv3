CREATE TABLE public.agreement_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'BRQ+ Membership Agreement',
  body_markdown text NOT NULL,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  is_current boolean NOT NULL DEFAULT false,
  requires_resign boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX agreement_versions_one_current ON public.agreement_versions ((is_current)) WHERE is_current;
GRANT SELECT ON public.agreement_versions TO anon;
GRANT SELECT, INSERT, UPDATE ON public.agreement_versions TO authenticated;
GRANT ALL ON public.agreement_versions TO service_role;
ALTER TABLE public.agreement_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads current agreement" ON public.agreement_versions FOR SELECT TO anon USING (is_current);
CREATE POLICY "Signed-in users read agreement versions" ON public.agreement_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert agreement versions" ON public.agreement_versions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update agreement versions" ON public.agreement_versions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.agreement_versions (version, title, body_markdown, is_current)
VALUES ('1.0 (Draft)', 'BRQ+ Membership Agreement', 'BRQ+ Membership Agreement — draft text to be inserted by an admin.', true);

CREATE TABLE public.agreement_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id),
  signer_type text NOT NULL CHECK (signer_type IN ('personal','company_admin','company_user')),
  agreement_version_id uuid NOT NULL REFERENCES public.agreement_versions(id),
  agreement_text_sha256 text NOT NULL,
  signed_name text NOT NULL,
  signed_title text,
  signature_image_path text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agreement_signatures_user_idx ON public.agreement_signatures (user_id);
CREATE INDEX agreement_signatures_company_idx ON public.agreement_signatures (company_id);
CREATE INDEX agreement_signatures_version_idx ON public.agreement_signatures (agreement_version_id);
GRANT SELECT ON public.agreement_signatures TO authenticated;
GRANT ALL ON public.agreement_signatures TO service_role;
ALTER TABLE public.agreement_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own signatures" ON public.agreement_signatures FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Company admins read company signatures" ON public.agreement_signatures FOR SELECT TO authenticated USING (company_id IS NOT NULL AND public.is_company_admin(company_id, auth.uid()));
CREATE POLICY "Admins read all signatures" ON public.agreement_signatures FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_signature_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND current_setting('brq.signature_pdf', true) = 'on'
     AND OLD.pdf_path IS NULL
     AND (to_jsonb(NEW) - 'pdf_path') = (to_jsonb(OLD) - 'pdf_path') THEN
    RETURN NEW;
  END IF;
  IF current_setting('brq.signature_override', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'Agreement signatures are immutable';
END; $$;
CREATE TRIGGER trg_agreement_signatures_immutable BEFORE UPDATE OR DELETE ON public.agreement_signatures
FOR EACH ROW EXECUTE FUNCTION public.guard_signature_immutable();

CREATE OR REPLACE FUNCTION public.set_signature_pdf_path(_signature_id uuid, _pdf_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM set_config('brq.signature_pdf', 'on', true);
  UPDATE public.agreement_signatures SET pdf_path = _pdf_path WHERE id = _signature_id AND pdf_path IS NULL;
END; $$;
REVOKE ALL ON FUNCTION public.set_signature_pdf_path(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_signature_pdf_path(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.admin_void_signature(_signature_id uuid, _actor uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM public.agreement_signatures WHERE id = _signature_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Signature not found'; END IF;
  PERFORM set_config('brq.signature_override', 'on', true);
  DELETE FROM public.agreement_signatures WHERE id = _signature_id;
  INSERT INTO public.application_review_audit (action, actor_user_id, subject_user_id, subject_company_id, reason)
  VALUES ('agreement_signature_voided', _actor, s.user_id, s.company_id, COALESCE(_reason, '') || ' (signature ' || _signature_id || ')');
END; $$;
REVOKE ALL ON FUNCTION public.admin_void_signature(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_void_signature(uuid, uuid, text) TO service_role;