-- Evento ao Vivo: sincronização imediata da linha do tempo; RLS continua privada.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables
   WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='session_live_activity')
 THEN
   ALTER PUBLICATION supabase_realtime ADD TABLE public.session_live_activity;
 END IF;
END $$;
