-- Mesa Marcada v1.5 — ranking por período e estatísticas auditáveis.
-- Datas e rankings vêm apenas de sessões finished, com todas as
-- compras/resultados revisados. Eventos excluídos são ignorados.

-- Corrige ranking legado para não contabilizar eventos ocultados.
CREATE OR REPLACE FUNCTION app_private.get_player_stats(p_game text DEFAULT NULL)
RETURNS TABLE(
  user_id uuid, display_name text, avatar_symbol text,game text,
  sessions_played bigint,net_chips bigint,best_event_chips bigint,
  avg_chips numeric,avg_yield_pct numeric,last_played_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH bought AS (
 SELECT b.session_id,b.user_id,sum(b.chips_received)::bigint AS chips
 FROM public.session_chip_purchases b GROUP BY b.session_id,b.user_id
), eligible AS (
 SELECT s.id,s.starts_at,r.game
 FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND s.status='finished' AND NOT app_private.is_event_hidden(s.id)
 AND (p_game IS NULL OR r.game=p_game)
 AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=1
 AND NOT EXISTS(
   SELECT 1 FROM public.session_attendance a
   LEFT JOIN bought b ON b.session_id=a.session_id AND b.user_id=a.user_id
   LEFT JOIN public.session_chip_results f
     ON f.session_id=a.session_id AND f.user_id=a.user_id
   LEFT JOIN public.session_finance_approvals v
     ON v.session_id=a.session_id AND v.user_id=a.user_id
   WHERE a.session_id=s.id
     AND (b.user_id IS NULL OR f.user_id IS NULL OR v.user_id IS NULL)
 )
), scores AS (
 SELECT a.user_id,e.game,e.starts_at,
   (f.chips_final-b.chips)::bigint AS net,
   (f.chips_final-b.chips)::numeric/nullif(b.chips,0)*100 AS yield_pct
 FROM eligible e
 JOIN public.session_attendance a ON a.session_id=e.id
 JOIN bought b ON b.session_id=e.id AND b.user_id=a.user_id
 JOIN public.session_chip_results f ON f.session_id=e.id AND f.user_id=a.user_id
)
SELECT p.id,p.display_name,p.avatar_symbol,s.game,
 count(*)::bigint,sum(s.net)::bigint,max(s.net)::bigint,
 round(avg(s.net)::numeric,1),round(avg(s.yield_pct),1),max(s.starts_at)
FROM scores s JOIN public.profiles p ON p.id=s.user_id
GROUP BY p.id,p.display_name,p.avatar_symbol,s.game
ORDER BY round(avg(s.yield_pct),1) DESC NULLS LAST,sum(s.net) DESC;
$$;

-- Interface de histórico e temporadas, sem informações privadas
-- sobre lançamentos de pessoas individuais.
CREATE FUNCTION app_private.get_player_stats_period(
 p_game text DEFAULT NULL,p_period text DEFAULT 'geral'
)
RETURNS TABLE(
 user_id uuid,display_name text,avatar_symbol text,game text,
 sessions_played bigint,net_chips bigint,best_event_chips bigint,
 avg_chips numeric,avg_yield_pct numeric,last_played_at timestamptz,
 positive_events bigint,best_yield_pct numeric,max_positive_streak bigint,
 total_chips_bought bigint,total_chips_final bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $$
WITH bought AS (
 SELECT b.session_id,b.user_id,sum(b.chips_received)::bigint AS chips
 FROM public.session_chip_purchases b GROUP BY b.session_id,b.user_id
), eligible AS (
 SELECT s.id,s.starts_at,r.game
 FROM public.sessions s JOIN public.rooms r ON r.id=s.room_id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND s.status='finished' AND NOT app_private.is_event_hidden(s.id)
 AND (p_game IS NULL OR r.game=p_game)
 AND (p_period='geral' OR
   (p_period='mes' AND s.starts_at >= date_trunc('month',now())
     AND s.starts_at < date_trunc('month',now())+interval '1 month') OR
   (p_period='ano' AND s.starts_at >= date_trunc('year',now())
     AND s.starts_at < date_trunc('year',now())+interval '1 year'))
 AND (SELECT count(*) FROM public.session_attendance a WHERE a.session_id=s.id)>=1
 AND NOT EXISTS(
   SELECT 1 FROM public.session_attendance a
   LEFT JOIN bought b ON b.session_id=a.session_id AND b.user_id=a.user_id
   LEFT JOIN public.session_chip_results f
     ON f.session_id=a.session_id AND f.user_id=a.user_id
   LEFT JOIN public.session_finance_approvals v
     ON v.session_id=a.session_id AND v.user_id=a.user_id
   WHERE a.session_id=s.id
     AND (b.user_id IS NULL OR f.user_id IS NULL OR v.user_id IS NULL)
 )
), scores AS (
 SELECT a.user_id,e.game,e.id,e.starts_at,
   b.chips AS bought,f.chips_final AS final_chips,
   (f.chips_final-b.chips)::bigint AS net,
   (f.chips_final-b.chips)::numeric/nullif(b.chips,0)*100 AS yield_pct
 FROM eligible e
 JOIN public.session_attendance a ON a.session_id=e.id
 JOIN bought b ON b.session_id=e.id AND b.user_id=a.user_id
 JOIN public.session_chip_results f ON f.session_id=e.id AND f.user_id=a.user_id
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
$$;
REVOKE ALL ON FUNCTION app_private.get_player_stats_period(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.get_player_stats_period(text,text) TO authenticated;
CREATE FUNCTION public.get_player_stats_period(
 p_game text DEFAULT NULL,p_period text DEFAULT 'geral'
)
RETURNS TABLE(
 user_id uuid,display_name text,avatar_symbol text,game text,
 sessions_played bigint,net_chips bigint,best_event_chips bigint,
 avg_chips numeric,avg_yield_pct numeric,last_played_at timestamptz,
 positive_events bigint,best_yield_pct numeric,max_positive_streak bigint,
 total_chips_bought bigint,total_chips_final bigint
)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=''
AS $$ SELECT * FROM app_private.get_player_stats_period(p_game,p_period); $$;
REVOKE ALL ON FUNCTION public.get_player_stats_period(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_player_stats_period(text,text) TO authenticated;
