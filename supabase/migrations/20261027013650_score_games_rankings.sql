CREATE FUNCTION app_private.get_score_ranking(p_game text DEFAULT NULL,p_variant text DEFAULT NULL,p_league_id uuid DEFAULT NULL,p_year integer DEFAULT NULL,p_user_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid,display_name text,avatar_symbol text,game text,variant text,played bigint,wins bigint,total_score bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 WITH eligible AS (
  SELECT m.*,s.starts_at FROM public.session_score_matches m JOIN public.sessions s ON s.id=m.session_id
  WHERE (SELECT auth.uid()) IS NOT NULL AND s.status='finished' AND m.status='complete'
  AND NOT app_private.is_event_hidden(s.id) AND app_private.may_view_event(s.id)
  AND (p_game IS NULL OR m.game=p_game) AND (p_variant IS NULL OR m.variant=p_variant)
  AND (p_league_id IS NULL OR (s.league_id=p_league_id AND (app_private.is_league_member(p_league_id) OR app_private.is_league_owner(p_league_id) OR app_private.is_app_admin())))
  AND (p_year IS NULL OR extract(year FROM s.starts_at)=p_year)
 ), scores AS(
 SELECT e.players[idx.num] AS user_id,e.game,e.variant,
  CASE WHEN e.players[idx.num]=ANY(e.winner_ids) THEN 1 ELSE 0 END AS won,
  (e.state->'scores'->>e.teams[idx.num])::bigint AS score
 FROM eligible e CROSS JOIN LATERAL generate_subscripts(e.players,1) AS idx(num)
 )
 SELECT p.id,p.display_name,p.avatar_symbol,s.game,s.variant,count(*)::bigint,sum(s.won)::bigint,sum(s.score)::bigint
 FROM scores s JOIN public.profiles p ON p.id=s.user_id WHERE p_user_id IS NULL OR p.id=p_user_id
 GROUP BY p.id,p.display_name,p.avatar_symbol,s.game,s.variant
 ORDER BY sum(s.won) DESC,sum(s.won)::numeric/count(*) DESC,count(*) DESC,p.display_name,p.id;
$$;
REVOKE ALL ON FUNCTION app_private.get_score_ranking(text,text,uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_score_ranking(text,text,uuid,integer,uuid) TO authenticated;
CREATE FUNCTION public.get_score_ranking(p_game text DEFAULT NULL,p_variant text DEFAULT NULL,p_league_id uuid DEFAULT NULL,p_year integer DEFAULT NULL,p_user_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid,display_name text,avatar_symbol text,game text,variant text,played bigint,wins bigint,total_score bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT * FROM app_private.get_score_ranking(p_game,p_variant,p_league_id,p_year,p_user_id); $$;
REVOKE ALL ON FUNCTION public.get_score_ranking(text,text,uuid,integer,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_score_ranking(text,text,uuid,integer,uuid) TO authenticated;

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


 v_report:=v_report||jsonb_build_object('version',3,'score_games',coalesce((
  WITH scores AS (SELECT * FROM app_private.get_score_ranking(NULL,NULL,p_league_id,NULL,NULL)),
  modes AS (SELECT DISTINCT game,variant FROM scores)
  SELECT jsonb_agg(jsonb_build_object('game',mode.game,'variant',mode.variant,'ranking',(
   SELECT jsonb_agg(jsonb_build_object('user_id',r.user_id,'name',r.display_name,'played',r.played,'wins',r.wins) ORDER BY r.wins DESC,r.wins::numeric/nullif(r.played,0) DESC,r.played DESC,r.display_name,r.user_id)
   FROM scores r WHERE r.game=mode.game AND r.variant=mode.variant
  )) ORDER BY mode.game,mode.variant) FROM modes mode
 ),'[]'::jsonb));

 INSERT INTO app_private.league_final_reports(league_id,finished_at,summary)
 VALUES(p_league_id,v_time,v_report);
 UPDATE public.leagues SET finished_at=v_time WHERE id=p_league_id;
 RETURN v_report;
END; $function$;
