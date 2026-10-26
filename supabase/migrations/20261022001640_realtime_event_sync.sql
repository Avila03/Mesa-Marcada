-- Realtime do Mesa Marcada: replica apenas mudanças em tabelas protegidas por RLS.
-- A leitura de dados pessoais e financeiros continua sujeita às mesmas policies.
-- As inscrições são atualizadas pelo websocket, com reconciliação na aplicação.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['sessions','session_attendance','session_table_seats','session_polls','session_poll_options','session_poll_votes','session_expenses','expense_split_members','expense_split_settlements','session_chip_purchases','session_chip_purchase_items','session_chip_cashouts','session_chip_results','session_live_state','admin_hidden_events','profiles'] LOOP
  IF NOT EXISTS(
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
  ) THEN
    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',t);
  END IF;
 END LOOP;
END $$;
