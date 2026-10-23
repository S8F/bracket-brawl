-- BRAWL-17 after-check. Read-only. Run:
--   supabase db query --linked --project-ref <ref> -f supabase/tests/brawl17_default_grants_check.sql
-- Pass: no A rows; B authenticated = DELETE, INSERT, SELECT, UPDATE on players and tournaments; C and D contain no =X (PUBLIC) and no anon=.
-- Only one result set is shown by the CLI, so the three are returned as one table.

with a as (
  -- A: any PUBLIC (=) or anon default privilege for role postgres, any schema entry
  select 'A_bad_default_acl' as check_name,
         coalesce(n.nspname,'(global)') || '/' || d.defaclobjtype::text as item,
         d.defaclacl::text as detail
  from pg_default_acl d
  join pg_roles r on r.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace
  where r.rolname = 'postgres'
    and (n.nspname = 'public' or d.defaclnamespace = 0)
    and (d.defaclacl::text like '%anon=%' or d.defaclacl::text like '{=%' or d.defaclacl::text like '%,=%')
), b as (
  select 'B_table_rights' as check_name,
         c.relname || ' / ' || a.grantee::regrole::text || ' / grantor ' || g.rolname as item,
         string_agg(a.privilege_type, ', ' order by a.privilege_type) as detail
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) a
  left join pg_roles g on g.oid = a.grantor
  where n.nspname = 'public' and c.relname in ('players','tournaments')
  group by c.relname, a.grantee, g.rolname
), c as (
  -- C: what a NEW function by postgres would get (global default merged with schema entry)
  select 'C_global_function_default' as check_name,
         'postgres/f global' as item,
         coalesce((select d.defaclacl::text from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
                   where r.rolname='postgres' and d.defaclnamespace=0 and d.defaclobjtype='f'),
                  acldefault('f', (select oid from pg_roles where rolname='postgres'))::text) as detail
), d as (
  -- D: what a new function by postgres in public gets = global row + schema row (the schema row is added on top).
  -- Pass = neither part contains =X (PUBLIC) or anon=.
  select 'D_new_public_function_effective' as check_name,
         'global + public schema' as item,
         'global ' || coalesce((select d.defaclacl::text from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
                                where r.rolname='postgres' and d.defaclnamespace=0 and d.defaclobjtype='f'),
                               acldefault('f', (select oid from pg_roles where rolname='postgres'))::text)
         || ' + schema ' || coalesce((select d.defaclacl::text from pg_default_acl d join pg_roles r on r.oid=d.defaclrole
                                      join pg_namespace n on n.oid=d.defaclnamespace
                                      where r.rolname='postgres' and n.nspname='public' and d.defaclobjtype='f'), '(none)') as detail
)
select * from a union all select * from b union all select * from c union all select * from d order by 1, 2;
