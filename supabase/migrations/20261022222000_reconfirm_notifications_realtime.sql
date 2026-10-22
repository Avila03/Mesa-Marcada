-- Enable protected realtime updates for the unified notification center.
-- Each table has per-user RLS: no unrestricted stream of user messages.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='event_change_notices') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_change_notices;
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
 WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='event_reconfirmations') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.event_reconfirmations;
 END IF;
END; $$;
