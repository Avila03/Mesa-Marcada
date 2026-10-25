-- Mesa Marcada: achievements gallery / profile showcase.
-- Read-only earned progress, no client-authoritative reward creation.
CREATE TABLE IF NOT EXISTS public.profile_medal_showcase (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 featured_id text,
 pinned_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
 visible boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT medal_showcase_featured_id_valid CHECK (
  featured_id IS NULL OR featured_id=ANY(ARRAY['first','collector','podium','shark','positive','record','veteran','loyal','poker','blackjack','versatile','champ','multi','pioneer','host']::text[])
 ),
 CONSTRAINT medal_showcase_pin_count CHECK(cardinality(pinned_ids)<=3),
 CONSTRAINT medal_showcase_pin_values CHECK(pinned_ids<@ARRAY['first','collector','podium','shark','positive','record','veteran','loyal','poker','blackjack','versatile','champ','multi','pioneer','host']::text[])
);
ALTER TABLE public.profile_medal_showcase ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profile_medal_showcase FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.profile_medal_showcase TO authenticated;
DROP POLICY IF EXISTS medal_showcase_view ON public.profile_medal_showcase;
CREATE POLICY medal_showcase_view ON public.profile_medal_showcase FOR SELECT TO authenticated USING((SELECT auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS medal_showcase_insert ON public.profile_medal_showcase;
CREATE POLICY medal_showcase_insert ON public.profile_medal_showcase FOR INSERT TO authenticated
 WITH CHECK(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS medal_showcase_update ON public.profile_medal_showcase;
CREATE POLICY medal_showcase_update ON public.profile_medal_showcase FOR UPDATE TO authenticated
 USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS medal_showcase_delete ON public.profile_medal_showcase;
CREATE POLICY medal_showcase_delete ON public.profile_medal_showcase FOR DELETE TO authenticated
 USING(user_id=(SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.get_player_medal_progress(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE stats jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL THEN RAISE EXCEPTION 'Faça login para consultar conquistas'; END IF;
 IF p_user_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=p_user_id)
 THEN RAISE EXCEPTION 'Jogador não encontrado'; END IF;
 WITH
 bought AS (
  SELECT session_id,user_id,sum(chips_received)::bigint AS chips
  FROM public.session_chip_purchases GROUP BY session_id,user_id
 ),
 eligible AS (
  SELECT s.id,s.league_id,s.organizer_id,s.starts_at,r.game
  FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
  WHERE s.status='finished' AND NOT app_private.is_event_hidden(s.id)
  AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=2
  AND NOT EXISTS(
   SELECT 1 FROM public.session_attendance a
   LEFT JOIN bought b ON b.session_id=a.session_id AND b.user_id=a.user_id
   LEFT JOIN public.session_chip_results f ON f.session_id=a.session_id AND f.user_id=a.user_id
   LEFT JOIN public.session_finance_approvals fa ON fa.session_id=a.session_id AND fa.user_id=a.user_id
   WHERE a.session_id=s.id AND (b.user_id IS NULL OR f.user_id IS NULL OR fa.user_id IS NULL)
  )
 ),
 scores AS (
  SELECT e.id AS session_id,e.league_id,e.organizer_id,e.starts_at,e.game,
   a.user_id,(f.chips_final-b.chips)::bigint AS net
  FROM eligible e
  JOIN public.session_attendance a ON a.session_id=e.id
  JOIN bought b ON b.session_id=a.session_id AND b.user_id=a.user_id
  JOIN public.session_chip_results f ON f.session_id=a.session_id AND f.user_id=a.user_id
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
  SELECT distinct p_league.id AS league_id,p_league.session_id
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
END; $$;
REVOKE ALL ON FUNCTION public.get_player_medal_progress(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_medal_progress(uuid) TO authenticated;
