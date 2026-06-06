-- Kalum's World — Supabase schema
-- Public arcade game: anonymous players, no accounts. We expose read + write
-- to the anon role behind permissive RLS policies (low-stakes leaderboard).

create table if not exists public.kalum_leaderboard (
  name_key text primary key,
  display_name text not null,
  score integer not null default 0,
  level integer not null default 1,
  coins integer not null default 0,
  cores integer not null default 0,
  distance numeric not null default 0,
  survived_seconds numeric not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists kalum_leaderboard_score_idx
  on public.kalum_leaderboard (score desc);

create table if not exists public.kalum_saves (
  name_key text primary key,
  display_name text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.kalum_leaderboard enable row level security;
alter table public.kalum_saves enable row level security;

-- Leaderboard policies
drop policy if exists kalum_lb_read on public.kalum_leaderboard;
drop policy if exists kalum_lb_insert on public.kalum_leaderboard;
drop policy if exists kalum_lb_update on public.kalum_leaderboard;
create policy kalum_lb_read on public.kalum_leaderboard for select using (true);
create policy kalum_lb_insert on public.kalum_leaderboard for insert with check (true);
create policy kalum_lb_update on public.kalum_leaderboard for update using (true) with check (true);

-- Save policies
drop policy if exists kalum_save_read on public.kalum_saves;
drop policy if exists kalum_save_insert on public.kalum_saves;
drop policy if exists kalum_save_update on public.kalum_saves;
create policy kalum_save_read on public.kalum_saves for select using (true);
create policy kalum_save_insert on public.kalum_saves for insert with check (true);
create policy kalum_save_update on public.kalum_saves for update using (true) with check (true);
