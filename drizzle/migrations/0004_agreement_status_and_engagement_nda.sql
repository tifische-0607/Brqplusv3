ALTER TABLE public.agreement_versions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','final'));
ALTER TABLE public.agreement_versions ADD COLUMN IF NOT EXISTS doc_type text NOT NULL DEFAULT 'membership_agreement' CHECK (doc_type IN ('membership_agreement','engagement_nda'));
ALTER TABLE public.agreement_versions ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
ALTER TABLE public.agreement_versions ADD COLUMN IF NOT EXISTS finalized_by uuid;
DROP INDEX IF EXISTS public.agreement_versions_one_current;
CREATE UNIQUE INDEX agreement_versions_one_current_per_type ON public.agreement_versions (doc_type) WHERE is_current;

ALTER TABLE public.agreement_signatures ADD COLUMN IF NOT EXISTS agreement_status_at_signing text NOT NULL DEFAULT 'draft';

CREATE TABLE public.engagement_ndas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  agreement_version_id uuid NOT NULL REFERENCES public.agreement_versions(id),
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','executed')),
  executed_at timestamptz,
  executed_pdf_path text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX engagement_ndas_one_per_mission ON public.engagement_ndas (mission_id);
GRANT SELECT ON public.engagement_ndas TO authenticated;
GRANT ALL ON public.engagement_ndas TO service_role;
ALTER TABLE public.engagement_ndas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read NDAs" ON public.engagement_ndas FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.engagement_nda_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nda_id uuid NOT NULL REFERENCES public.engagement_ndas(id) ON DELETE CASCADE,
  party_kind text NOT NULL CHECK (party_kind IN ('member','customer','facilitator','external')),
  user_id uuid,
  company_id uuid REFERENCES public.companies(id),
  name text NOT NULL,
  email text,
  company_name text,
  country text,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','signed')),
  sign_token uuid,
  token_expires_at timestamptz,
  token_used_at timestamptz,
  signed_by_user_id uuid,
  signed_name text,
  signed_title text,
  signature_image_path text,
  signed_at timestamptz,
  ip_address text,
  user_agent text,
  text_sha256 text,
  agreement_status_at_signing text,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX engagement_nda_parties_token ON public.engagement_nda_parties (sign_token) WHERE sign_token IS NOT NULL;
CREATE INDEX engagement_nda_parties_nda_idx ON public.engagement_nda_parties (nda_id);
CREATE INDEX engagement_nda_parties_user_idx ON public.engagement_nda_parties (user_id);
CREATE INDEX engagement_nda_parties_company_idx ON public.engagement_nda_parties (company_id);
GRANT SELECT ON public.engagement_nda_parties TO authenticated;
GRANT ALL ON public.engagement_nda_parties TO service_role;
ALTER TABLE public.engagement_nda_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read NDA parties" ON public.engagement_nda_parties FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own NDA party rows" ON public.engagement_nda_parties FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.guard_nda_party_signed()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'signed' THEN RAISE EXCEPTION 'Signed NDA parties are immutable'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.status = 'signed' THEN
    IF (to_jsonb(NEW) - 'pdf_path') <> (to_jsonb(OLD) - 'pdf_path') OR (OLD.pdf_path IS NOT NULL AND NEW.pdf_path IS DISTINCT FROM OLD.pdf_path) THEN
      RAISE EXCEPTION 'Signed NDA parties are immutable';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_nda_party_immutable BEFORE UPDATE OR DELETE ON public.engagement_nda_parties
FOR EACH ROW EXECUTE FUNCTION public.guard_nda_party_signed();