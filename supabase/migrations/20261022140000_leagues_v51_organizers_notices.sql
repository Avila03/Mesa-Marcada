-- Mesa Marcada 5.1 · organizers and in-app notifications, isolated by RLS.
ALTER TABLE public.league_members DROP CONSTRAINT IF EXISTS league_members_role_check;
ALTER TABLE public.league_members ADD CONSTRAINT league_members_role_check
  CHECK (role IN ('owner','organizer','member'));

CREATE OR REPLACE FUNCTION app_private.can_organize_league(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.league_members m
 WHERE m.league_id=p_id AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','organizer'));
$$;
REVOKE ALL ON FUNCTION app_private.can_organize_league(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.can_organize_league(uuid) TO authenticated;

DROP POLICY IF EXISTS sessions_insert_league_owner ON public.sessions;
CREATE POLICY sessions_insert_league_organizer ON public.sessions
 FOR INSERT TO authenticated WITH CHECK (
 organizer_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM public.rooms r WHERE r.id=room_id AND r.status='active')
 AND (league_id IS NULL OR app_private.can_organize_league(league_id))
);

CREATE OR REPLACE FUNCTION public.set_league_member_role(p_league_id uuid,p_user_id uuid,p_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app_private.is_league_owner(p_league_id)
 THEN RAISE EXCEPTION 'Somente o dono pode alterar cargos'; END IF;
 IF p_role NOT IN ('organizer','member')
 THEN RAISE EXCEPTION 'Cargo não permitido'; END IF;
 UPDATE public.league_members SET role=p_role
 WHERE league_id=p_league_id AND user_id=p_user_id AND role<>'owner';
 IF NOT FOUND THEN RAISE EXCEPTION 'Participante não encontrado ou cargo protegido'; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.set_league_member_role(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_league_member_role(uuid,uuid,text) TO authenticated;

CREATE TABLE public.league_notifications(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
 recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
 kind text NOT NULL CHECK(kind IN ('join_request','join_approved','join_rejected','role_changed','new_event')),
 event_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX league_notifications_recipient_idx
 ON public.league_notifications(recipient_id,created_at DESC) INCLUDE(read_at,kind);
ALTER TABLE public.league_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.league_notifications FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.league_notifications TO authenticated;
CREATE POLICY league_notifications_own ON public.league_notifications
 FOR SELECT TO authenticated USING(recipient_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.read_league_notification(p_id bigint)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 UPDATE public.league_notifications SET read_at=coalesce(read_at,now())
 WHERE id=p_id AND recipient_id=(SELECT auth.uid());
$$;
REVOKE ALL ON FUNCTION public.read_league_notification(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_league_notification(bigint) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.notify_league_join()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE target_owner uuid;
BEGIN
 SELECT owner_id INTO target_owner FROM public.leagues WHERE id=NEW.league_id;
 IF target_owner IS NULL THEN RETURN NEW; END IF;
 IF NEW.status='pending' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
   INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind)
   VALUES(NEW.league_id,target_owner,NEW.user_id,'join_request');
 ELSIF TG_OP='UPDATE' AND OLD.status='pending' AND NEW.status IN ('approved','rejected') THEN
   INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind)
   VALUES(NEW.league_id,NEW.user_id,target_owner,
    CASE WHEN NEW.status='approved' THEN 'join_approved' ELSE 'join_rejected' END);
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_league_request_notice
 AFTER INSERT OR UPDATE OF status ON public.league_requests
 FOR EACH ROW EXECUTE FUNCTION app_private.notify_league_join();

CREATE OR REPLACE FUNCTION app_private.notify_league_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.role IS DISTINCT FROM OLD.role THEN
  INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind)
  VALUES(NEW.league_id,NEW.user_id,
   (SELECT owner_id FROM public.leagues WHERE id=NEW.league_id),'role_changed');
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_league_role_notice
 AFTER UPDATE OF role ON public.league_members
 FOR EACH ROW EXECUTE FUNCTION app_private.notify_league_role();

CREATE OR REPLACE FUNCTION app_private.notify_league_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.league_id IS NOT NULL THEN
  INSERT INTO public.league_notifications(league_id,recipient_id,actor_id,kind,event_id)
  SELECT NEW.league_id,m.user_id,NEW.organizer_id,'new_event',NEW.id
  FROM public.league_members m
  WHERE m.league_id=NEW.league_id AND m.user_id<>NEW.organizer_id
  LIMIT 250;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_league_event_notice
 AFTER INSERT ON public.sessions FOR EACH ROW EXECUTE FUNCTION app_private.notify_league_event();

CREATE TABLE app_private.league_push_cooldowns(
 league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 kind text NOT NULL,
 sent_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(league_id,user_id,kind)
);
REVOKE ALL ON app_private.league_push_cooldowns FROM PUBLIC,anon,authenticated;

-- Target only the owner after an authentic, recent, still-pending request;
-- tokens remain inaccessible to the browser, and the secret is server-only.
CREATE OR REPLACE FUNCTION public.claim_league_join_push_targets(p_league_id uuid,p_server_secret text)
RETURNS TABLE(endpoint text,p256dh text,auth_key text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=(SELECT auth.uid()); owner_user uuid;
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
 IF p_server_secret IS NULL OR length(p_server_secret)<40 OR
 NOT EXISTS(SELECT 1 FROM app_private.push_server_auth s
 WHERE s.secret_hash=encode(extensions.digest(p_server_secret,'sha256'),'hex'))
 THEN RAISE EXCEPTION 'Entrega não autorizada'; END IF;
 SELECT l.owner_id INTO owner_user FROM public.leagues l
 JOIN public.league_requests r ON r.league_id=l.id
 WHERE l.id=p_league_id AND r.user_id=who AND r.status='pending'
 AND r.created_at>=now()-interval '5 minutes';
 IF owner_user IS NULL THEN RAISE EXCEPTION 'Pedido recente não encontrado'; END IF;
 INSERT INTO app_private.league_push_cooldowns(league_id,user_id,kind,sent_at)
 VALUES(p_league_id,who,'join_request',now())
 ON CONFLICT(league_id,user_id,kind) DO UPDATE SET sent_at=excluded.sent_at
 WHERE app_private.league_push_cooldowns.sent_at<now()-interval '5 minutes';
 IF NOT FOUND THEN RAISE EXCEPTION 'Aviso já enviado'; END IF;
 RETURN QUERY SELECT p.endpoint,p.p256dh,p.auth_key FROM public.push_subscriptions p
 WHERE p.user_id=owner_user LIMIT 6;
END; $$;
REVOKE ALL ON FUNCTION public.claim_league_join_push_targets(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.claim_league_join_push_targets(uuid,text) TO authenticated;

DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE
 pubname='supabase_realtime' AND schemaname='public' AND tablename='league_notifications')
 THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.league_notifications; END IF;
END $$;
