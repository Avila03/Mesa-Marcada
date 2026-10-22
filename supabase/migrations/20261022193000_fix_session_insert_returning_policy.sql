-- Mesa Marcada · correção de criação de eventos em ligas para usuários sem cargo de admin.
-- INSERT ... RETURNING id também valida a política SELECT de sessions.
-- A política antiga chamava may_view_event(id), que fazia SELECT da mesma tabela,
-- invisível no snapshot da própria instrução de inserção para não-administradores.
-- Avaliar as colunas da própria linha evita esse problema sem afrouxar o acesso.
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
      (
       visibility='public'
       OR organizer_id=(SELECT auth.uid())
       OR EXISTS(
        SELECT 1 FROM public.event_invite_members m
        WHERE m.session_id=sessions.id AND m.user_id=(SELECT auth.uid())
       )
      )
     END
    )
   )
  )
 );
