ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS markets text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS availability_hours integer,
  ADD COLUMN IF NOT EXISTS show_in_directory boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_phone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_linkedin boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_program_updates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_newsletter boolean NOT NULL DEFAULT false;

CREATE TABLE public.account_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  detail text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_audit TO authenticated;
GRANT ALL ON public.account_audit TO service_role;
ALTER TABLE public.account_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own account audit" ON public.account_audit FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read account audit" ON public.account_audit FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','declined')),
  handled_by uuid,
  handled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT UPDATE ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deletion requests" ON public.account_deletion_requests FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read deletion requests" ON public.account_deletion_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update deletion requests" ON public.account_deletion_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));