-- Game Catalogue setup for the combined GitHub Pages site.
-- This file creates only public.games and public.game_platforms.
-- It does not create, alter, drop or otherwise change public.calendar_entries.

begin;

create table if not exists public.game_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  my_score smallint not null check (my_score between 1 and 10),
  metacritic_score smallint check (metacritic_score between 0 and 100),
  platform text not null,
  status text not null default 'Backlog' check (status in ('Backlog', 'Playing', 'Completed', 'Paused')),
  cover_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists games_name_idx on public.games (name);
create index if not exists games_platform_idx on public.games (platform);
create index if not exists games_status_idx on public.games (status);
create index if not exists games_created_at_idx on public.games (created_at desc);

insert into public.game_platforms (name, sort_order)
values
  ('Switch', 10),
  ('PS5', 20),
  ('PS4', 30)
on conflict (name) do nothing;

alter table public.game_platforms enable row level security;
alter table public.games enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.game_platforms to anon, authenticated;
grant select, insert, update, delete on public.games to anon, authenticated;

drop policy if exists "game_platforms_public_select" on public.game_platforms;
drop policy if exists "game_platforms_public_insert" on public.game_platforms;
drop policy if exists "game_platforms_public_update" on public.game_platforms;
drop policy if exists "game_platforms_public_delete" on public.game_platforms;

create policy "game_platforms_public_select"
on public.game_platforms
for select
to anon, authenticated
using (true);

create policy "game_platforms_public_insert"
on public.game_platforms
for insert
to anon, authenticated
with check (true);

create policy "game_platforms_public_update"
on public.game_platforms
for update
to anon, authenticated
using (true)
with check (true);

create policy "game_platforms_public_delete"
on public.game_platforms
for delete
to anon, authenticated
using (true);

drop policy if exists "games_public_select" on public.games;
drop policy if exists "games_public_insert" on public.games;
drop policy if exists "games_public_update" on public.games;
drop policy if exists "games_public_delete" on public.games;

create policy "games_public_select"
on public.games
for select
to anon, authenticated
using (true);

create policy "games_public_insert"
on public.games
for insert
to anon, authenticated
with check (true);

create policy "games_public_update"
on public.games
for update
to anon, authenticated
using (true)
with check (true);

create policy "games_public_delete"
on public.games
for delete
to anon, authenticated
using (true);

commit;
