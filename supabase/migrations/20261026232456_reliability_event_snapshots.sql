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
