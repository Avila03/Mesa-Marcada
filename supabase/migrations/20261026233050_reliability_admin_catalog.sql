-- Preserve the full administrator directory and summary without loading individual purchases.
CREATE OR REPLACE FUNCTION public.get_club_catalog(p_before timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL,p_event_id uuid DEFAULT NULL)
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
 UNION SELECT q.user_id FROM public.league_requests q
)
SELECT jsonb_build_object(
 'rooms',coalesce((SELECT jsonb_agg(r) FROM public.rooms r),'[]'::jsonb),
 'events',coalesce((SELECT jsonb_agg(e ORDER BY starts_at,id) FROM events e),'[]'::jsonb),
 'attendance',coalesce((SELECT jsonb_agg(a) FROM attendance a),'[]'::jsonb),
 'profiles',coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'display_name',p.display_name,'avatar_symbol',p.avatar_symbol,'favorite_game',p.favorite_game,'bio',p.bio,'avatar_path',p.avatar_path)) FROM public.profiles p WHERE p.id IN(SELECT id FROM profile_ids) OR (SELECT app_private.is_app_admin())),'[]'::jsonb),
 'live',coalesce((SELECT jsonb_agg(jsonb_build_object('session_id',e.id,'started_at',app_private.visible_live_start(e.id))) FROM events e WHERE app_private.visible_live_start(e.id) IS NOT NULL),'[]'::jsonb),
 'admin_finance',coalesce((SELECT jsonb_agg(f) FROM (SELECT p.session_id,count(*) FILTER(WHERE p.payment_status<>'paid') AS pending,coalesce(sum(p.amount_brl),0) AS total_brl FROM public.session_chip_purchases p WHERE (SELECT app_private.is_app_admin()) GROUP BY p.session_id) f),'[]'::jsonb),
 'hidden',coalesce((SELECT jsonb_agg(h) FROM public.admin_hidden_events h),'[]'::jsonb),
 'history_more',(SELECT count(*)>50 FROM history_window),
 'history_cursor',(SELECT jsonb_build_object('at',starts_at,'id',id) FROM history ORDER BY starts_at,id LIMIT 1)
);
$$;
REVOKE ALL ON FUNCTION public.get_club_catalog(timestamptz,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_club_catalog(timestamptz,uuid,uuid) TO authenticated;
