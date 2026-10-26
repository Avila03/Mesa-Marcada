-- Evita recursão RLS sessions -> event_invite_members -> sessions.
-- Uma função SECURITY DEFINER encapsula somente a consulta aos convites
-- do próprio usuário, sem conceder acesso a linhas de terceiros.
CREATE OR REPLACE FUNCTION app_private.is_my_event_invite(p_session uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.event_invite_members m
  WHERE m.session_id=p_session AND m.user_id=(SELECT auth.uid())
 );
$$;
REVOKE ALL ON FUNCTION app_private.is_my_event_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION app_private.is_my_event_invite(uuid) TO authenticated;

DROP POLICY IF EXISTS sessions_select_authorized ON public.sessions;
CREATE POLICY sessions_select_authorized ON public.sessions
 FOR SELECT TO authenticated
 USING (
  (SELECT auth.uid()) IS NOT NULL
  AND (
   app_private.is_app_admin()
   OR (
    NOT app_private.is_event_hidden(id)
    AND (
     CASE WHEN league_id IS NOT NULL THEN
      (app_private.is_league_member(league_id) OR app_private.is_league_owner(league_id))
     ELSE
      (visibility='public'
       OR organizer_id=(SELECT auth.uid())
       OR app_private.is_my_event_invite(id))
     END
    )
   )
  )
 );
