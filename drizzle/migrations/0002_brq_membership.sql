
-- Profiles: personal dossier fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS member_type text,
  ADD COLUMN IF NOT EXISTS membership_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS membership_since timestamptz,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS organisation text,
  ADD COLUMN IF NOT EXISTS expertise text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS years_experience integer,
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS program_interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS collective_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS company_id uuid,
  ADD COLUMN IF NOT EXISTS company_role text;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_member_type_chk CHECK (member_type IS NULL OR member_type IN ('personal'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_membership_status_chk CHECK (membership_status IN ('pending','active','suspended'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_collective_status_chk CHECK (collective_status IN ('none','applied','approved'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_role_chk CHECK (company_role IS NULL OR company_role IN ('admin','member'));

-- Existing onboarded members are considered active
UPDATE public.profiles SET membership_status = 'active', membership_since = COALESCE(agreement_signed_at, created_at) WHERE is_onboarded = true;

-- Companies
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL,
  trading_name text,
  registration_no text,
  country text,
  hq_city text,
  website text,
  sector text,
  size_band text,
  year_founded integer,
  description text,
  markets text[] NOT NULL DEFAULT '{}',
  interests text[] NOT NULL DEFAULT '{}',
  billing_contact_name text,
  billing_contact_email text,
  membership_status text NOT NULL DEFAULT 'active' CHECK (membership_status IN ('pending','active','suspended')),
  membership_since timestamptz DEFAULT now(),
  logo_path text,
  application_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_company_fk FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE TABLE public.company_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);
GRANT SELECT ON public.company_members TO authenticated;
GRANT ALL ON public.company_members TO service_role;

CREATE OR REPLACE FUNCTION public.is_company_member(_company_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company_id AND user_id = _user_id)
$$;
CREATE OR REPLACE FUNCTION public.is_company_admin(_company_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.company_members WHERE company_id = _company_id AND user_id = _user_id AND role = 'admin')
$$;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read company" ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Company admins update company" ON public.companies FOR UPDATE TO authenticated
  USING (public.is_company_admin(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_company_admin(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company members read roster" ON public.company_members FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

-- Company admins cannot change status fields on their company
CREATE OR REPLACE FUNCTION public.guard_company_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.membership_status := OLD.membership_status;
    NEW.membership_since := OLD.membership_since;
    NEW.application_id := OLD.application_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_companies_guard BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.guard_company_status();
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Members cannot change their own membership/role fields
CREATE OR REPLACE FUNCTION public.guard_profile_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.member_type := OLD.member_type;
    NEW.membership_status := OLD.membership_status;
    NEW.membership_since := OLD.membership_since;
    NEW.collective_status := OLD.collective_status;
    NEW.company_id := OLD.company_id;
    NEW.company_role := OLD.company_role;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_profiles_membership_guard BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.guard_profile_membership();

-- Membership applications
CREATE TABLE public.membership_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('personal','corporate')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','withdrawn')),
  reference text NOT NULL UNIQUE,
  email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  wants_collective boolean NOT NULL DEFAULT false,
  approved_as_collective boolean NOT NULL DEFAULT false,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  approved_user_id uuid,
  approved_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX membership_applications_email_idx ON public.membership_applications (email, created_at);
GRANT SELECT, UPDATE ON public.membership_applications TO authenticated;
GRANT ALL ON public.membership_applications TO service_role;
ALTER TABLE public.membership_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read membership applications" ON public.membership_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update membership applications" ON public.membership_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.companies ADD CONSTRAINT companies_application_fk FOREIGN KEY (application_id) REFERENCES public.membership_applications(id) ON DELETE SET NULL;

-- Admin notes
CREATE TABLE public.member_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type text NOT NULL CHECK (subject_type IN ('user','company')),
  subject_id uuid NOT NULL,
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 4000),
  author_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX member_notes_subject_idx ON public.member_notes (subject_type, subject_id);
GRANT SELECT, INSERT, DELETE ON public.member_notes TO authenticated;
GRANT ALL ON public.member_notes TO service_role;
ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read notes" ON public.member_notes FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add notes" ON public.member_notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND author_id = auth.uid());
CREATE POLICY "Admins delete notes" ON public.member_notes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Extend existing audit log to cover membership decisions
ALTER TABLE public.application_review_audit
  ADD COLUMN IF NOT EXISTS membership_application_id uuid REFERENCES public.membership_applications(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_user_id uuid,
  ADD COLUMN IF NOT EXISTS subject_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Company logos: private bucket path convention "<company_id>/..."
CREATE POLICY "Company members read logos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-logos' AND (public.is_company_member(((storage.foldername(name))[1])::uuid, auth.uid()) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Company admins upload logos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND (public.is_company_admin(((storage.foldername(name))[1])::uuid, auth.uid()) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Company admins update logos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND (public.is_company_admin(((storage.foldername(name))[1])::uuid, auth.uid()) OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "Company admins delete logos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-logos' AND (public.is_company_admin(((storage.foldername(name))[1])::uuid, auth.uid()) OR public.has_role(auth.uid(), 'admin')));
