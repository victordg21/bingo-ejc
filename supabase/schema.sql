-- Bingo EJC — Supabase schema
-- Rode este arquivo inteiro no SQL editor do Supabase (Database → SQL Editor → New query).

-- =========================================
-- TABELAS
-- =========================================

create table if not exists public.game_state (
  id            int primary key check (id = 1),
  called_numbers int[] not null default '{}'::int[],
  last_called   int,
  is_active     boolean not null default true,
  updated_at    timestamptz not null default now()
);

create table if not exists public.buyers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  access_code text not null unique,
  card_codes  int[] not null default '{}'::int[],
  tier        text not null default 'live' check (tier in ('basico','live','premium')),
  created_at  timestamptz not null default now()
);

create index if not exists buyers_access_code_idx on public.buyers (access_code);
create index if not exists buyers_created_at_idx on public.buyers (created_at desc);

-- Singleton row (game_state.id = 1)
insert into public.game_state (id, called_numbers, last_called, is_active)
values (1, '{}'::int[], null, true)
on conflict (id) do nothing;

-- =========================================
-- REALTIME
-- =========================================
alter publication supabase_realtime add table public.game_state;
alter publication supabase_realtime add table public.buyers;

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================
alter table public.game_state enable row level security;
alter table public.buyers     enable row level security;

-- game_state: leitura pública (todos os clientes leem o estado do jogo)
drop policy if exists "game_state read all" on public.game_state;
create policy "game_state read all"
  on public.game_state for select
  using (true);

-- game_state: escrita SOMENTE com service_role (admin via API routes).
-- Não criamos políticas de insert/update/delete → o anon key não consegue escrever.
-- O service_role sempre bypassa RLS, então o admin escreve normalmente.

-- buyers: leitura pública (necessário para validar access_code).
-- Como access_codes têm entropia razoável (~1.6M por prefixo de nome), isso é OK
-- para o caso de festa de igreja. Se quiser endurecer, mude para policy que filtre
-- por access_code igual ao parâmetro recebido — mas o anon flow fica mais chato.
drop policy if exists "buyers read all" on public.buyers;
create policy "buyers read all"
  on public.buyers for select
  using (true);

-- buyers: escrita SOMENTE com service_role (admin cadastra e remove).

-- =========================================
-- HELPER: reset do jogo (chamado pela API admin)
-- =========================================
create or replace function public.reset_game_state()
returns void
language sql
security definer
set search_path = public
as $$
  update public.game_state
     set called_numbers = '{}'::int[],
         last_called = null,
         is_active = true,
         updated_at = now()
   where id = 1;
$$;

revoke all on function public.reset_game_state from public;
-- O admin chama via service_role, então não precisa de GRANT explícito.
