CREATE OR REPLACE FUNCTION public.finish_league(p_league_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 points AS (
 SELECT e.game,e.user_id,count(*)::bigint AS played,sum(e.net)::bigint AS net_chips
 FROM app_private.event_scores() e WHERE e.league_id=p_league_id GROUP BY e.game,e.user_id
 ),
 scoreboard AS (
  SELECT x.game,x.user_id,coalesce(pr.display_name,'Jogador') AS display_name,
   x.played,x.net_chips
  FROM points x LEFT JOIN public.profiles pr ON pr.id=x.user_id
 )
 SELECT jsonb_build_object(
  'version',2,
  'score_unit','brl_cents',
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
END; $function$;
