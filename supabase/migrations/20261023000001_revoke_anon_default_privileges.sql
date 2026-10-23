-- BRAWL-17: stop new objects in "public" from coming with anon rights.
-- Supabase sets default privileges so that every table, function and sequence
-- that the role "postgres" creates in "public" is handed to anon automatically.
-- This removes the anon part only. authenticated, service_role and postgres keep
-- their defaults. Existing tables are not touched (BRAWL-8 already did those).
-- Only the role postgres is changed. The same defaults for the role
-- supabase_admin cannot be changed from here (permission denied) and only apply
-- to objects supabase_admin itself creates, which our migrations never do.
-- Safe to run more than once.

begin;

alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

commit;
