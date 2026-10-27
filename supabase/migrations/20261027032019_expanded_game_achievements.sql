CREATE OR REPLACE FUNCTION app_private.finance_medal_progress(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE stats jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login para consultar conquistas'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user_id)
 THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
 WITH
 eligible AS (
 SELECT DISTINCT e.session_id AS id,e.league_id,e.organizer_id,e.starts_at,e.game
 FROM app_private.event_scores() e
 WHERE (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=e.session_id)>=2
 ), scores AS (
 SELECT e.session_id,e.league_id,e.organizer_id,e.starts_at,e.game,e.user_id,e.net
 FROM app_private.event_scores() e JOIN eligible q ON q.id=e.session_id
 ),
 ranked AS (
  SELECT sc.*,rank() OVER(PARTITION BY sc.session_id ORDER BY sc.net DESC) AS standing,
  count(*) OVER(PARTITION BY sc.session_id) AS participants
  FROM scores sc
 ),
 my AS (SELECT * FROM ranked WHERE user_id=p_user_id),
 wins AS (
  SELECT game,count(*)::bigint AS total FROM my
  WHERE standing=1 AND net>0 GROUP BY game
 ),
 podium AS (
  SELECT game,count(*)::bigint AS total FROM my
  WHERE standing<=3 AND participants>=4 GROUP BY game
 ),
 shark_games AS (
  SELECT game,count(*)::bigint AS total,
   count(*) FILTER(WHERE standing=1 AND net>0)::bigint AS won
  FROM my GROUP BY game
 ),
 best_shark AS (
  SELECT COALESCE(max(CASE
   WHEN total>=40 AND won::numeric/total>=0.75 THEN 40
   WHEN total>=20 AND won::numeric/total>=0.70 THEN 20
   WHEN total>=10 AND won::numeric/total>=0.60 THEN 10
   ELSE 0 END),0)::bigint AS tier
  FROM shark_games
 ),
 records AS (
  SELECT user_id,game,net,
   row_number() OVER(PARTITION BY user_id,game ORDER BY starts_at,session_id) AS seq,
   max(net) OVER(PARTITION BY user_id,game ORDER BY starts_at,session_id ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS former_best
  FROM scores
 ),
 loyalty AS (
  SELECT coalesce(max(n),0)::bigint AS best FROM (
   SELECT league_id,count(*)::bigint AS n FROM my
   WHERE league_id IS NOT NULL GROUP BY league_id
  ) v
 ),
 per_game AS (
  SELECT game,count(*)::bigint AS total,sum(net)::bigint AS sum_net FROM my GROUP BY game
 ),
 pioneers AS (
  SELECT p_league.league_id,p_league.session_id
  FROM (
   SELECT id AS session_id,league_id,
    row_number() OVER(PARTITION BY league_id ORDER BY starts_at,id) AS position
   FROM eligible WHERE league_id IS NOT NULL
  ) p_league
  WHERE p_league.position=1
 ),
 winners AS (
  SELECT report.league_id,game.game_name,
   (member.value->>'user_id')::uuid AS player_id,
   (member.value->>'net_chips')::numeric AS points
  FROM app_private.league_final_reports report
  CROSS JOIN LATERAL (VALUES('poker'::text),('blackjack'::text)) game(game_name)
  CROSS JOIN LATERAL jsonb_array_elements(
   coalesce(report.summary->'games'->game.game_name->'ranking','[]'::jsonb)
  ) member(value)
  WHERE (member.value->>'net_chips')::numeric>0
  AND (member.value->>'net_chips')::numeric=(
   SELECT max((op.value->>'net_chips')::numeric)
   FROM jsonb_array_elements(
    coalesce(report.summary->'games'->game.game_name->'ranking','[]'::jsonb)
   ) op(value)
  )
 ),
 awards AS (
  SELECT key, greatest(0,coalesce(value,0))::bigint AS progress FROM (
   VALUES
    ('first'::text,(SELECT count(*) FROM my WHERE standing=1 AND net>0)),
    ('collector',(SELECT coalesce(max(total),0) FROM wins)),
    ('podium',(SELECT coalesce(max(total),0) FROM podium)),
    ('shark',(SELECT tier FROM best_shark)),
    ('positive',(SELECT count(*) FROM my WHERE net>0)),
    ('record',(SELECT count(*) FROM records WHERE user_id=p_user_id AND seq>=3 AND net>0 AND net>former_best)),
    ('veteran',(SELECT count(*) FROM my)),
    ('loyal',(SELECT best FROM loyalty)),
    ('poker',(SELECT count(*) FROM my WHERE game='poker')),
    ('blackjack',(SELECT count(*) FROM my WHERE game='blackjack')),
    ('versatile',(SELECT CASE WHEN
      coalesce((SELECT sum_net FROM per_game WHERE game='poker'),0)>0
      AND coalesce((SELECT sum_net FROM per_game WHERE game='blackjack'),0)>0
      THEN least(coalesce((SELECT total FROM per_game WHERE game='poker'),0),
                 coalesce((SELECT total FROM per_game WHERE game='blackjack'),0))
      ELSE 0 END)),
    ('champ',(SELECT count(*) FROM winners WHERE player_id=p_user_id)),
    ('multi',(SELECT count(DISTINCT league_id) FROM winners WHERE player_id=p_user_id)),
    ('pioneer',(SELECT count(*) FROM pioneers pi JOIN my m ON m.session_id=pi.session_id)),
    ('host',(SELECT count(*) FROM eligible e WHERE e.organizer_id=p_user_id))
  ) values_by_medal(key,value)
 )
 SELECT coalesce(jsonb_object_agg(key,progress),'{}'::jsonb) INTO stats FROM awards;
 RETURN stats;
END; $function$;


REVOKE ALL ON FUNCTION app_private.finance_medal_progress(uuid) FROM PUBLIC,anon,authenticated;
ALTER TABLE public.profile_medal_showcase DROP CONSTRAINT medal_showcase_featured_id_valid, DROP CONSTRAINT medal_showcase_pin_values;
ALTER TABLE public.profile_medal_showcase ADD CONSTRAINT medal_showcase_featured_id_valid CHECK(featured_id IS NULL OR featured_id=ANY(ARRAY['first','collector','podium','shark','positive','record','veteran','loyal','poker','blackjack','versatile','champ','multi','pioneer','host','truco','canastra','pontinho','uno','pife','truco_wins','canastra_wins','pontinho_wins','uno_wins','pife_wins','explorer','truco_routes','canastra_routes','duo_wins','draw_poker','league_cards']::text[])),ADD CONSTRAINT medal_showcase_pin_values CHECK(pinned_ids<@ARRAY['first','collector','podium','shark','positive','record','veteran','loyal','poker','blackjack','versatile','champ','multi','pioneer','host','truco','canastra','pontinho','uno','pife','truco_wins','canastra_wins','pontinho_wins','uno_wins','pife_wins','explorer','truco_routes','canastra_routes','duo_wins','draw_poker','league_cards']::text[]);
ALTER TABLE public.player_medal_grants DROP CONSTRAINT player_medal_grants_medal_valid;
ALTER TABLE public.player_medal_grants ADD CONSTRAINT player_medal_grants_medal_valid CHECK(medal_id=ANY(ARRAY['first','collector','podium','shark','positive','record','veteran','loyal','poker','blackjack','versatile','champ','multi','pioneer','host','truco','canastra','pontinho','uno','pife','truco_wins','canastra_wins','pontinho_wins','uno_wins','pife_wins','explorer','truco_routes','canastra_routes','duo_wins','draw_poker','league_cards']::text[]));
CREATE FUNCTION app_private.expanded_medal_progress(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE old jsonb; fresh jsonb;
BEGIN
 old:=app_private.finance_medal_progress(p_user_id);
 WITH valid AS (
  SELECT s.id,s.league_id,s.organizer_id,s.starts_at,m.* FROM public.sessions s
  JOIN public.session_score_matches m ON m.session_id=s.id
  WHERE s.status='finished' AND m.status='complete' AND cardinality(m.players)>=2
  AND cardinality(m.winner_ids)>0 AND NOT app_private.is_event_hidden(s.id) AND app_private.may_view_event(s.id)
 ), my AS (
  SELECT v.*,p_user_id=ANY(v.winner_ids) AS won FROM valid v WHERE p_user_id=ANY(v.players)
 ), modes AS (
  SELECT game,count(*) n,count(*) FILTER(WHERE won) wins FROM my GROUP BY game
 ), all_history AS (
  SELECT DISTINCT e.session_id AS id,e.league_id,e.organizer_id,e.starts_at,e.game,e.user_id
  FROM app_private.event_scores() e
  WHERE (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=e.session_id)>=2
  UNION ALL SELECT session_id,league_id,organizer_id,starts_at,game,p_user_id FROM my
 ), loyalty AS (
  SELECT coalesce(max(n),0) n FROM (SELECT count(*) n FROM all_history WHERE user_id=p_user_id AND league_id IS NOT NULL GROUP BY league_id)x
 ), first_events AS (
  SELECT id,league_id,row_number() OVER(PARTITION BY league_id ORDER BY starts_at,id) position
  FROM (SELECT DISTINCT id,league_id,starts_at FROM all_history WHERE league_id IS NOT NULL
   UNION SELECT session_id,league_id,starts_at FROM valid WHERE league_id IS NOT NULL)x
 ), league_wins AS (
  SELECT r.league_id FROM app_private.league_final_reports r
  CROSS JOIN LATERAL jsonb_array_elements(coalesce(r.summary->'score_games','[]'::jsonb)) g
  WHERE (g->'ranking'->0->>'user_id')::uuid=p_user_id AND (g->'ranking'->0->>'wins')::bigint>0
  AND (app_private.is_league_member(r.league_id) OR app_private.is_league_owner(r.league_id) OR app_private.is_app_admin())
 ), awards AS (
 SELECT game key,n value FROM modes
 UNION ALL SELECT game||'_wins',wins FROM modes
 UNION ALL SELECT 'first',coalesce((old->>'first')::bigint,0)+(SELECT count(*) FROM my WHERE won)
 UNION ALL SELECT 'collector',greatest(coalesce((old->>'collector')::bigint,0),coalesce((SELECT max(wins) FROM modes),0))
 UNION ALL SELECT 'shark',greatest(coalesce((old->>'shark')::bigint,0),coalesce((SELECT max(CASE WHEN n>=40 AND wins::numeric/n>=0.75 THEN 40 WHEN n>=20 AND wins::numeric/n>=0.70 THEN 20 WHEN n>=10 AND wins::numeric/n>=0.60 THEN 10 ELSE 0 END) FROM modes),0))
 UNION ALL SELECT 'veteran',coalesce((old->>'veteran')::bigint,0)+(SELECT count(*) FROM my)
 UNION ALL SELECT 'loyal',(SELECT n FROM loyalty)
 UNION ALL SELECT 'host',coalesce((old->>'host')::bigint,0)+(SELECT count(*) FROM valid WHERE organizer_id=p_user_id)
 UNION ALL SELECT 'explorer',(SELECT count(DISTINCT game) FROM all_history WHERE user_id=p_user_id)
 UNION ALL SELECT 'truco_routes',(SELECT count(DISTINCT variant) FROM my WHERE game='truco')
 UNION ALL SELECT 'canastra_routes',(SELECT count(DISTINCT variant) FROM my WHERE game='canastra')
 UNION ALL SELECT 'duo_wins',(SELECT count(*) FROM my WHERE won AND game IN('truco','canastra') AND cardinality(winner_ids)>=2)
 UNION ALL SELECT 'draw_poker',(SELECT count(*) FROM app_private.event_scores() e JOIN public.sessions s ON s.id=e.session_id WHERE e.user_id=p_user_id AND e.game='poker' AND s.game_variant='five_card_draw' AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=2)
 UNION ALL SELECT 'league_cards',(SELECT count(*) FROM league_wins)
 UNION ALL SELECT 'pioneer',coalesce((old->>'pioneer')::bigint,0)+(SELECT count(*) FROM first_events f JOIN my m ON m.session_id=f.id WHERE f.position=1)
 ) SELECT coalesce(jsonb_object_agg(key,greatest(value,0)),'{}'::jsonb) INTO fresh FROM awards;
 RETURN old||jsonb_build_object('truco',0,'canastra',0,'pontinho',0,'uno',0,'pife',0,'truco_wins',0,'canastra_wins',0,'pontinho_wins',0,'uno_wins',0,'pife_wins',0)||fresh;
END; $$;
REVOKE ALL ON FUNCTION app_private.expanded_medal_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.expanded_medal_progress(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_player_medal_progress(p_user_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$ SELECT app_private.expanded_medal_progress(p_user_id); $$;
REVOKE ALL ON FUNCTION public.get_player_medal_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_medal_progress(uuid) TO authenticated;
