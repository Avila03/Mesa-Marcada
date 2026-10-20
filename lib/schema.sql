-- ESBOÇO PARA PRÓXIMA ETAPA. NÃO EXECUTAR EM PRODUÇÃO SEM POLÍTICAS RLS.
-- O MVP entregue nesta etapa é um protótipo local, não conectado ao Supabase.
-- Preparação do modelo inicial de dados — sujeito a revisão e implantação segura.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  game text not null check (game in ('Poker','Blackjack')),
  description text not null default '',
  archived boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  title text not null,
  scheduled_at timestamptz not null,
  location text not null,
  organizer_id uuid not null references public.profiles(id),
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists public.session_participants (
  session_id uuid not null references public.sessions(id),
  user_id uuid not null references public.profiles(id),
  attendance text not null default 'invited',
  primary key (session_id,user_id)
);

create table if not exists public.session_entries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  user_id uuid not null references public.profiles(id),
  kind text not null check (kind in ('BRL','points')),
  amount numeric(14,2) not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.session_expenses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  label text not null,
  amount_brl numeric(14,2) not null check (amount_brl > 0),
  paid_by uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.expense_shares (
  expense_id uuid not null references public.session_expenses(id),
  user_id uuid not null references public.profiles(id),
  primary key(expense_id,user_id)
);

-- Antes de conectar o frontend real:
-- 1. Habilitar RLS em todas as tabelas e criar policies de participação.
-- 2. Validar identidade pelo auth.uid(), jamais aceitar user_id arbitrário.
-- 3. Impedir criação de sessões em salas arquivadas no banco/servidor.
-- 4. Implementar um mecanismo de rateio com centavos e arredondamento consistente.
-- 5. Revisar legalmente o escopo de dados monetários relacionados a jogos.

-- V0.3: modelo proposto para guardar compras e fichas finais de uma sessão.
-- Estritamente informativo; não representa pagamentos ou apostas executadas.
-- RLS obrigatório ANTES da conexão com a aplicação, especialmente por sessão.

create table if not exists public.session_chip_purchases (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  user_id uuid not null references public.profiles(id),
  chips_received bigint not null check (chips_received > 0),
  amount_brl numeric(14,2) not null default 0 check (amount_brl >= 0),
  note text not null default '',
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.session_chip_results (
  session_id uuid not null references public.sessions(id),
  user_id uuid not null references public.profiles(id),
  chips_final bigint not null check (chips_final >= 0),
  recorded_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Produção: validar que user_id está entre os participantes daquela sessão;
-- só contabilizar ranking geral com sessões encerradas + compras + resultado final;
-- agrupar por user_id, nunca por display_name. Proteger status de fechamento
-- e alterações em registros de outros jogadores por regras de servidor.
-- A classificação ordena: SUM(chips_final - SUM(chips_received por sessão)).
-- A query efetiva deverá agregar compras por sessão antes do join com resultados,
-- para não multiplicar chips_final em sessões com múltiplas recargas.

-- V0.4: campos e tabelas propostos; NÃO executar antes de Auth + RLS + transações.
-- Sessão: adicionar min_entry_brl numeric(14,2) >= 0 e max_participants integer > 0.
-- Confirmação: cada auth.uid() confirma somente a própria presença; servidor
-- verifica capacidade com bloqueio transacional (limite de vagas sem race condition).
-- Nunca permitir ao cliente escolher user_id de outra pessoa.
-- Enquetes de consumo: somente vinculadas a sessões existentes.
create table if not exists public.session_polls (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id),
  question text not null,
  created_by uuid not null references public.profiles(id),
  is_closed boolean not null default false,
  created_at timestamptz not null default now()
);
create table if not exists public.session_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.session_polls(id) on delete cascade,
  label text not null,
  position smallint not null,
  unique (poll_id, position),
  unique (poll_id, id)
);
create table if not exists public.session_poll_votes (
  poll_id uuid not null references public.session_polls(id) on delete cascade,
  option_id uuid not null,
  user_id uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id),
  foreign key (poll_id, option_id) references public.session_poll_options (poll_id, id)
);
-- Produção: votar apenas se user_id = auth.uid() e presença confirmada;
-- 1 voto por enquete, podendo atualizar; bloquear votação encerrada;
-- criar/encerrar enquete conforme política de autorização definida no backend.
