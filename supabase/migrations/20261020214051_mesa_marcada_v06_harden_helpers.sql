-- Mesa Marcada: restringe funções de autorização ao esquema não exposto.
-- As policies RLS seguem as funções pelo OID quando ALTER FUNCTION SET SCHEMA é aplicado.

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

alter function public.is_confirmed_attendee(uuid) set schema app_private;
alter function public.can_view_session_private(uuid) set schema app_private;
alter function public.can_write_session_private(uuid) set schema app_private;

create or replace function app_private.can_write_session_private(p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select app_private.is_confirmed_attendee(p_session) and exists (
  select 1 from public.sessions s
  where s.id=p_session and s.status='scheduled'
 )
$$;

revoke all on function app_private.is_confirmed_attendee(uuid) from public,anon;
revoke all on function app_private.can_view_session_private(uuid) from public,anon;
revoke all on function app_private.can_write_session_private(uuid) from public,anon;
grant execute on function app_private.is_confirmed_attendee(uuid) to authenticated;
grant execute on function app_private.can_view_session_private(uuid) to authenticated;
grant execute on function app_private.can_write_session_private(uuid) to authenticated;