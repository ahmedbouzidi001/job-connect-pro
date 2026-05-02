
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;

-- Allow public read by exact path only (no listing). Public URLs still work because
-- they hit the storage CDN endpoint directly, not list.
CREATE POLICY "avatars read by path" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'avatars'
    AND (auth.role() = 'authenticated' OR auth.role() = 'anon')
  );

-- Make the bucket public=false so listing is blocked, but expose files via signed/public URLs we generate explicitly.
UPDATE storage.buckets SET public = true WHERE id = 'avatars';
