-- Anúncio de nova noite pública, autorizado apenas ao organizador
-- e a partir do backend com segredo não exposto ao navegador.
CREATE TABLE IF NOT EXISTS app_private.push_club_notice_cooldown(
 actor_id uuid PRIMARY KEY REFERENCES auth.users(id),
 sent_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_private.push_club_notice_cooldown FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.claim_new_event_push_targets(
 p_event_id uuid,p_server_secret text)
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
   WHERE s.id=p_event_id AND s.organizer_id=actor AND s.visibility='public'
     AND s.status='scheduled' AND s.created_at>now()-interval '10 minutes'
     AND NOT app_private.is_event_hidden(s.id))
 THEN RAISE EXCEPTION 'Apenas novos eventos públicos podem ser anunciados'; END IF;
 INSERT INTO app_private.push_club_notice_cooldown(actor_id,sent_at)
 VALUES(actor,now())
 ON CONFLICT(actor_id) DO UPDATE SET sent_at=excluded.sent_at
 WHERE app_private.push_club_notice_cooldown.sent_at<now()-interval '1 hour';
 IF NOT FOUND THEN RAISE EXCEPTION 'Limite de anúncios por hora atingido'; END IF;
 RETURN QUERY SELECT p.endpoint,p.p256dh,p.auth_key
 FROM public.push_subscriptions p WHERE p.user_id<>actor LIMIT 200;
END; $$;
REVOKE ALL ON FUNCTION public.claim_new_event_push_targets(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_new_event_push_targets(uuid,text) TO authenticated;
