-- Bracket Brawl, migration 1: the two per-user tables and their privacy rules.
-- Every row belongs to one user (user_id). Row-level security makes the database
-- itself refuse to show or change anyone else's rows, whatever the app asks for.
-- Tables are intentionally small; Part 2 (tournament screens) may add columns in a later migration.

create table public.players (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_at  timestamptz not null default now()
);

-- One person cannot have the same player name twice (ignoring capitals and spaces at the ends).
create unique index players_user_name_unique on public.players (user_id, lower(btrim(name)));

create table public.tournaments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 100),
  data         jsonb not null,            -- the whole tournament (bracket, scores) as the app saves it
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,               -- null while the tournament is still in progress
  updated_at   timestamptz not null default now()
);

create index tournaments_user_idx on public.tournaments (user_id);

-- Deleting a login (auth.users) deletes that user's rows too, via "on delete cascade" above.

alter table public.players     enable row level security;
alter table public.tournaments enable row level security;
-- "force" makes the rules apply even to the table owner role.
alter table public.players     force row level security;
alter table public.tournaments force row level security;

-- Signed-in users only ("to authenticated"); each rule compares the row's owner with the caller's id.
-- (select auth.uid()) is the form Supabase recommends: it is evaluated once per query, not per row.
create policy players_select on public.players
  for select to authenticated using (user_id = (select auth.uid()));
create policy players_insert on public.players
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy players_update on public.players
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy players_delete on public.players
  for delete to authenticated using (user_id = (select auth.uid()));

create policy tournaments_select on public.tournaments
  for select to authenticated using (user_id = (select auth.uid()));
create policy tournaments_insert on public.tournaments
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy tournaments_update on public.tournaments
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy tournaments_delete on public.tournaments
  for delete to authenticated using (user_id = (select auth.uid()));

-- Visitors who are not signed in ("anon") get no table access at all.
revoke all on public.players, public.tournaments from anon;
grant select, insert, update, delete on public.players, public.tournaments to authenticated;
