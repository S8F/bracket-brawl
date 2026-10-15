-- Bracket Brawl, migration 2: the "delete my account" function.
-- Deleting a login needs server-side power, so it lives in the database, not in the app.
-- "security definer" = runs with the owner's rights. It can only ever delete the CALLER's own
-- login (auth.uid()), never anyone else's. The cascade rules in migration 1 then remove that
-- user's players and tournaments. No secret key is shipped in the app.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''   -- stops a look-alike table or function from being picked up by mistake
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  delete from auth.users where id = caller;
end;
$$;

-- Only signed-in users may call it. Not visitors, not "public".
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
