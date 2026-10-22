-- League approval notifications via RLS-aware Realtime.
DO $$
DECLARE item text;
BEGIN
 FOREACH item IN ARRAY ARRAY['leagues','league_members','league_requests'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=item) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',item);
  END IF;
 END LOOP;
END $$;
