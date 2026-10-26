CREATE OR REPLACE FUNCTION public.get_player_medal_progress(p_user_id uuid)
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

CREATE OR REPLACE FUNCTION public.get_player_frame_progress(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_user_id)
 THEN RAISE EXCEPTION 'Jogador inexistente'; END IF;
 WITH
 qualified_events AS (
 SELECT DISTINCT e.session_id AS id,e.league_id,e.starts_at,e.game
 FROM app_private.event_scores() e WHERE e.league_id IS NOT NULL
 AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=e.session_id)>=2
 ), scored AS (
 SELECT e.session_id AS event_id,e.league_id,e.starts_at,e.game,e.user_id,e.net
 FROM app_private.event_scores() e JOIN qualified_events q ON q.id=e.session_id
 ),
 timeline AS (
  SELECT e.*,row_number() OVER(PARTITION BY league_id,game ORDER BY starts_at,id) AS seq
  FROM qualified_events e
 ),
 competing AS (
  SELECT DISTINCT league_id,game,user_id FROM scored
 ),
 cumulative AS (
  SELECT e.id AS event_id,e.league_id,e.game,e.starts_at,e.seq,p.user_id,
    coalesce((SELECT sum(s.net) FROM scored s JOIN timeline t ON t.id=s.event_id
      WHERE s.league_id=e.league_id AND s.game=e.game AND s.user_id=p.user_id
        AND t.seq<=e.seq),0)::bigint AS total,
    EXISTS(SELECT 1 FROM scored sc WHERE sc.event_id=e.id AND sc.user_id=p.user_id) AS played
  FROM timeline e JOIN competing p ON p.league_id=e.league_id AND p.game=e.game
 ),
 leaders AS (
  SELECT c.*,
    rank() OVER(PARTITION BY event_id ORDER BY total DESC) AS place,
    count(*) OVER(PARTITION BY event_id,total) AS tied
  FROM cumulative c
 ),
 leader_windows AS (
  SELECT l.*,
    count(*) OVER w AS checked,
    sum(CASE WHEN place=1 AND tied=1 AND total>0 THEN 1 ELSE 0 END) OVER w AS wins,
    sum(CASE WHEN played THEN 1 ELSE 0 END) OVER w AS participations
  FROM leaders l
  WINDOW w AS (PARTITION BY league_id,game,user_id ORDER BY seq ROWS BETWEEN 5 PRECEDING AND CURRENT ROW)
 ),
 leader_score AS (
  SELECT coalesce(max(CASE WHEN checked=6 AND wins=6 AND participations>=4 THEN 6
    ELSE least(wins,5) END),0)::int AS score
  FROM leader_windows WHERE user_id=p_user_id
 ),
 payables AS (
  SELECT x.session_id,x.paid_by,sum(x.amount_brl)::numeric AS spent
  FROM public.session_expenses x
  JOIN qualified_events qe ON qe.id=x.session_id
  WHERE x.amount_brl>0 AND x.split_open=true
    AND (SELECT count(*) FROM public.expense_split_members m WHERE m.expense_id=x.id)>=2
    AND NOT EXISTS (
      SELECT 1 FROM public.expense_split_members m
      WHERE m.expense_id=x.id AND m.user_id<>x.paid_by
        AND NOT EXISTS(SELECT 1 FROM public.expense_split_settlements st
          WHERE st.expense_id=x.id AND st.user_id=m.user_id AND st.confirmed_at IS NOT NULL)
    )
  GROUP BY x.session_id,x.paid_by
 ),
 payment_ranks AS (
  SELECT qe.id,qe.starts_at,a.user_id,coalesce(p.spent,0)::numeric AS paid,
    rank() OVER(PARTITION BY qe.id ORDER BY coalesce(p.spent,0) DESC) AS standing,
    count(*) OVER(PARTITION BY qe.id,coalesce(p.spent,0)) AS tied
  FROM qualified_events qe
  JOIN public.session_attendance a ON a.session_id=qe.id
  LEFT JOIN payables p ON p.session_id=qe.id AND p.paid_by=a.user_id
 ),
 paid_windows AS (
  SELECT *,
    count(*) OVER w AS checked,
    sum(CASE WHEN standing=1 AND tied=1 AND paid>0 THEN 1 ELSE 0 END) OVER w AS streak
  FROM payment_ranks
  WHERE user_id=p_user_id
  WINDOW w AS (ORDER BY starts_at,id ROWS BETWEEN 4 PRECEDING AND CURRENT ROW)
 ),
 high_score AS (
  SELECT coalesce(max(CASE WHEN checked=5 AND streak=5 THEN 5 ELSE least(streak,4) END),0)::int AS score
  FROM paid_windows
 ),
 champions AS (
  SELECT league_id,game,user_id,net,
    max(net) OVER(PARTITION BY league_id,game) AS top_net
  FROM (
    SELECT f.league_id,g.game,m.item->>'user_id' AS user_id,
           coalesce((m.item->>'net_chips')::numeric,0) AS net
    FROM app_private.league_final_reports f
    CROSS JOIN LATERAL (VALUES('poker'::text),('blackjack'::text)) g(game)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(f.summary->'games'->g.game->'ranking','[]'::jsonb)) m(item)
  ) all_members
 ),
 dual_score AS (
  SELECT count(*)::int AS score FROM (
    SELECT league_id FROM champions
    WHERE user_id=p_user_id::text AND net=top_net AND net>0
    GROUP BY league_id HAVING count(DISTINCT game)=2
  ) qualifying_leagues
 ),
 profile_score AS (
  SELECT
   (CASE WHEN p.avatar_path IS NOT NULL AND length(trim(p.avatar_path))>0 THEN 1 ELSE 0 END
   +CASE WHEN p.bio IS NOT NULL AND length(trim(p.bio))>0 THEN 1 ELSE 0 END
   +CASE WHEN p.favorite_game IN('poker','blackjack') THEN 1 ELSE 0 END
   +CASE WHEN sh.featured_id IS NOT NULL THEN 1 ELSE 0 END
   +CASE WHEN coalesce(cardinality(sh.pinned_ids),0)=3 THEN 1 ELSE 0 END)::int AS score
  FROM public.profiles p LEFT JOIN public.profile_medal_showcase sh ON sh.user_id=p.id
  WHERE p.id=p_user_id
 )
 SELECT jsonb_build_object(
  'safira',coalesce((SELECT score FROM profile_score),0),
  'dupla-coroa',coalesce((SELECT score FROM dual_score),0),
  'rei-sequencia',coalesce((SELECT score FROM leader_score),0),
  'high-roller',coalesce((SELECT score FROM high_score),0),
  'conclave',coalesce((SELECT count(DISTINCT league_id) FROM scored WHERE user_id=p_user_id),0)
 ) INTO result;
 RETURN result;
END; $function$;
