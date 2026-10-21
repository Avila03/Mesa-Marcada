-- Mesa Marcada v1.1: fotos dos perfis em Storage privado.
-- Cada conta pode enviar e excluir apenas arquivos da própria pasta.
ALTER TABLE public.profiles ADD COLUMN avatar_path text;
ALTER TABLE public.profiles
  ADD CONSTRAINT profile_avatar_self_folder CHECK (
    avatar_path IS NULL OR (
      avatar_path LIKE id::text || '/avatar-%'
      AND avatar_path ~ '^[-0-9a-f]{36}/avatar-[-0-9a-f]{36}\.(webp|jpg|png)$'
    )
  );

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('player-avatars','player-avatars',false,2097152,ARRAY['image/webp','image/jpeg','image/png'])
ON CONFLICT(id) DO NOTHING;

CREATE POLICY "mm_avatar_read_signed" ON storage.objects
FOR SELECT TO authenticated
USING(
  bucket_id='player-avatars'
  AND (
    split_part(name,'/',1)=(SELECT auth.uid())::text
    OR EXISTS(SELECT 1 FROM public.profiles p WHERE p.avatar_path=name)
  )
);
CREATE POLICY "mm_avatar_insert_self" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK(
  bucket_id='player-avatars'
  AND split_part(name,'/',1)=(SELECT auth.uid())::text
  AND name ~ '^[-0-9a-f]{36}/avatar-[-0-9a-f]{36}\.(webp|jpg|png)$'
);
CREATE POLICY "mm_avatar_delete_self" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id='player-avatars'
  AND split_part(name,'/',1)=(SELECT auth.uid())::text
);
