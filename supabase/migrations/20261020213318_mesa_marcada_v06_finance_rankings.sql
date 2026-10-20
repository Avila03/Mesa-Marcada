-- Mesa Marcada v0.6 / 002 — lançamentos, despesas e rankings em fichas.
-- Real (BRL) é informativo, sem processamento de pagamento nem conversão em pontos.

create table public.session_chip_purchases (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.sessions(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 chips_received bigint not null check (chips_received>0),
 amount_brl numeric(12,2) not null default 0 check (amount_brl>=0),
 note text not null default '',
 created_at timestamptz not null default now()
);

create table public.session_chip_results (
 session_id uuid not null references public.sessions(id) on delete cascade,
 user_id uuid not null references public.profiles(id),
 chips_final bigint not null check (chips_final>=0),
 updated_at timestamptz not null default now(),
 primary key(session_id,user_id)
);

create table public.session_expenses (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.sessions(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 label text not null check (char_length(btrim(label)) between 2 and 140),
 category text not null default 'other'
  check (category in ('food','drinks','materials','other')),
 amount_brl numeric(12,2) not null check (amount_brl>0),
 created_at timestamptz not null default now()
);

create index chip_purchases_by_session on public.session_chip_purchases(session_id,user_id);
create index expenses_by_session on public.session_expenses(session_id);

-- Entrada e resultado pertencem ao autor; não podem ser transferidos de sessão.
create function public.protect_purchase_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id is distinct from old.id or new.session_id is distinct from old.session_id
 or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at
 then raise exception 'Identidade do lançamento não pode mudar'; end if;
 return new;
end $$;
create trigger purchase_immutable_identity before update on public.session_chip_purchases
for each row execute function public.protect_purchase_identity();

create function public.protect_chip_result_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.session_id is distinct from old.session_id or new.user_id is distinct from old.user_id
 then raise exception 'Identidade do resultado não pode mudar'; end if;
 return new;
end $$;
create trigger result_immutable_identity before update on public.session_chip_results
for each row execute function public.protect_chip_result_identity();

create function public.protect_expense_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id is distinct from old.id or new.session_id is distinct from old.session_id
 or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
 then raise exception 'Identidade da despesa não pode mudar'; end if;
 return new;
end $$;
create trigger expense_immutable_identity before update on public.session_expenses
for each row execute function public.protect_expense_identity();

alter table public.session_chip_purchases enable row level security;
alter table public.session_chip_results enable row level security;
alter table public.session_expenses enable row level security;

create policy purchases_read on public.session_chip_purchases
for select to authenticated using (public.can_view_session_private(session_id));
create policy purchases_insert_self on public.session_chip_purchases
for insert to authenticated with check (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy purchases_update_self on public.session_chip_purchases
for update to authenticated using (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
) with check (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy purchases_delete_self on public.session_chip_purchases
for delete to authenticated using (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
);

create policy results_read on public.session_chip_results
for select to authenticated using (public.can_view_session_private(session_id));
create policy results_insert_self on public.session_chip_results
for insert to authenticated with check (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy results_update_self on public.session_chip_results
for update to authenticated using (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
) with check (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy results_delete_self on public.session_chip_results
for delete to authenticated using (
 user_id=(select auth.uid()) and public.can_write_session_private(session_id)
);

create policy expenses_read on public.session_expenses
for select to authenticated using (public.can_view_session_private(session_id));
create policy expenses_insert_self on public.session_expenses
for insert to authenticated with check (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy expenses_update_self on public.session_expenses
for update to authenticated using (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
) with check (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy expenses_delete_self on public.session_expenses
for delete to authenticated using (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
);

-- Agregação: apenas sessões fechadas com >=2 confirmados e compras + resultado
-- de todos os confirmados. Não mostra valores em R$, somente saldo em fichas.
-- Não compara moedas ou valores; o usuário deve filtrar pela modalidade.
create function public.get_global_ranking(p_game text default null)
returns table (user_id uuid,display_name text,net_chips bigint,sessions_played bigint)
language sql stable security definer set search_path=''
as $$
with purchases as (
 select session_id,user_id,sum(chips_received)::bigint purchased
 from public.session_chip_purchases group by session_id,user_id
), eligible as (
 select s.id
 from public.sessions s
 join public.rooms r on r.id=s.room_id
 where (select auth.uid()) is not null
 and s.status='finished' and (p_game is null or r.game=p_game)
 and (select count(*) from public.session_attendance a where a.session_id=s.id)>=2
 and not exists (
  select 1 from public.session_attendance a
  left join purchases p on p.session_id=a.session_id and p.user_id=a.user_id
  left join public.session_chip_results f
   on f.session_id=a.session_id and f.user_id=a.user_id
  where a.session_id=s.id and (p.user_id is null or f.user_id is null)
 )
), scores as (
 select a.user_id,(f.chips_final-p.purchased)::bigint net
 from eligible e
 join public.session_attendance a on a.session_id=e.id
 join purchases p on p.session_id=a.session_id and p.user_id=a.user_id
 join public.session_chip_results f on f.session_id=a.session_id and f.user_id=a.user_id
)
select pr.id,pr.display_name,sum(sc.net)::bigint,count(*)::bigint
from scores sc join public.profiles pr on pr.id=sc.user_id
group by pr.id,pr.display_name
order by sum(sc.net) desc,count(*) desc,pr.display_name asc;
$$;

revoke all on public.session_chip_purchases, public.session_chip_results,
 public.session_expenses from anon;
grant select,insert,update,delete on public.session_chip_purchases,
 public.session_chip_results,public.session_expenses to authenticated;

revoke all on function public.protect_purchase_identity() from public,anon,authenticated;
revoke all on function public.protect_chip_result_identity() from public,anon,authenticated;
revoke all on function public.protect_expense_identity() from public,anon,authenticated;
revoke all on function public.get_global_ranking(text) from public,anon;
grant execute on function public.get_global_ranking(text) to authenticated;