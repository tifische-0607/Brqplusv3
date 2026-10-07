ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
CREATE POLICY "Members upload own avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'executive-avatars' AND (storage.foldername(name))[1] = 'members' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Members update own avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'executive-avatars' AND (storage.foldername(name))[1] = 'members' AND (storage.foldername(name))[2] = auth.uid()::text);
CREATE POLICY "Members read own avatar" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'executive-avatars' AND (storage.foldername(name))[1] = 'members' AND (storage.foldername(name))[2] = auth.uid()::text);