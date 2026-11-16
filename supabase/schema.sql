-- Practice: one table holds every record, as JSON, scoped to the signed-in user.
-- Run this once in Supabase: Dashboard > SQL Editor > New query > paste > Run.

create table if not exists public.records (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id         text        not null,              -- "<collection>/<record id>"
  coll       text        not null,              -- foodLog, workouts, weights, ...
  data       jsonb       not null,
  updated_at timestamptz not null,              -- when it changed on the phone (last write wins)
  deleted    boolean     not null default false,
  synced_at  timestamptz not null default clock_timestamp(), -- server time, used to pull changes
  primary key (user_id, id)
);

create index if not exists records_user_synced on public.records (user_id, synced_at);

-- Stamp server time on every write so other devices can pull "everything since X".
create or replace function public.records_touch() returns trigger language plpgsql as $$
begin
  new.synced_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- Row level security: each person can only ever see and change their own rows.
alter table public.records enable row level security;

drop policy if exists "own rows: select" on public.records;
drop policy if exists "own rows: insert" on public.records;
drop policy if exists "own rows: update" on public.records;
drop policy if exists "own rows: delete" on public.records;

create policy "own rows: select" on public.records for select to authenticated using (auth.uid() = user_id);
create policy "own rows: insert" on public.records for insert to authenticated with check (auth.uid() = user_id);
create policy "own rows: update" on public.records for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own rows: delete" on public.records for delete to authenticated using (auth.uid() = user_id);
