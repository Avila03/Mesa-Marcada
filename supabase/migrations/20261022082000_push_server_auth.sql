-- Mesma autorização dos anfitriões, acrescida de segredo exclusivo do backend.
-- O banco armazena apenas SHA256 do segredo; a chave nunca entra no GitHub.
CREATE TABLE IF NOT EXISTS app_private.push_server_auth(secret_hash text PRIMARY KEY);
REVOKE ALL ON app_private.push_server_auth FROM PUBLIC,anon,authenticated;
INSERT INTO app_private.push_server_auth(secret_hash)
VALUES('ff329278c3b03a1204ec93cb61fd7518cac4674c47aa2df162aed6e780263a60')
ON CONFLICT DO NOTHING;
DROP FUNCTION IF EXISTS public.claim_event_push_targets(uuid,text);
CREATE OR REPLACE FUNCTION public.claim_event_push_targets(p_event_id uuid,p_kind text,p_server_secret text)
RETURNS TABLE(endpoint text,p256dh text,auth_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=(SELECT auth.uid());
 old_time timestamptz;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF p_server_secret IS NULL OR length(p_server_secret)<40 OR
 NOT EXISTS(SELECT 1 FROM app_private.push_server_auth a
  WHERE a.secret_hash=encode(extensions.digest(p_server_secret,'sha256'),'hex'))
 THEN RAISE EXCEPTION 'Entrega não autorizada'; END IF;
 IF p_kind NOT IN ('poll','live','summary')
 THEN RAISE EXCEPTION 'Notificação não autorizada'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sessions s
  WHERE s.id=p_event_id AND NOT app_private.is_event_hidden(s.id)
  AND (s.organizer_id=actor OR app_private.is_app_admin())
 ) THEN RAISE EXCEPTION 'Somente o anfitrião pode enviar avisos'; END IF;
 INSERT INTO app_private.push_notice_cooldowns(session_id,actor_id,kind,sent_at)
 VALUES(p_event_id,actor,p_kind,now())
 ON CONFLICT(session_id,actor_id,kind) DO UPDATE
 SET sent_at=excluded.sent_at
 WHERE app_private.push_notice_cooldowns.sent_at <now()-interval '30 seconds';
 IF NOT FOUND THEN RAISE EXCEPTION 'Espere alguns segundos para enviar outro aviso'; END IF;
 RETURN QUERY
 SELECT p.endpoint,p.p256dh,p.auth_key FROM public.push_subscriptions p
 WHERE p.user_id<>actor
 AND p.user_id IN(
   SELECT a.user_id FROM public.session_attendance a WHERE a.session_id=p_event_id
   UNION SELECT m.user_id FROM public.event_invite_members m WHERE m.session_id=p_event_id
 )
 LIMIT 200;
END; $$;

REVOKE ALL ON FUNCTION public.claim_event_push_targets(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_event_push_targets(uuid,text,text) TO authenticated;
