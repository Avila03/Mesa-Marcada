-- Mesa Marcada v0.6 — ranking por RPC invoker sem SECURITY DEFINER exposto em public.
-- A rotina com privilégios elevados fica no esquema privado, não exposto via REST.
alter function public.get_global_ranking(text) set schema app_private;

revoke all on function app_private.get_global_ranking(text) from public, anon;
grant execute on function app_private.get_global_ranking(text) to authenticated;

create function public.get_global_ranking(p_game text default null)
returns table(
  user_id uuid,
  display_name text,
  net_chips bigint,
  sessions_played bigint
)
language sql stable security invoker set search_path=''
as $$
  select p.user_id, p.display_name, p.net_chips, p.sessions_played
  from app_private.get_global_ranking(p_game) p;
$$;

revoke all on function public.get_global_ranking(text) from public, anon;
grant execute on function public.get_global_ranking(text) to authenticated;