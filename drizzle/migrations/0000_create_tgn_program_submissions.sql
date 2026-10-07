CREATE TABLE public.tgn_interests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 reference text NOT NULL UNIQUE,
 full_name text NOT NULL, email text NOT NULL, linkedin_url text, phone text,
 models text[] NOT NULL, expertise text[] NOT NULL, expertise_other text,
 hours_available text NOT NULL, geographies text[] NOT NULL, geography_other text,
 career_stage text, referral_source text, source text,
 consent boolean NOT NULL, updates_opt_in boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.tgn_interests TO authenticated;
GRANT ALL ON public.tgn_interests TO service_role;
ALTER TABLE public.tgn_interests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view TGN interests" ON public.tgn_interests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update TGN interests" ON public.tgn_interests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete TGN interests" ON public.tgn_interests FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX tgn_interests_email_created_idx ON public.tgn_interests (email, created_at DESC);

CREATE TABLE public.tgn_rsvps (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 full_name text NOT NULL, email text NOT NULL, organisation text,
 attending_as text NOT NULL, country text, dietary_notes text,
 consent boolean NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.tgn_rsvps TO authenticated;
GRANT ALL ON public.tgn_rsvps TO service_role;
ALTER TABLE public.tgn_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view TGN RSVPs" ON public.tgn_rsvps FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update TGN RSVPs" ON public.tgn_rsvps FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete TGN RSVPs" ON public.tgn_rsvps FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX tgn_rsvps_email_created_idx ON public.tgn_rsvps (email, created_at DESC);