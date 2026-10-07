CREATE TABLE public.tgn_mission_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL,
  workstream text NOT NULL CHECK (workstream IN ('A','B','C','D')),
  title text NOT NULL,
  summary text NOT NULL,
  location text,
  commitment text,
  contact_email text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','closed')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tgn_mission_listings TO authenticated;
GRANT SELECT ON public.tgn_mission_listings TO anon;
GRANT ALL ON public.tgn_mission_listings TO service_role;
ALTER TABLE public.tgn_mission_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved listings are public" ON public.tgn_mission_listings FOR SELECT TO anon, authenticated USING (status = 'approved');
CREATE POLICY "Company members read own listings" ON public.tgn_mission_listings FOR SELECT TO authenticated USING (public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Company members submit pending listings" ON public.tgn_mission_listings FOR INSERT TO authenticated WITH CHECK (submitted_by = auth.uid() AND status = 'pending' AND reviewed_by IS NULL AND public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Company members withdraw pending listings" ON public.tgn_mission_listings FOR DELETE TO authenticated USING (status = 'pending' AND public.is_company_member(company_id, auth.uid()));
CREATE POLICY "Admins manage listings" ON public.tgn_mission_listings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_tgn_mission_listings_updated BEFORE UPDATE ON public.tgn_mission_listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();