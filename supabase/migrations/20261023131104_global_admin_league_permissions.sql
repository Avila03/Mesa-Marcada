-- The existing global administrator is also a league administrator.
CREATE OR REPLACE FUNCTION app_private.is_league_owner(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
  app_private.is_app_admin() OR EXISTS (
   SELECT 1 FROM public.leagues l
   WHERE l.id=p_id AND l.owner_id=(SELECT auth.uid())
  )
 );
$$;
REVOKE ALL ON FUNCTION app_private.is_league_owner(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.is_league_owner(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION app_private.can_organize_league(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND (
  app_private.is_app_admin() OR EXISTS (
   SELECT 1 FROM public.league_members m
   WHERE m.league_id=p_id AND m.user_id=(SELECT auth.uid())
   AND m.role IN ('owner','organizer')
  )
 );
$$;
REVOKE ALL ON FUNCTION app_private.can_organize_league(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.can_organize_league(uuid) TO authenticated;
