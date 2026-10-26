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
