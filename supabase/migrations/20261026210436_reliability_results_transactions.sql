
-- One score source for reconciled BRL nights and historical chip-based nights.
-- Compatibility columns named *_chips below now carry integer BRL cents.
CREATE OR REPLACE FUNCTION app_private.event_scores()
RETURNS TABLE(session_id uuid,league_id uuid,organizer_id uuid,starts_at timestamptz,game text,user_id uuid,bought bigint,final_chips bigint,net bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
WITH purchases AS (
 SELECT p.session_id,p.user_id,sum(p.amount_brl) AS brl,sum(p.chips_received) AS points
 FROM public.session_chip_purchases p GROUP BY p.session_id,p.user_id
), eligible AS (
 SELECT s.*,r.game FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
 WHERE (SELECT auth.uid()) IS NOT NULL AND s.status='finished' AND NOT app_private.is_event_hidden(s.id) AND app_private.may_view_event(s.id)
 AND EXISTS(SELECT 1 FROM public.session_attendance a WHERE a.session_id=s.id)
 AND CASE WHEN s.chip_settlement_brl THEN app_private.cashout_balanced(s.id)
 ELSE NOT EXISTS(
  SELECT 1 FROM public.session_attendance a
  LEFT JOIN purchases p ON p.session_id=a.session_id AND p.user_id=a.user_id
  LEFT JOIN public.session_chip_results f ON f.session_id=a.session_id AND f.user_id=a.user_id
  LEFT JOIN public.session_finance_approvals v ON v.session_id=a.session_id AND v.user_id=a.user_id
  WHERE a.session_id=s.id AND (p.user_id IS NULL OR f.user_id IS NULL OR v.user_id IS NULL)
 ) END
), amounts AS (
 SELECT s.id,s.league_id,s.organizer_id,s.starts_at,s.game,a.user_id,
  round(coalesce(p.brl,0)*100)::bigint AS invested,
  round(100*CASE WHEN s.chip_settlement_brl THEN c.final_brl
   WHEN NOT s.chip_stock_legacy AND EXISTS(SELECT 1 FROM public.session_chip_final_items fi WHERE fi.session_id=s.id AND fi.user_id=a.user_id)
   THEN (SELECT sum(fi.quantity*CASE fi.chip_value WHEN 1 THEN s.chip_price_1_brl WHEN 5 THEN s.chip_price_5_brl WHEN 10 THEN s.chip_price_10_brl WHEN 25 THEN s.chip_price_25_brl ELSE s.chip_price_50_brl END)
         FROM public.session_chip_final_items fi WHERE fi.session_id=s.id AND fi.user_id=a.user_id)
   ELSE f.chips_final*(SELECT sum(pp.brl)/nullif(sum(pp.points),0) FROM purchases pp WHERE pp.session_id=s.id)
  END)::bigint AS returned
 FROM eligible s JOIN public.session_attendance a ON a.session_id=s.id
 LEFT JOIN purchases p ON p.session_id=s.id AND p.user_id=a.user_id
 LEFT JOIN public.session_chip_cashouts c ON c.session_id=s.id AND c.user_id=a.user_id
 LEFT JOIN public.session_chip_results f ON f.session_id=s.id AND f.user_id=a.user_id
)
SELECT id,league_id,organizer_id,starts_at,game,user_id,invested,returned,returned-invested FROM amounts;
$$;
REVOKE ALL ON FUNCTION app_private.event_scores() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION app_private.get_player_stats_period_v2(p_game text DEFAULT NULL::text, p_period text DEFAULT 'geral'::text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_symbol text, game text, sessions_played bigint, net_chips bigint, best_event_chips bigint, avg_chips numeric, avg_yield_pct numeric, last_played_at timestamp with time zone, positive_events bigint, best_yield_pct numeric, max_positive_streak bigint, total_chips_bought bigint, total_chips_final bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH scores AS (
 SELECT e.session_id AS id,e.starts_at,e.game,e.user_id,e.bought,e.final_chips,e.net,
  e.net::numeric/nullif(e.bought,0)*100 AS yield_pct
 FROM app_private.event_scores() e
 WHERE (p_game IS NULL OR e.game=p_game)
 AND (p_period='geral' OR (p_period='mes' AND e.starts_at>=date_trunc('month',now()) AND e.starts_at<date_trunc('month',now())+interval '1 month')
 OR (p_period='ano' AND e.starts_at>=date_trunc('year',now()) AND e.starts_at<date_trunc('year',now())+interval '1 year'))
), numbered AS (
 SELECT s.*,
   row_number() OVER (PARTITION BY s.user_id,s.game ORDER BY s.starts_at,s.id)
   - row_number() OVER (
     PARTITION BY s.user_id,s.game,(s.net>0) ORDER BY s.starts_at,s.id
   ) AS streak_group
 FROM scores s
), runs AS (
 SELECT user_id,game,streak_group,count(*)::bigint AS len
 FROM numbered WHERE net>0 GROUP BY user_id,game,streak_group
), best_run AS (
 SELECT user_id,game,max(len)::bigint AS streak
 FROM runs GROUP BY user_id,game
)
SELECT p.id,p.display_name,p.avatar_symbol,n.game,
 count(*)::bigint,sum(n.net)::bigint,max(n.net)::bigint,
 round(avg(n.net)::numeric,1),round(avg(n.yield_pct),1),max(n.starts_at),
 count(*) FILTER(WHERE n.net>0)::bigint,
 round(max(n.yield_pct),1),COALESCE(max(br.streak),0)::bigint,
 sum(n.bought)::bigint,sum(n.final_chips)::bigint
FROM numbered n JOIN public.profiles p ON p.id=n.user_id
LEFT JOIN best_run br ON br.user_id=n.user_id AND br.game=n.game
GROUP BY p.id,p.display_name,p.avatar_symbol,n.game
ORDER BY round(avg(n.yield_pct),1) DESC NULLS LAST,sum(n.net) DESC;
$function$;

CREATE OR REPLACE FUNCTION app_private.get_player_stats_v2(p_game text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_symbol text, game text, sessions_played bigint, net_chips bigint, best_event_chips bigint, avg_chips numeric, avg_yield_pct numeric, last_played_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
WITH scores AS (
 SELECT e.*,e.net::numeric/nullif(e.bought,0)*100 AS yield_pct
 FROM app_private.event_scores() e WHERE p_game IS NULL OR e.game=p_game
)

SELECT p.id,p.display_name,p.avatar_symbol,s.game,
 count(*)::bigint,sum(s.net)::bigint,max(s.net)::bigint,
 round(avg(s.net)::numeric,1),round(avg(s.yield_pct),1),max(s.starts_at)
FROM scores s JOIN public.profiles p ON p.id=s.user_id
GROUP BY p.id,p.display_name,p.avatar_symbol,s.game
ORDER BY round(avg(s.yield_pct),1) DESC NULLS LAST,sum(s.net) DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_league_ranking_v2(p_league_id uuid)
 RETURNS TABLE(user_id uuid, game text, played bigint, net_chips bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT e.user_id,e.game,count(*)::bigint,sum(e.net)::bigint
 FROM app_private.event_scores() e
 WHERE e.league_id=p_league_id AND (app_private.is_league_member(p_league_id) OR app_private.is_league_owner(p_league_id) OR app_private.is_app_admin())
 GROUP BY e.user_id,e.game;
$function$;
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


-- Idempotent commands: the receipt and business mutation commit together.
CREATE TABLE app_private.mutation_receipts(
 actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_id uuid NOT NULL,kind text NOT NULL,payload jsonb NOT NULL,result_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(actor_id,request_id)
);
ALTER TABLE app_private.mutation_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.mutation_receipts FROM PUBLIC,anon,authenticated;

CREATE FUNCTION app_private.record_chip_purchase_once(p_request_id uuid,p_event_id uuid,p_quantities jsonb,p_user_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $once$
DECLARE v_actor uuid:=(SELECT auth.uid());v_result uuid;v_payload jsonb:=jsonb_build_object('event',p_event_id,'quantities',p_quantities,'user',p_user_id);v_prior app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificador obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||p_request_id::text,0));
 SELECT * INTO v_prior FROM app_private.mutation_receipts WHERE actor_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.kind<>'record_chip_purchase_once' OR v_prior.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Este identificador já pertence a outro lançamento'; END IF;
  RETURN v_prior.result_id;
 END IF;
 v_result:=app_private.record_chip_purchase_for(p_event_id,p_quantities,p_user_id);
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(v_actor,p_request_id,'record_chip_purchase_once',v_payload,v_result);
 RETURN v_result;
END; $once$;
REVOKE ALL ON FUNCTION app_private.record_chip_purchase_once(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.record_chip_purchase_once(uuid,uuid,jsonb,uuid) TO authenticated;
CREATE FUNCTION public.record_chip_purchase_once(p_request_id uuid,p_event_id uuid,p_quantities jsonb,p_user_id uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $once$ SELECT app_private.record_chip_purchase_once(p_request_id,p_event_id,p_quantities,p_user_id); $once$;
REVOKE ALL ON FUNCTION public.record_chip_purchase_once(uuid,uuid,jsonb,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_chip_purchase_once(uuid,uuid,jsonb,uuid) TO authenticated;

CREATE FUNCTION app_private.create_expense_once(p_request_id uuid,p_event_id uuid,p_label text,p_amount numeric,p_category text,p_paid_by uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $once$
DECLARE v_actor uuid:=(SELECT auth.uid());v_result uuid;v_payload jsonb:=jsonb_build_object('event',p_event_id,'label',p_label,'amount',p_amount,'category',p_category,'payer',p_paid_by);v_prior app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificador obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||p_request_id::text,0));
 SELECT * INTO v_prior FROM app_private.mutation_receipts WHERE actor_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.kind<>'create_expense_once' OR v_prior.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Este identificador já pertence a outro lançamento'; END IF;
  RETURN v_prior.result_id;
 END IF;
 IF NOT app_private.can_write_session_private(p_event_id) OR NOT app_private.may_view_event(p_event_id) THEN RAISE EXCEPTION 'Sem permissão para registrar despesas'; END IF;
 IF length(trim(p_label)) NOT BETWEEN 2 AND 180 OR p_amount IS NULL OR p_amount<=0 OR round(p_amount,2)<>p_amount OR p_amount>99999999 THEN RAISE EXCEPTION 'Descrição ou valor inválidos'; END IF;
 INSERT INTO public.session_expenses(session_id,created_by,paid_by,label,amount_brl,category)
 VALUES(p_event_id,v_actor,p_paid_by,trim(p_label),p_amount,p_category) RETURNING id INTO v_result;
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(v_actor,p_request_id,'create_expense_once',v_payload,v_result);
 RETURN v_result;
END; $once$;
REVOKE ALL ON FUNCTION app_private.create_expense_once(uuid,uuid,text,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.create_expense_once(uuid,uuid,text,numeric,text,uuid) TO authenticated;
CREATE FUNCTION public.create_expense_once(p_request_id uuid,p_event_id uuid,p_label text,p_amount numeric,p_category text,p_paid_by uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $once$ SELECT app_private.create_expense_once(p_request_id,p_event_id,p_label,p_amount,p_category,p_paid_by); $once$;
REVOKE ALL ON FUNCTION public.create_expense_once(uuid,uuid,text,numeric,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_expense_once(uuid,uuid,text,numeric,text,uuid) TO authenticated;

CREATE FUNCTION app_private.create_poll_once(p_request_id uuid,p_event_id uuid,p_question text,p_options text[]) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $once$
DECLARE v_actor uuid:=(SELECT auth.uid());v_result uuid;v_payload jsonb:=jsonb_build_object('event',p_event_id,'question',p_question,'options',p_options);v_prior app_private.mutation_receipts%ROWTYPE;
BEGIN
 IF v_actor IS NULL OR p_request_id IS NULL THEN RAISE EXCEPTION 'Autenticação e identificador obrigatórios'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_actor::text||p_request_id::text,0));
 SELECT * INTO v_prior FROM app_private.mutation_receipts WHERE actor_id=v_actor AND request_id=p_request_id;
 IF FOUND THEN
  IF v_prior.kind<>'create_poll_once' OR v_prior.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Este identificador já pertence a outro lançamento'; END IF;
  RETURN v_prior.result_id;
 END IF;
 IF NOT app_private.can_write_session_private(p_event_id) OR NOT app_private.may_view_event(p_event_id) THEN RAISE EXCEPTION 'Sem permissão para criar enquetes'; END IF;
 IF p_question IS NULL OR length(trim(p_question)) NOT BETWEEN 2 AND 200 OR coalesce(cardinality(p_options),0) NOT BETWEEN 2 AND 41
 OR EXISTS(SELECT 1 FROM unnest(p_options) o WHERE o IS NULL OR length(trim(o)) NOT BETWEEN 1 AND 80)
 OR (SELECT count(DISTINCT lower(trim(o))) FROM unnest(p_options) o)<>cardinality(p_options)
 THEN RAISE EXCEPTION 'Informe uma pergunta e de 2 a 41 opções válidas e distintas'; END IF;
 INSERT INTO public.session_polls(session_id,created_by,question) VALUES(p_event_id,v_actor,trim(p_question)) RETURNING id INTO v_result;
 INSERT INTO public.session_poll_options(poll_id,label,position) SELECT v_result,trim(o),(n-1)::integer FROM unnest(p_options) WITH ORDINALITY t(o,n);
 INSERT INTO app_private.mutation_receipts(actor_id,request_id,kind,payload,result_id) VALUES(v_actor,p_request_id,'create_poll_once',v_payload,v_result);
 RETURN v_result;
END; $once$;
REVOKE ALL ON FUNCTION app_private.create_poll_once(uuid,uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.create_poll_once(uuid,uuid,text,text[]) TO authenticated;
CREATE FUNCTION public.create_poll_once(p_request_id uuid,p_event_id uuid,p_question text,p_options text[]) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $once$ SELECT app_private.create_poll_once(p_request_id,p_event_id,p_question,p_options); $once$;
REVOKE ALL ON FUNCTION public.create_poll_once(uuid,uuid,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_poll_once(uuid,uuid,text,text[]) TO authenticated;

CREATE INDEX IF NOT EXISTS purchases_user_session_idx ON public.session_chip_purchases(user_id,session_id);
CREATE INDEX IF NOT EXISTS cashouts_user_session_idx ON public.session_chip_cashouts(user_id,session_id);
CREATE INDEX IF NOT EXISTS results_user_session_idx ON public.session_chip_results(user_id,session_id);
CREATE INDEX IF NOT EXISTS expense_payer_session_idx ON public.session_expenses(paid_by,session_id);
CREATE INDEX IF NOT EXISTS split_members_user_idx ON public.expense_split_members(user_id,expense_id);
CREATE INDEX IF NOT EXISTS split_settlements_user_idx ON public.expense_split_settlements(user_id,session_id);
CREATE INDEX IF NOT EXISTS event_audit_session_time_idx ON public.event_admin_audit(session_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS sessions_organizer_time_idx ON public.sessions(organizer_id,starts_at);
DROP POLICY IF EXISTS approvals_insert_admin ON public.session_finance_approvals;
DROP POLICY IF EXISTS approvals_insert_organizer ON public.session_finance_approvals;
CREATE POLICY approvals_insert_authorized ON public.session_finance_approvals FOR INSERT TO authenticated
WITH CHECK(reviewed_by=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled' AND (s.organizer_id=(SELECT auth.uid()) OR app_private.is_app_admin())));
DROP POLICY IF EXISTS approvals_delete_admin ON public.session_finance_approvals;
DROP POLICY IF EXISTS approvals_delete_organizer ON public.session_finance_approvals;
CREATE POLICY approvals_delete_authorized ON public.session_finance_approvals FOR DELETE TO authenticated
USING(EXISTS(SELECT 1 FROM public.sessions s WHERE s.id=session_id AND s.status='scheduled' AND (app_private.is_app_admin() OR (s.organizer_id=(SELECT auth.uid()) AND reviewed_by=(SELECT auth.uid())))));

-- Small catalog and one atomic snapshot per selected event. SQL remains subject to RLS.
CREATE FUNCTION app_private.visible_live_start(p_event uuid) RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.started_at FROM public.session_live_state l
 WHERE l.session_id=p_event AND app_private.may_view_event(p_event);
$$;
REVOKE ALL ON FUNCTION app_private.visible_live_start(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.visible_live_start(uuid) TO authenticated;
CREATE FUNCTION public.get_club_catalog(p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_event_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH scheduled AS (
 SELECT s.* FROM public.sessions s WHERE s.status='scheduled' ORDER BY s.starts_at,s.id LIMIT 100
), history_window AS (
 SELECT s.* FROM public.sessions s WHERE s.status<>'scheduled'
 AND (p_before IS NULL OR (s.starts_at,s.id)<(p_before,coalesce(p_before_id,'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
 ORDER BY s.starts_at DESC,s.id DESC LIMIT 51
), history AS (SELECT * FROM history_window ORDER BY starts_at DESC,id DESC LIMIT 50),
events AS (SELECT * FROM scheduled UNION SELECT * FROM history UNION SELECT * FROM public.sessions WHERE id=p_event_id UNION SELECT s.* FROM public.sessions s JOIN public.admin_hidden_events h ON h.session_id=s.id),
attendance AS (SELECT a.session_id,a.user_id FROM public.session_attendance a JOIN events e ON e.id=a.session_id),
profile_ids AS (
 SELECT user_id AS id FROM attendance UNION SELECT organizer_id FROM events UNION SELECT auth.uid()
 UNION SELECT m.user_id FROM public.league_members m
)
SELECT jsonb_build_object(
 'rooms',coalesce((SELECT jsonb_agg(r) FROM public.rooms r),'[]'::jsonb),
 'events',coalesce((SELECT jsonb_agg(e ORDER BY starts_at,id) FROM events e),'[]'::jsonb),
 'attendance',coalesce((SELECT jsonb_agg(a) FROM attendance a),'[]'::jsonb),
 'profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_symbol',p.avatar_symbol,'favorite_game',p.favorite_game,'bio',p.bio,'avatar_path',p.avatar_path)) FROM public.profiles p WHERE p.id IN(SELECT id FROM profile_ids)),'[]'::jsonb),
 'live',coalesce((SELECT jsonb_agg(jsonb_build_object('session_id',e.id,'started_at',app_private.visible_live_start(e.id))) FROM events e WHERE app_private.visible_live_start(e.id) IS NOT NULL),'[]'::jsonb),
 'hidden',coalesce((SELECT jsonb_agg(h) FROM public.admin_hidden_events h),'[]'::jsonb),
 'history_more',(SELECT count(*)>50 FROM history_window),
 'history_cursor',(SELECT jsonb_build_object('at',starts_at,'id',id) FROM history ORDER BY starts_at,id LIMIT 1)
);
$$;
REVOKE ALL ON FUNCTION public.get_club_catalog(timestamptz,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_club_catalog(timestamptz,uuid,uuid) TO authenticated;
CREATE FUNCTION public.get_my_splits_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH shares AS(SELECT * FROM public.get_my_expense_splits())
SELECT jsonb_build_object('shares',coalesce((SELECT jsonb_agg(s) FROM shares s),'[]'::jsonb),
 'settlements',coalesce((SELECT jsonb_agg(p) FROM public.expense_split_settlements p WHERE p.expense_id IN(SELECT expense_id FROM shares)),'[]'::jsonb));
$$;
REVOKE ALL ON FUNCTION public.get_my_splits_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_splits_snapshot() TO authenticated;
CREATE FUNCTION public.get_event_snapshot(p_event_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
WITH purchases AS(SELECT * FROM public.session_chip_purchases WHERE session_id=p_event_id),
polls AS(SELECT * FROM public.session_polls WHERE session_id=p_event_id),
attendance AS(SELECT session_id,user_id FROM public.session_attendance WHERE session_id=p_event_id)
SELECT jsonb_build_object(
 'attendance',coalesce((SELECT jsonb_agg(a) FROM attendance a),'[]'::jsonb),
 'profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_symbol',p.avatar_symbol,'favorite_game',p.favorite_game,'bio',p.bio,'avatar_path',p.avatar_path)) FROM public.profiles p WHERE p.id IN(SELECT user_id FROM attendance)),'[]'::jsonb),
 'polls',coalesce((SELECT jsonb_agg(p) FROM polls p),'[]'::jsonb),
 'choices',coalesce((SELECT jsonb_agg(o ORDER BY position) FROM public.session_poll_options o WHERE o.poll_id IN(SELECT id FROM polls)),'[]'::jsonb),
 'votes',coalesce((SELECT jsonb_agg(v) FROM public.session_poll_votes v WHERE v.poll_id IN(SELECT id FROM polls)),'[]'::jsonb),
 'buys',coalesce((SELECT jsonb_agg(p) FROM purchases p),'[]'::jsonb),
 'items',coalesce((SELECT jsonb_agg(i) FROM public.session_chip_purchase_items i WHERE i.purchase_id IN(SELECT id FROM purchases)),'[]'::jsonb),
 'results',coalesce((SELECT jsonb_agg(r) FROM public.session_chip_results r WHERE r.session_id=p_event_id),'[]'::jsonb),
 'expenses',coalesce((SELECT jsonb_agg(x) FROM public.session_expenses x WHERE x.session_id=p_event_id),'[]'::jsonb),
 'members',coalesce((SELECT jsonb_agg(m) FROM public.expense_split_members m WHERE m.session_id=p_event_id),'[]'::jsonb),
 'settlements',coalesce((SELECT jsonb_agg(s) FROM public.expense_split_settlements s WHERE s.session_id=p_event_id),'[]'::jsonb),
 'approvals',coalesce((SELECT jsonb_agg(a) FROM public.session_finance_approvals a WHERE a.session_id=p_event_id),'[]'::jsonb),
 'finals',coalesce((SELECT jsonb_agg(f) FROM public.session_chip_final_items f WHERE f.session_id=p_event_id),'[]'::jsonb),
 'cashouts',coalesce((SELECT jsonb_agg(c) FROM public.session_chip_cashouts c WHERE c.session_id=p_event_id),'[]'::jsonb),
 'payouts',coalesce((SELECT jsonb_agg(p) FROM public.session_chip_payouts p WHERE p.session_id=p_event_id),'[]'::jsonb),
 'seats',coalesce((SELECT jsonb_agg(s) FROM public.session_table_seats s WHERE s.session_id=p_event_id),'[]'::jsonb),
 'live',coalesce((SELECT jsonb_agg(l) FROM public.session_live_state l WHERE l.session_id=p_event_id),'[]'::jsonb),
 'timeline',coalesce((SELECT jsonb_agg(a ORDER BY occurred_at DESC) FROM (SELECT * FROM public.session_live_activity WHERE session_id=p_event_id ORDER BY occurred_at DESC LIMIT 100) a),'[]'::jsonb),
 'finance',coalesce((SELECT jsonb_agg(f) FROM public.get_event_finances(p_event_id) f),'[]'::jsonb),
 'shares',coalesce((SELECT jsonb_agg(s) FROM public.get_expense_split_shares(p_event_id) s),'[]'::jsonb)
);
$$;
REVOKE ALL ON FUNCTION public.get_event_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_event_snapshot(uuid) TO authenticated;

DROP POLICY IF EXISTS live_state_view_private ON public.session_live_state;
CREATE POLICY live_state_view_private ON public.session_live_state FOR SELECT TO authenticated USING(app_private.may_view_event(session_id));

CREATE OR REPLACE FUNCTION public.get_player_stats_v2(p_game text DEFAULT NULL::text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_symbol text, game text, sessions_played bigint, net_chips bigint, best_event_chips bigint, avg_chips numeric, avg_yield_pct numeric, last_played_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT * FROM app_private.get_player_stats_v2(p_game); $function$;
REVOKE ALL ON FUNCTION public.get_player_stats_v2(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_stats_v2(text) TO authenticated;
REVOKE ALL ON FUNCTION app_private.get_player_stats_v2(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_player_stats_v2(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_player_stats_period_v2(p_game text DEFAULT NULL::text, p_period text DEFAULT 'geral'::text)
 RETURNS TABLE(user_id uuid, display_name text, avatar_symbol text, game text, sessions_played bigint, net_chips bigint, best_event_chips bigint, avg_chips numeric, avg_yield_pct numeric, last_played_at timestamp with time zone, positive_events bigint, best_yield_pct numeric, max_positive_streak bigint, total_chips_bought bigint, total_chips_final bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$ SELECT * FROM app_private.get_player_stats_period_v2(p_game,p_period); $function$;
REVOKE ALL ON FUNCTION public.get_player_stats_period_v2(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_stats_period_v2(text,text) TO authenticated;
REVOKE ALL ON FUNCTION app_private.get_player_stats_period_v2(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_player_stats_period_v2(text,text) TO authenticated;

REVOKE ALL ON FUNCTION public.get_league_ranking_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_league_ranking_v2(uuid) TO authenticated;
