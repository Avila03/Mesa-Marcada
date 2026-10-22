-- Mesa Marcada: fechamento com snapshot privado, protegido e imutável.
ALTER TABLE public.leagues ADD COLUMN IF NOT EXISTS finished_at timestamptz;
CREATE TABLE IF NOT EXISTS app_private.league_final_reports(
 league_id uuid PRIMARY KEY REFERENCES public.leagues(id) ON DELETE CASCADE,
 finished_at timestamptz NOT NULL,
 summary jsonb NOT NULL
);
REVOKE ALL ON app_private.league_final_reports FROM PUBLIC,anon,authenticated;

-- Torna impossível anexar novas sessões à liga encerrada.
-- O lock compartilha a mesma linha bloqueada durante o fechamento.
CREATE OR REPLACE FUNCTION app_private.ensure_league_open_for_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_finished timestamptz;
BEGIN
 IF NEW.league_id IS NULL THEN RETURN NEW; END IF;
 SELECT l.finished_at INTO v_finished
 FROM public.leagues l WHERE l.id=NEW.league_id FOR SHARE;
 IF v_finished IS NOT NULL THEN
  RAISE EXCEPTION 'Esta liga já foi finalizada e não aceita novos eventos';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_session_league_open ON public.sessions;
CREATE TRIGGER trg_session_league_open
 BEFORE INSERT ON public.sessions FOR EACH ROW
 EXECUTE FUNCTION app_private.ensure_league_open_for_session();

-- Impede solicitações de entrada em ligas já encerradas.
CREATE OR REPLACE FUNCTION app_private.ensure_league_open_for_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='pending' AND EXISTS (
  SELECT 1 FROM public.leagues l WHERE l.id=NEW.league_id AND l.finished_at IS NOT NULL
 ) THEN
  RAISE EXCEPTION 'Esta liga já foi finalizada e não aceita novos participantes';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_request_league_open ON public.league_requests;
CREATE TRIGGER trg_request_league_open
 BEFORE INSERT OR UPDATE OF status ON public.league_requests
 FOR EACH ROW EXECUTE FUNCTION app_private.ensure_league_open_for_request();

-- Liga finalizada mantém nome, regras, privacidade e brasão originais.
CREATE OR REPLACE FUNCTION app_private.protect_finished_league_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF OLD.finished_at IS NOT NULL AND (
   NEW.name IS DISTINCT FROM OLD.name OR
   NEW.description IS DISTINCT FROM OLD.description OR
   NEW.rules IS DISTINCT FROM OLD.rules OR
   NEW.visibility IS DISTINCT FROM OLD.visibility OR
   NEW.emblem IS DISTINCT FROM OLD.emblem OR
   NEW.finished_at IS DISTINCT FROM OLD.finished_at
 ) THEN
  RAISE EXCEPTION 'A identidade e os resultados de uma liga finalizada são permanentes';
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_protect_finished_league_identity ON public.leagues;
CREATE TRIGGER trg_protect_finished_league_identity
 BEFORE UPDATE ON public.leagues FOR EACH ROW
 EXECUTE FUNCTION app_private.protect_finished_league_identity();

CREATE OR REPLACE FUNCTION public.finish_league(p_league_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 v_league public.leagues%ROWTYPE;
 v_time timestamptz:=clock_timestamp();
 v_report jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login para finalizar uma liga'; END IF;

 SELECT * INTO v_league FROM public.leagues l WHERE l.id=p_league_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Liga não encontrada'; END IF;
 IF v_league.owner_id<>(SELECT auth.uid()) THEN
  RAISE EXCEPTION 'Somente o dono pode finalizar a liga';
 END IF;
 IF v_league.finished_at IS NOT NULL THEN RAISE EXCEPTION 'Esta liga já foi finalizada'; END IF;

 IF EXISTS (SELECT 1 FROM public.sessions s WHERE s.league_id=p_league_id AND s.status='scheduled') THEN
  RAISE EXCEPTION 'Encerre ou cancele os eventos agendados antes de finalizar a liga';
 END IF;

 WITH all_events AS (
  SELECT s.id,s.title,s.starts_at,s.status,r.game
  FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
  WHERE s.league_id=p_league_id AND NOT app_private.is_event_hidden(s.id)
 ),
 complete_events AS (
  SELECT id,game FROM all_events WHERE status='finished'
 ),
 purchases AS (
  SELECT b.session_id,b.user_id,sum(b.chips_received)::bigint AS purchased
  FROM public.session_chip_purchases b
  JOIN complete_events e ON e.id=b.session_id
  GROUP BY b.session_id,b.user_id
 ),
 points AS (
  SELECT e.game,f.user_id,count(*)::bigint AS played,
   sum((f.chips_final - coalesce(p.purchased,0)))::bigint AS net_chips
  FROM public.session_chip_results f
  JOIN complete_events e ON e.id=f.session_id
  LEFT JOIN purchases p ON p.session_id=f.session_id AND p.user_id=f.user_id
  GROUP BY e.game,f.user_id
 ),
 scoreboard AS (
  SELECT x.game,x.user_id,coalesce(pr.display_name,'Jogador') AS display_name,
   x.played,x.net_chips
  FROM points x LEFT JOIN public.profiles pr ON pr.id=x.user_id
 )
 SELECT jsonb_build_object(
  'version',1,
  'league_name',v_league.name,
  'started_at',v_league.created_at,
  'finished_at',v_time,
  'members',(SELECT count(*) FROM public.league_members m WHERE m.league_id=p_league_id),
  'events_total',(SELECT count(*) FROM all_events),
  'events_finished',(SELECT count(*) FROM all_events WHERE status='finished'),
  'events_cancelled',(SELECT count(*) FROM all_events WHERE status='cancelled'),
  'events',coalesce((
    SELECT jsonb_agg(jsonb_build_object(
     'title',e.title,'starts_at',e.starts_at,'status',e.status,'game',e.game)
     ORDER BY e.starts_at,e.id)
    FROM all_events e),'[]'::jsonb),
  'games',(
    SELECT jsonb_object_agg(g.game,jsonb_build_object(
     'events',(SELECT count(*) FROM complete_events e WHERE e.game=g.game),
     'ranking',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
       'user_id',r.user_id,'name',r.display_name,
       'played',r.played,'net_chips',r.net_chips)
       ORDER BY r.net_chips DESC,r.played DESC,r.display_name ASC,r.user_id)
      FROM scoreboard r WHERE r.game=g.game),'[]'::jsonb)
    ))
    FROM (VALUES ('poker'::text),('blackjack'::text)) g(game)
  )
 ) INTO v_report;

 INSERT INTO app_private.league_final_reports(league_id,finished_at,summary)
 VALUES(p_league_id,v_time,v_report);
 UPDATE public.leagues SET finished_at=v_time WHERE id=p_league_id;
 RETURN v_report;
END; $$;
REVOKE ALL ON FUNCTION public.finish_league(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finish_league(uuid) TO authenticated;



-- Freeze membership after closure, maintaining archived report access.
CREATE OR REPLACE FUNCTION app_private.freeze_closed_league_members()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_league uuid;
BEGIN
 v_league:=CASE WHEN TG_OP='DELETE' THEN OLD.league_id ELSE NEW.league_id END;
 IF EXISTS(SELECT 1 FROM public.leagues l WHERE l.id=v_league AND l.finished_at IS NOT NULL)
 THEN RAISE EXCEPTION 'A participação de uma liga finalizada é somente leitura'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_freeze_closed_members ON public.league_members;
CREATE TRIGGER trg_freeze_closed_members BEFORE INSERT OR UPDATE OR DELETE
ON public.league_members FOR EACH ROW EXECUTE FUNCTION app_private.freeze_closed_league_members();

CREATE OR REPLACE FUNCTION public.get_league_catalog_final()
RETURNS TABLE(
 id uuid,owner_id uuid,name text,description text,rules text,visibility text,
 created_at timestamptz,member_count bigint,event_count bigint,my_role text,
 request_status text,emblem jsonb,finished_at timestamptz,final_summary jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.id,l.owner_id,l.name,l.description,l.rules,l.visibility,l.created_at,
  (SELECT count(*) FROM public.league_members m WHERE m.league_id=l.id),
  (SELECT count(*) FROM public.sessions s WHERE s.league_id=l.id AND s.status<>'cancelled'
   AND NOT app_private.is_event_hidden(s.id)),
  (SELECT m.role FROM public.league_members m
   WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())),
  (SELECT q.status FROM public.league_requests q
   WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid())),
  l.emblem,l.finished_at,
  CASE WHEN l.owner_id=(SELECT auth.uid()) OR app_private.is_league_member(l.id)
   OR app_private.is_app_admin()
  THEN archive.summary ELSE NULL END
 FROM public.leagues l
 LEFT JOIN app_private.league_final_reports archive ON archive.league_id=l.id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND (l.visibility='public' OR l.owner_id=(SELECT auth.uid()) OR
  EXISTS(SELECT 1 FROM public.league_members m WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())) OR
  EXISTS(SELECT 1 FROM public.league_requests q WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid()) AND q.status='pending'))
 ORDER BY l.created_at DESC LIMIT 150;
$$;
REVOKE ALL ON FUNCTION public.get_league_catalog_final() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_league_catalog_final() TO authenticated;
