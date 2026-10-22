-- Push subscriptions: cada jogador controla exclusivamente seus próprios aparelhos.
CREATE TABLE IF NOT EXISTS public.push_subscriptions(
 endpoint text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 p256dh text NOT NULL,
 auth_key text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions(user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.push_subscriptions TO authenticated;
CREATE POLICY push_subscriptions_self_read ON public.push_subscriptions FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscriptions_self_insert ON public.push_subscriptions FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscriptions_self_update ON public.push_subscriptions FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
CREATE POLICY push_subscriptions_self_delete ON public.push_subscriptions FOR DELETE TO authenticated
 USING(user_id=(SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS app_private.push_notice_cooldowns(
 session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(session_id,actor_id,kind)
);
REVOKE ALL ON app_private.push_notice_cooldowns FROM PUBLIC,anon,authenticated;

-- Retorna destinos apenas após autenticação, autorização e limite de frequência.
-- Uso exclusivo no servidor. Nenhuma operação de envio pode ser feita sem JWT.
CREATE OR REPLACE FUNCTION public.claim_event_push_targets(p_event_id uuid,p_kind text)
RETURNS TABLE(endpoint text,p256dh text,auth_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 actor uuid:=(SELECT auth.uid());
 old_time timestamptz;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
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
REVOKE ALL ON FUNCTION public.claim_event_push_targets(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_event_push_targets(uuid,text) TO authenticated;
