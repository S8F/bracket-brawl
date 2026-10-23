-- BRAWL-17 round 2: new functions made by postgres should not be callable by
-- everyone (PUBLIC, which includes anon) just because they exist.
-- Separate file because 20261023000001 was already applied on the test project.
-- Safe to run more than once.
--
-- Why there is no "in schema public" here: PUBLIC execute comes from Postgres's
-- built-in global default, and a schema-scoped revoke cannot remove a global
-- default (tested: with only the schema line, a new function still had =X).
-- So the revoke is global for the role postgres. Effect: any future function
-- created by postgres, in any schema, needs an explicit grant to be callable.
-- Existing functions are not touched.

begin;

alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres revoke execute on functions from public;

commit;
