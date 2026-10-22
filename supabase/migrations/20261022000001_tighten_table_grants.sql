-- BRAWL-8: tighten table rights on the two private tables.
-- The live database gave "authenticated" ALL rights on players and tournaments.
-- ALL includes TRUNCATE (empty a whole table), which row-level security does not
-- cover. This file takes ALL away and gives back only the four normal rights.
-- Safe to run more than once: revoke then grant always ends in the same state.
-- Not applied by the build. The owner applies it by hand (see the BRAWL-8 log).

begin;

revoke all on public.players, public.tournaments from authenticated;
grant select, insert, update, delete on public.players, public.tournaments to authenticated;

-- Visitors who are not signed in ("anon") get no table access at all.
revoke all on public.players, public.tournaments from anon;

commit;
