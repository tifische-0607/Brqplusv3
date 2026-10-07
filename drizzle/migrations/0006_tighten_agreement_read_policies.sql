DROP POLICY IF EXISTS "Authenticated can read agreements" ON public.legal_agreements;
CREATE POLICY "Members read active agreements; admins read all" ON public.legal_agreements
FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Signed-in users read agreement versions" ON public.agreement_versions;
CREATE POLICY "Members read current or own signed versions; admins all" ON public.agreement_versions
FOR SELECT TO authenticated
USING (
  is_current
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (SELECT 1 FROM public.agreement_signatures s WHERE s.agreement_version_id = agreement_versions.id AND s.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.engagement_ndas n JOIN public.engagement_nda_parties p ON p.nda_id = n.id
             WHERE n.agreement_version_id = agreement_versions.id AND p.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Authenticated users can read legal agreement files" ON storage.objects;
CREATE POLICY "Admins read legal agreement files" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'legal-agreements' AND public.has_role(auth.uid(), 'admin'::app_role));