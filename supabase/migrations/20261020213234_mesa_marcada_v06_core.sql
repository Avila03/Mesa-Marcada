-- Mesa Marcada v0.6 / 001 — autenticação, salas, sessões, presença e enquetes.
-- Banco compartilhado; todos os dados privados exigem RLS. Não processa apostas/pagamentos.

create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check (char_length(btrim(display_name)) between 2 and 64),
 created_at timestamptz not null default now()
);

create function public.create_profile_on_signup()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_name text;
begin
 v_name:=btrim(coalesce(new.raw_user_meta_data->>'display_name',''));
 if char_length(v_name)<2 then v_name:='Jogador'; end if;
 insert into public.profiles(id,display_name) values(new.id,left(v_name,64))
 on conflict(id) do nothing;
 return new;
end $$;
create trigger create_profile_after_auth_signup
after insert on auth.users for each row execute function public.create_profile_on_signup();

insert into public.profiles(id,display_name)
select id,'Jogador' from auth.users on conflict(id) do nothing;

create table public.rooms (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(btrim(name)) between 2 and 90),
 game text not null check (game in ('poker','blackjack')),
 description text not null default '',
 status text not null default 'active' check (status in ('active','archived')),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);

create table public.sessions (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id),
 organizer_id uuid not null references public.profiles(id),
 title text not null check (char_length(btrim(title)) between 2 and 100),
 starts_at timestamptz not null,
 location text not null check (char_length(btrim(location)) between 2 and 200),
 min_entry_brl numeric(12,2) not null default 0 check (min_entry_brl >= 0),
 max_participants integer not null default 10 check (max_participants between 1 and 500),
 status text not null default 'scheduled' check (status in ('scheduled','finished','cancelled')),
 created_at timestamptz not null default now()
);

create table public.session_attendance (
 session_id uuid not null references public.sessions(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 confirmed_at timestamptz not null default now(),
 primary key (session_id,user_id)
);

create table public.session_polls (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.sessions(id) on delete cascade,
 created_by uuid not null references public.profiles(id),
 question text not null check (char_length(btrim(question)) between 2 and 200),
 is_closed boolean not null default false,
 created_at timestamptz not null default now()
);

create table public.session_poll_options (
 id uuid primary key default gen_random_uuid(),
 poll_id uuid not null references public.session_polls(id) on delete cascade,
 label text not null check (char_length(btrim(label)) between 1 and 80),
 position smallint not null check (position between 0 and 40),
 unique (poll_id,id),
 unique (poll_id,position)
);

create table public.session_poll_votes (
 poll_id uuid not null references public.session_polls(id) on delete cascade,
 option_id uuid not null,
 user_id uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key (poll_id,user_id),
 foreign key (poll_id,option_id)
   references public.session_poll_options(poll_id,id) on delete cascade
);

create index sessions_room_time_idx on public.sessions(room_id,starts_at);
create index attendance_user_idx on public.session_attendance(user_id);
create index session_polls_session_idx on public.session_polls(session_id);

-- Helpers: os critérios dependem sempre do usuário autenticado do JWT.
create function public.is_confirmed_attendee(p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and exists (
  select 1 from public.session_attendance a
  where a.session_id=p_session and a.user_id=(select auth.uid())
 )
$$;

create function public.can_view_session_private(p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select (select auth.uid()) is not null and (
  exists (select 1 from public.session_attendance a
   where a.session_id=p_session and a.user_id=(select auth.uid()))
  or exists (select 1 from public.sessions s
   where s.id=p_session and s.organizer_id=(select auth.uid()))
 )
$$;

create function public.can_write_session_private(p_session uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select public.is_confirmed_attendee(p_session) and exists (
   select 1 from public.sessions s where s.id=p_session and s.status='scheduled'
 )
$$;

-- Bloqueio transacional evita duas confirmações ocuparem a última vaga.
create function public.check_attendance_capacity()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_max int; v_status text; v_count int;
begin
 select max_participants,status into v_max,v_status
 from public.sessions where id=new.session_id for update;
 if not found then raise exception 'Sessão não encontrada'; end if;
 if v_status<>'scheduled' then raise exception 'Sessão indisponível para confirmação'; end if;
 select count(*) into v_count from public.session_attendance a where a.session_id=new.session_id;
 if v_count>=v_max then raise exception 'Vagas esgotadas'; end if;
 return new;
end $$;
create trigger enforce_attendance_capacity before insert on public.session_attendance
for each row execute function public.check_attendance_capacity();

create function public.clear_votes_after_leaving()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 delete from public.session_poll_votes v using public.session_polls p
 where v.poll_id=p.id and p.session_id=old.session_id and v.user_id=old.user_id;
 return old;
end $$;
create trigger remove_votes_when_leaving after delete on public.session_attendance
for each row execute function public.clear_votes_after_leaving();

create function public.protect_room_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id is distinct from old.id or new.created_by is distinct from old.created_by
 or new.created_at is distinct from old.created_at then
 raise exception 'Autoria histórica da sala não pode ser modificada'; end if;
 return new;
end $$;
create trigger room_immutable_identity before update on public.rooms
for each row execute function public.protect_room_identity();

create function public.protect_session_identity()
returns trigger language plpgsql set search_path=''
as $$
declare v_count integer;
begin
 if new.id is distinct from old.id or new.room_id is distinct from old.room_id
 or new.organizer_id is distinct from old.organizer_id or new.created_at is distinct from old.created_at
 then raise exception 'Identidade da sessão não pode ser modificada'; end if;
 -- Uma mudança de data precisa do fluxo futuro de reconfirmação.
 if new.starts_at is distinct from old.starts_at
 then raise exception 'Alteração de data exige reconfirmação; recurso ainda não implementado'; end if;
 if old.status<>'scheduled' and new is distinct from old
 then raise exception 'Sessão finalizada/cancelada é imutável'; end if;
 select count(*) into v_count from public.session_attendance a where a.session_id=new.id;
 if new.max_participants<v_count then
 raise exception 'Limite menor que confirmações existentes'; end if;
 return new;
end $$;
create trigger session_immutable_identity before update on public.sessions
for each row execute function public.protect_session_identity();

create function public.protect_poll_identity()
returns trigger language plpgsql set search_path=''
as $$
begin
 if new.id is distinct from old.id or new.session_id is distinct from old.session_id
 or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
 then raise exception 'Identidade da enquete não pode ser modificada'; end if;
 if old.is_closed then raise exception 'Enquete encerrada é imutável'; end if;
 return new;
end $$;
create trigger poll_immutable_identity before update on public.session_polls
for each row execute function public.protect_poll_identity();

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.sessions enable row level security;
alter table public.session_attendance enable row level security;
alter table public.session_polls enable row level security;
alter table public.session_poll_options enable row level security;
alter table public.session_poll_votes enable row level security;

create policy profiles_select_authenticated on public.profiles
for select to authenticated using (true);
create policy profiles_update_self on public.profiles
for update to authenticated using (id=(select auth.uid()))
with check (id=(select auth.uid()));

create policy rooms_select_authenticated on public.rooms
for select to authenticated using (true);
create policy rooms_insert_self on public.rooms
for insert to authenticated with check (created_by=(select auth.uid()));
create policy rooms_update_creator on public.rooms
for update to authenticated using (created_by=(select auth.uid()))
with check (created_by=(select auth.uid()));

create policy sessions_select_authenticated on public.sessions
for select to authenticated using (true);
create policy sessions_insert_organizer on public.sessions
for insert to authenticated with check (
 organizer_id=(select auth.uid())
 and exists(select 1 from public.rooms r where r.id=room_id and r.status='active')
);
create policy sessions_update_organizer on public.sessions
for update to authenticated using (organizer_id=(select auth.uid()))
with check (organizer_id=(select auth.uid()));

create policy attendance_select_authenticated on public.session_attendance
for select to authenticated using (true);
create policy attendance_insert_self on public.session_attendance
for insert to authenticated with check (user_id=(select auth.uid()));
create policy attendance_delete_self on public.session_attendance
for delete to authenticated using (
 user_id=(select auth.uid()) and exists (
  select 1 from public.sessions s where s.id=session_id and s.status='scheduled'
 )
);

create policy polls_select_authorized on public.session_polls
for select to authenticated using (public.can_view_session_private(session_id));
create policy polls_insert_attendee on public.session_polls
for insert to authenticated with check (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
);
create policy polls_update_creator on public.session_polls
for update to authenticated using (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
) with check (
 created_by=(select auth.uid()) and public.can_write_session_private(session_id)
);

create policy poll_options_select_authorized on public.session_poll_options
for select to authenticated using (
 exists (select 1 from public.session_polls p
 where p.id=poll_id and public.can_view_session_private(p.session_id))
);
create policy poll_options_insert_creator on public.session_poll_options
for insert to authenticated with check (
 exists (select 1 from public.session_polls p where p.id=poll_id
 and p.created_by=(select auth.uid()) and not p.is_closed
 and public.can_write_session_private(p.session_id))
);

create policy poll_votes_select_authorized on public.session_poll_votes
for select to authenticated using (
 exists (select 1 from public.session_polls p
 where p.id=poll_id and public.can_view_session_private(p.session_id))
);
create policy poll_votes_insert_self on public.session_poll_votes
for insert to authenticated with check (
 user_id=(select auth.uid()) and exists (
 select 1 from public.session_polls p where p.id=poll_id and not p.is_closed
 and public.can_write_session_private(p.session_id))
);
create policy poll_votes_update_self on public.session_poll_votes
for update to authenticated using (user_id=(select auth.uid()))
with check (
 user_id=(select auth.uid()) and exists (
 select 1 from public.session_polls p where p.id=poll_id and not p.is_closed
 and public.can_write_session_private(p.session_id))
);
create policy poll_votes_delete_self on public.session_poll_votes
for delete to authenticated using (user_id=(select auth.uid()));

revoke all on function public.is_confirmed_attendee(uuid) from public, anon;
revoke all on function public.can_view_session_private(uuid) from public, anon;
revoke all on function public.can_write_session_private(uuid) from public, anon;
grant execute on function public.is_confirmed_attendee(uuid) to authenticated;
grant execute on function public.can_view_session_private(uuid) to authenticated;
grant execute on function public.can_write_session_private(uuid) to authenticated;

revoke all on function public.create_profile_on_signup() from public, anon, authenticated;
revoke all on function public.check_attendance_capacity() from public, anon, authenticated;
revoke all on function public.clear_votes_after_leaving() from public, anon, authenticated;
revoke all on function public.protect_room_identity() from public, anon, authenticated;
revoke all on function public.protect_session_identity() from public, anon, authenticated;
revoke all on function public.protect_poll_identity() from public, anon, authenticated;

revoke all on public.profiles,public.rooms,public.sessions,public.session_attendance,
 public.session_polls,public.session_poll_options,public.session_poll_votes from anon;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.rooms,public.sessions,public.session_polls,
 public.session_poll_votes to authenticated;
grant select,insert,delete on public.session_attendance to authenticated;
grant select,insert on public.session_poll_options to authenticated;
grant delete on public.session_poll_votes to authenticated;