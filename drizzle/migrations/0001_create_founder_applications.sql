CREATE TABLE public.founder_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  full_name text NOT NULL,
  email text NOT NULL,
  linkedin_url text,
  company_name text NOT NULL,
  website text,
  country text NOT NULL,
  sector text NOT NULL,
  stage text NOT NULL,
  needs text[] NOT NULL,
  challenge text NOT NULL,
  consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT founder_applications_consent CHECK (consent = true),
  CONSTRAINT founder_applications_challenge_length CHECK (char_length(challenge) <= 1000)
);
GRANT SELECT ON public.founder_applications TO authenticated;
GRANT ALL ON public.founder_applications TO service_role;
ALTER TABLE public.founder_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read founder applications" ON public.founder_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX founder_applications_email_created_idx ON public.founder_applications (email, created_at DESC);