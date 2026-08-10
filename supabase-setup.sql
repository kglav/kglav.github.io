-- Keith & Jah Family Calendar - Supabase setup
-- Run this once in Supabase Dashboard -> SQL Editor.

create table if not exists public.calendar_entries (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  applies_to text not null check (applies_to in ('Keith','Jah','Angela','Other')),
  other_name text,
  written_by text not null check (written_by in ('Keith','Jah')),
  event_time time,
  event_date date not null check (event_date between date '2026-01-01' and date '2027-12-31'),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint other_name_required check (
    (applies_to = 'Other' and nullif(btrim(other_name), '') is not null)
    or
    (applies_to <> 'Other')
  )
);

create or replace function public.set_calendar_entry_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists calendar_entries_set_updated_at on public.calendar_entries;
create trigger calendar_entries_set_updated_at
before update on public.calendar_entries
for each row execute function public.set_calendar_entry_updated_at();

-- Browser access is controlled by grants + Row Level Security.
alter table public.calendar_entries enable row level security;

revoke all on table public.calendar_entries from anon, authenticated;
grant select, insert, update, delete on table public.calendar_entries to anon;

-- No login was requested, so the public/anon role can operate on all calendar rows.
-- Anyone who can reach this Supabase API can therefore read or change the calendar.
-- This is appropriate only if you accept that trade-off for this private-family-use project.

drop policy if exists "family calendar read" on public.calendar_entries;
drop policy if exists "family calendar insert" on public.calendar_entries;
drop policy if exists "family calendar update" on public.calendar_entries;
drop policy if exists "family calendar delete" on public.calendar_entries;

create policy "family calendar read"
on public.calendar_entries
for select
to anon
using (true);

create policy "family calendar insert"
on public.calendar_entries
for insert
to anon
with check (true);

create policy "family calendar update"
on public.calendar_entries
for update
to anon
using (true)
with check (true);

create policy "family calendar delete"
on public.calendar_entries
for delete
to anon
using (true);

-- Optional index for week/date queries.
create index if not exists calendar_entries_event_date_idx
on public.calendar_entries (event_date, event_time);
