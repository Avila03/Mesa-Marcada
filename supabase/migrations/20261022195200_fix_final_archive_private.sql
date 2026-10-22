-- Replace first-pass public report storage with private immutable archive.
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

 INSERT INTO app_private.league_final_reports(league_id,finished_at,summary) VALUES(p_league_id,v_time,v_report);
 UPDATE public.leagues SET finished_at=v_time WHERE id=p_league_id;
 RETURN v_report;
END; $$;

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
  THEN report.summary ELSE NULL END
 FROM public.leagues l
 LEFT JOIN app_private.league_final_reports report ON report.league_id=l.id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND (l.visibility='public' OR l.owner_id=(SELECT auth.uid()) OR
  EXISTS(SELECT 1 FROM public.league_members m WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())) OR
  EXISTS(SELECT 1 FROM public.league_requests q WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid()) AND q.status='pending'))
 ORDER BY l.created_at DESC LIMIT 150;
$$;

ALTER TABLE public.leagues DROP CONSTRAINT IF EXISTS leagues_finalization_consistency;
ALTER TABLE public.leagues DROP COLUMN IF EXISTS final_summary;
