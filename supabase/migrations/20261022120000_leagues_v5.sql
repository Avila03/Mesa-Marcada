
-- Mesa Marcada 5.0 · Ligas: groups, approvals and event data isolation.
CREATE TABLE public.leagues(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 3 AND 65),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 rules text NOT NULL DEFAULT '' CHECK(length(rules)<=2500),
 visibility text NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','private')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leagues_owner_idx ON public.leagues(owner_id);
CREATE TABLE public.league_members(
 league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('owner','member')),
 joined_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(league_id,user_id)
);
CREATE INDEX league_member_user_idx ON public.league_members(user_id);
CREATE TABLE public.league_requests(
 league_id uuid NOT NULL REFERENCES public.leagues(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 created_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 PRIMARY KEY(league_id,user_id)
);
CREATE TABLE public.league_invites(
 league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 created_by uuid NOT NULL REFERENCES auth.users(id)
);
CREATE INDEX league_requests_status_idx ON public.league_requests(league_id,status);
ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.league_invites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.leagues,public.league_members,public.league_requests,public.league_invites FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.leagues,public.league_members,public.league_requests TO authenticated;

CREATE OR REPLACE FUNCTION app_private.is_league_member(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.league_members m
 WHERE m.league_id=p_id AND m.user_id=(SELECT auth.uid()));
$$;
CREATE OR REPLACE FUNCTION app_private.is_league_owner(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
 SELECT 1 FROM public.leagues l WHERE l.id=p_id AND l.owner_id=(SELECT auth.uid()));
$$;
REVOKE ALL ON FUNCTION app_private.is_league_member(uuid),app_private.is_league_owner(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.is_league_member(uuid),app_private.is_league_owner(uuid) TO authenticated;

CREATE POLICY leagues_visible ON public.leagues FOR SELECT TO authenticated USING
 (visibility='public' OR app_private.is_league_member(id) OR owner_id=(SELECT auth.uid()) OR app_private.is_app_admin());
CREATE POLICY league_members_visible ON public.league_members FOR SELECT TO authenticated USING
 (app_private.is_league_member(league_id) OR app_private.is_league_owner(league_id) OR app_private.is_app_admin());
CREATE POLICY league_requests_visible ON public.league_requests FOR SELECT TO authenticated USING
 (user_id=(SELECT auth.uid()) OR app_private.is_league_owner(league_id) OR app_private.is_app_admin());

CREATE OR REPLACE FUNCTION public.create_league(p_name text,p_description text,p_visibility text,p_rules text DEFAULT '')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=(SELECT auth.uid()); league uuid;
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'Faça login para criar uma liga'; END IF;
 IF p_visibility NOT IN ('public','private') OR length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 65
 THEN RAISE EXCEPTION 'Nome ou privacidade inválidos'; END IF;
 IF length(coalesce(p_description,''))>500 OR length(coalesce(p_rules,''))>2500
 THEN RAISE EXCEPTION 'Descrição ou regras muito extensas'; END IF;
 INSERT INTO public.leagues(owner_id,name,description,rules,visibility)
 VALUES(who,trim(p_name),trim(coalesce(p_description,'')),trim(coalesce(p_rules,'')),p_visibility)
 RETURNING id INTO league;
 INSERT INTO public.league_members(league_id,user_id,role) VALUES(league,who,'owner');
 RETURN league;
END; $$;

CREATE OR REPLACE FUNCTION public.update_league(p_league_id uuid,p_name text,p_description text,p_visibility text,p_rules text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app_private.is_league_owner(p_league_id) THEN RAISE EXCEPTION 'Somente o dono pode editar a liga'; END IF;
 IF p_visibility NOT IN ('public','private') OR length(trim(coalesce(p_name,''))) NOT BETWEEN 3 AND 65
 THEN RAISE EXCEPTION 'Nome ou privacidade inválidos'; END IF;
 UPDATE public.leagues SET name=trim(p_name),description=trim(coalesce(p_description,'')),
 rules=trim(coalesce(p_rules,'')),visibility=p_visibility
 WHERE id=p_league_id;
END; $$;

CREATE OR REPLACE FUNCTION public.generate_league_invite(p_league_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text;
BEGIN
 IF NOT app_private.is_league_owner(p_league_id) THEN RAISE EXCEPTION 'Apenas o dono pode gerar convites'; END IF;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 INSERT INTO public.league_invites(league_id,token_hash,created_by)
 VALUES(p_league_id,encode(extensions.digest(token,'sha256'),'hex'),(SELECT auth.uid()))
 ON CONFLICT(league_id) DO UPDATE SET token_hash=excluded.token_hash,
 created_by=excluded.created_by,created_at=now();
 RETURN token;
END; $$;

CREATE OR REPLACE FUNCTION public.preview_league_invite(p_token text)
RETURNS TABLE(league_id uuid,league_name text,description text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.id,l.name,l.description FROM public.league_invites i JOIN public.leagues l ON l.id=i.league_id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND length(coalesce(p_token,''))=64 AND p_token ~ '^[a-f0-9]{64}$'
 AND i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.request_league_join(p_league_id uuid,p_token text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=(SELECT auth.uid()); v_visibility text; v_current public.league_requests%ROWTYPE;
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'Entre na sua conta'; END IF;
 SELECT visibility INTO v_visibility FROM public.leagues WHERE id=p_league_id;
 IF v_visibility IS NULL THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;
 IF EXISTS(SELECT 1 FROM public.league_members WHERE league_id=p_league_id AND user_id=who) THEN RETURN 'member'; END IF;
 IF v_visibility='private' AND NOT EXISTS(
 SELECT 1 FROM public.league_invites i WHERE i.league_id=p_league_id
 AND p_token IS NOT NULL AND length(p_token)=64 AND p_token ~ '^[a-f0-9]{64}$'
 AND i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
 ) THEN RAISE EXCEPTION 'Convite inválido ou expirado'; END IF;
 SELECT * INTO v_current FROM public.league_requests WHERE league_id=p_league_id AND user_id=who;
 IF FOUND AND v_current.status='pending' THEN RETURN 'pending'; END IF;
 IF FOUND AND v_current.created_at>now()-interval '12 hours' AND v_current.status='rejected'
 THEN RAISE EXCEPTION 'Aguarde 12 horas para solicitar novamente'; END IF;
 INSERT INTO public.league_requests(league_id,user_id,status,created_at,decided_at)
 VALUES(p_league_id,who,'pending',now(),NULL)
 ON CONFLICT(league_id,user_id) DO UPDATE SET
 status='pending',created_at=now(),decided_at=NULL;
 RETURN 'pending';
END; $$;

CREATE OR REPLACE FUNCTION public.decide_league_request(p_league_id uuid,p_user_id uuid,p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT app_private.is_league_owner(p_league_id) THEN RAISE EXCEPTION 'Apenas o dono pode aprovar membros'; END IF;
 UPDATE public.league_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
 decided_at=now()
 WHERE league_id=p_league_id AND user_id=p_user_id AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não está pendente'; END IF;
 IF p_approve THEN
 INSERT INTO public.league_members(league_id,user_id,role)
 VALUES(p_league_id,p_user_id,'member') ON CONFLICT DO NOTHING;
 END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.leave_league(p_league_id uuid,p_user_id uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE who uuid:=(SELECT auth.uid()); target_id uuid:=coalesce(p_user_id,(SELECT auth.uid()));
BEGIN
 IF who IS NULL THEN RAISE EXCEPTION 'Faça login'; END IF;
 IF target_id<>who AND NOT app_private.is_league_owner(p_league_id)
 THEN RAISE EXCEPTION 'Somente o dono pode remover membros'; END IF;
 IF EXISTS(SELECT 1 FROM public.leagues WHERE id=p_league_id AND owner_id=target_id)
 THEN RAISE EXCEPTION 'O dono não pode sair sem transferir a propriedade'; END IF;
 DELETE FROM public.league_members WHERE league_id=p_league_id AND user_id=target_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_league_catalog()
RETURNS TABLE(id uuid,owner_id uuid,name text,description text,rules text,visibility text,
 created_at timestamptz,member_count bigint,event_count bigint,my_role text,request_status text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.id,l.owner_id,l.name,l.description,l.rules,l.visibility,l.created_at,
 (SELECT count(*) FROM public.league_members m WHERE m.league_id=l.id),
 (SELECT count(*) FROM public.sessions s WHERE s.league_id=l.id AND s.status<>'cancelled'
  AND NOT app_private.is_event_hidden(s.id)),
 (SELECT m.role FROM public.league_members m
  WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())),
 (SELECT q.status FROM public.league_requests q
  WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid()))
 FROM public.leagues l WHERE (SELECT auth.uid()) IS NOT NULL AND
 (l.visibility='public' OR l.owner_id=(SELECT auth.uid()) OR
 EXISTS(SELECT 1 FROM public.league_members m WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())))
 ORDER BY l.created_at DESC LIMIT 150;
$$;

CREATE OR REPLACE FUNCTION public.get_league_ranking(p_league_id uuid)
RETURNS TABLE(user_id uuid,game text,played bigint,net_chips bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH event_rows AS (
  SELECT s.id,r.game FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
  WHERE s.league_id=p_league_id AND s.status='finished' AND NOT app_private.is_event_hidden(s.id)
    AND (app_private.is_league_member(p_league_id) OR app_private.is_league_owner(p_league_id)
      OR app_private.is_app_admin())
 ), purchases AS (
  SELECT b.session_id,b.user_id,sum(b.chips_received)::bigint AS purchased
  FROM public.session_chip_purchases b JOIN event_rows e ON e.id=b.session_id
  GROUP BY b.session_id,b.user_id
 ), totals AS (
  SELECT e.game,f.user_id,1::bigint AS played,
    (f.chips_final-coalesce(p.purchased,0))::bigint AS net
  FROM public.session_chip_results f JOIN event_rows e ON e.id=f.session_id
  LEFT JOIN purchases p ON p.session_id=f.session_id AND p.user_id=f.user_id
 )
 SELECT t.user_id,t.game,sum(t.played)::bigint,sum(t.net)::bigint
 FROM totals t GROUP BY t.user_id,t.game;
$$;

ALTER TABLE public.sessions ADD COLUMN league_id uuid REFERENCES public.leagues(id) ON DELETE RESTRICT;
CREATE INDEX idx_sessions_league_date ON public.sessions(league_id,starts_at);

-- Nonmembers cannot attach events to another owner's league, even via REST.
DROP POLICY IF EXISTS sessions_insert_organizer ON public.sessions;
CREATE POLICY sessions_insert_league_owner ON public.sessions FOR INSERT TO authenticated
 WITH CHECK(organizer_id=(SELECT auth.uid()) AND EXISTS(
 SELECT 1 FROM public.rooms r WHERE r.id=room_id AND r.status='active')
 AND (league_id IS NULL OR app_private.is_league_owner(league_id)));
-- Membership is immutable once the event has been created.
CREATE OR REPLACE FUNCTION app_private.protect_session_league()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.league_id IS DISTINCT FROM OLD.league_id THEN
 RAISE EXCEPTION 'Não é permitido transferir eventos entre ligas';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER prevent_session_league_change BEFORE UPDATE ON public.sessions
 FOR EACH ROW EXECUTE FUNCTION app_private.protect_session_league();

CREATE OR REPLACE FUNCTION app_private.may_view_event(p_event uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
 app_private.is_app_admin() OR EXISTS(
  SELECT 1 FROM public.sessions s WHERE s.id=p_event
  AND NOT app_private.is_event_hidden(s.id)
  AND (CASE WHEN s.league_id IS NOT NULL
   THEN (app_private.is_league_member(s.league_id) OR app_private.is_league_owner(s.league_id))
   ELSE (s.visibility='public' OR s.organizer_id=(SELECT auth.uid()) OR
    EXISTS(SELECT 1 FROM public.event_invite_members m
      WHERE m.session_id=s.id AND m.user_id=(SELECT auth.uid())))
   END)
 ));
$$;
-- Private event summaries must not become accessible through stale attendance
-- after a league member is removed.
CREATE OR REPLACE FUNCTION app_private.can_view_session_private(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
 app_private.is_app_admin() OR (
 app_private.may_view_event(p_session) AND (
 EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=p_session AND a.user_id=(SELECT auth.uid()))
 OR EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=p_session AND s.organizer_id=(SELECT auth.uid()))
 )));
$$;

DO $$ DECLARE x text; BEGIN
 FOREACH x IN ARRAY ARRAY['create_league(text,text,text,text)','update_league(uuid,text,text,text,text)',
 'generate_league_invite(uuid)','preview_league_invite(text)','request_league_join(uuid,text)',
 'decide_league_request(uuid,uuid,boolean)','leave_league(uuid,uuid)','get_league_catalog()','get_league_ranking(uuid)']
 LOOP EXECUTE 'REVOKE ALL ON FUNCTION public.'||x||' FROM PUBLIC,anon';
 EXECUTE 'GRANT EXECUTE ON FUNCTION public.'||x||' TO authenticated';
 END LOOP;
END $$;
