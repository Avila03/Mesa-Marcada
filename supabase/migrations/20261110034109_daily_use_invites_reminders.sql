-- v7.5 · Uso diário
-- 1) "Marcar de novo": o anfitrião de um novo encontro convida, de uma vez,
--    quem jogou a noite de origem e pode avisá-los por push uma única vez.
-- 2) Lembrete 2 horas antes para quem confirmou presença, entregue pelo
--    backend com o segredo do servidor e sem repetição por pessoa/encontro.

CREATE OR REPLACE FUNCTION public.invite_previous_players(p_event_id uuid,p_source_event_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid()); invited integer:=0;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s
   WHERE s.id=p_event_id AND s.organizer_id=actor AND s.status='scheduled'
     AND s.created_at>now()-interval '1 day' AND NOT app_private.is_event_hidden(s.id))
 THEN RAISE EXCEPTION 'Apenas o anfitrião de um encontro recém-criado pode convidar'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s
   WHERE s.id=p_source_event_id AND s.status='finished'
     AND (s.organizer_id=actor OR EXISTS(SELECT 1 FROM public.session_attendance a
          WHERE a.session_id=s.id AND a.user_id=actor)))
 THEN RAISE EXCEPTION 'A noite de origem não está disponível para você'; END IF;
 INSERT INTO public.event_invite_members(session_id,user_id)
 SELECT p_event_id,a.user_id FROM public.session_attendance a
 WHERE a.session_id=p_source_event_id AND a.user_id<>actor
 ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS invited=ROW_COUNT;
 RETURN invited;
END; $$;
REVOKE ALL ON FUNCTION public.invite_previous_players(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.invite_previous_players(uuid,uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS app_private.invite_push_receipts(
 session_id uuid PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
 sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE app_private.invite_push_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.invite_push_receipts FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_invited_push_targets(p_event_id uuid,p_server_secret text)
RETURNS TABLE(endpoint text,p256dh text,auth_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid:=(SELECT auth.uid());
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF p_server_secret IS NULL OR length(p_server_secret)<40 OR NOT EXISTS(
  SELECT 1 FROM app_private.push_server_auth k
  WHERE k.secret_hash=encode(extensions.digest(p_server_secret,'sha256'),'hex'))
 THEN RAISE EXCEPTION 'Entrega não autorizada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s
   WHERE s.id=p_event_id AND s.organizer_id=actor AND s.status='scheduled'
     AND s.created_at>now()-interval '10 minutes' AND NOT app_private.is_event_hidden(s.id))
 THEN RAISE EXCEPTION 'Apenas novos encontros podem avisar os convidados'; END IF;
 INSERT INTO app_private.invite_push_receipts(session_id) VALUES(p_event_id) ON CONFLICT DO NOTHING;
 IF NOT FOUND THEN RAISE EXCEPTION 'Os convidados já foram avisados'; END IF;
 RETURN QUERY SELECT p.endpoint,p.p256dh,p.auth_key
 FROM public.push_subscriptions p
 JOIN public.event_invite_members m ON m.user_id=p.user_id AND m.session_id=p_event_id
 WHERE p.user_id<>actor LIMIT 200;
END; $$;
REVOKE ALL ON FUNCTION public.claim_invited_push_targets(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_invited_push_targets(uuid,text) TO authenticated;

CREATE TABLE IF NOT EXISTS app_private.event_reminder_receipts(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 sent_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,user_id)
);
CREATE INDEX IF NOT EXISTS event_reminder_receipts_user_idx ON app_private.event_reminder_receipts(user_id);
ALTER TABLE app_private.event_reminder_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.event_reminder_receipts FROM PUBLIC,anon,authenticated;

-- Chamada periódica pelo backend (sem sessão de usuário). Cada pessoa recebe
-- no máximo um lembrete por encontro, entre 2h e 1h30 antes do início.
CREATE OR REPLACE FUNCTION public.claim_reminder_push_targets(p_server_secret text)
RETURNS TABLE(endpoint text,p256dh text,auth_key text,session_id uuid,title text,starts_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_server_secret IS NULL OR length(p_server_secret)<40 OR NOT EXISTS(
  SELECT 1 FROM app_private.push_server_auth k
  WHERE k.secret_hash=encode(extensions.digest(p_server_secret,'sha256'),'hex'))
 THEN RAISE EXCEPTION 'Entrega não autorizada'; END IF;
 RETURN QUERY
 WITH due AS(
  SELECT s.id,s.title,s.starts_at FROM public.sessions s
  WHERE s.status='scheduled'
    AND s.starts_at>now()+interval '90 minutes' AND s.starts_at<=now()+interval '2 hours'
    AND NOT app_private.is_event_hidden(s.id)
    AND NOT EXISTS(SELECT 1 FROM public.session_live_state l WHERE l.session_id=s.id)
 ),fresh AS(
  INSERT INTO app_private.event_reminder_receipts(session_id,user_id)
  SELECT d.id,a.user_id FROM due d JOIN public.session_attendance a ON a.session_id=d.id
  ON CONFLICT DO NOTHING
  RETURNING event_reminder_receipts.session_id AS sid,event_reminder_receipts.user_id AS uid
 )
 SELECT p.endpoint,p.p256dh,p.auth_key,d.id,d.title,d.starts_at
 FROM fresh f JOIN due d ON d.id=f.sid JOIN public.push_subscriptions p ON p.user_id=f.uid
 LIMIT 500;
END; $$;
REVOKE ALL ON FUNCTION public.claim_reminder_push_targets(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_reminder_push_targets(text) TO anon,authenticated;
