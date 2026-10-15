-- Privacy check for the Supabase SQL Editor (checks 3, 4, 12, 17). Run the whole file in one go.
-- It makes two throw-away users, tries to read across them as each user, then rolls EVERYTHING back,
-- so nothing is left behind. The editor shows only the LAST result, so every check is collected in one
-- table and printed at the end. Pass = every row has got = expect.

begin;

create temp table results (test text, got int, expect int);
grant all on results to authenticated;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@test.invalid'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@test.invalid');

-- Act as user A: create a player and a tournament.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into public.players (name) values ('A-player');
insert into public.tournaments (name, data) values ('A-tournament', '{}');

-- Act as user B: must see nothing of A's.
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
insert into results select 'B sees A players', count(*), 0 from public.players;
insert into results select 'B sees A tournaments', count(*), 0 from public.tournaments;

-- B tries to write a row that claims to belong to A: the database must refuse (got 1 = refused).
do $$
begin
  insert into public.players (user_id, name) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'forged');
  insert into results values ('B forged a row for A (refused = 1)', 0, 1);
exception when insufficient_privilege then
  insert into results values ('B forged a row for A (refused = 1)', 1, 1);
end $$;

-- Back to A: sees exactly its own rows.
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
insert into results select 'A sees own players', count(*), 1 from public.players;
insert into results select 'A sees own tournaments', count(*), 1 from public.tournaments;

-- A deletes the account through the real function; A's login and rows must vanish.
select public.delete_my_account();
reset role;
insert into results select 'A login left', count(*), 0 from auth.users where id = 'aaaaaaaa-0000-0000-0000-00000000000a';
insert into results select 'A players left', count(*), 0 from public.players;
insert into results select 'A tournaments left', count(*), 0 from public.tournaments;
insert into results select 'B login still there', count(*), 1 from auth.users where id = 'bbbbbbbb-0000-0000-0000-00000000000b';

select test, got, expect, (got = expect) as pass from results;

rollback;
