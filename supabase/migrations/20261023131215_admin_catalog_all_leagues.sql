CREATE OR REPLACE FUNCTION public.get_league_catalog_final()
RETURNS TABLE(
 id uuid,owner_id uuid,name text,description text,rules text,visibility text,
 created_at timestamptz,member_count bigint,event_count bigint,my_role text,
 request_status text,emblem jsonb,finished_at timestamptz,final_summary jsonb
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT l.id,l.owner_id,l.name,l.description,l.rules,l.visibility,l.created_at,
  (SELECT count(*) FROM public.league_members m WHERE m.league_id=l.id),
  (SELECT count(*) FROM public.sessions s WHERE s.league_id=l.id AND s.status<>'cancelled'
   AND NOT app_private.is_event_hidden(s.id)),
  (SELECT m.role FROM public.league_members m
   WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())),
  (SELECT q.status FROM public.league_requests q
   WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid())),
  l.emblem,l.finished_at,
  CASE WHEN l.owner_id=(SELECT auth.uid()) OR app_private.is_league_member(l.id)
   OR app_private.is_app_admin()
  THEN archive.summary ELSE NULL END
 FROM public.leagues l
 LEFT JOIN app_private.league_final_reports archive ON archive.league_id=l.id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND (app_private.is_app_admin() OR l.visibility='public' OR l.owner_id=(SELECT auth.uid()) OR
  EXISTS(SELECT 1 FROM public.league_members m WHERE m.league_id=l.id AND m.user_id=(SELECT auth.uid())) OR
  EXISTS(SELECT 1 FROM public.league_requests q WHERE q.league_id=l.id AND q.user_id=(SELECT auth.uid()) AND q.status='pending'))
 ORDER BY l.created_at DESC LIMIT 150;
$$;
REVOKE ALL ON FUNCTION public.get_league_catalog_final() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_league_catalog_final() TO authenticated;
