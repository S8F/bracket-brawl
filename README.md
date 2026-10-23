# Bracket Brawl

A phone app for running a friendly tournament. You add players, pick match lengths, and the app builds a double-elimination bracket (with an optional group stage first). It tracks scores, advances winners, and shows a points table and a champion banner.

## What it is built with

- Expo and React Native (TypeScript), iPhone only for now
- Supabase for login and for storing each user's private data (players and tournaments)
- Jest and React Native Testing Library for tests, ESLint and Prettier for code style

## Set up

You need Node.js (a current LTS version) and npm.

```sh
npm ci
cp .env.example .env
```

Open `.env` and fill in your own Supabase project address and publishable key (Supabase dashboard, Project Settings, API Keys). Use the publishable key only. Never put a secret or service_role key in this app. The `.env` file is ignored by git.

The database setup is in `supabase/migrations/`. Run those files in your Supabase project, in order. `supabase/tests/rls_isolation.sql` checks that one user cannot see another user's data.

## Run

```sh
npm start
```

This opens Expo. Press `i` for the iOS simulator, or scan the code with Expo Go on an iPhone.

## Test and check

```sh
npm test            # all automated tests
npm run typecheck   # TypeScript check
npm run lint        # ESLint
npm run format:check
```

The tests use a fake Supabase, so they need no `.env` and no network.

## Database functions (house rule)

New functions made by the `postgres` role no longer come callable by everyone (see migration `20261023000002`). So every migration that creates a function must:

1. End with `revoke execute on function <name>(<args>) from public, anon;`
2. Then `grant execute on function <name>(<args>) to <roles that call it>;` (usually `authenticated`, plus `service_role` if the server calls it).
3. An RLS helper function that lives outside `public` must grant execute to `authenticated`, or the policies using it will fail.
4. Never put app functions in the `storage` schema. That schema is owned by the platform and its defaults still give `anon` access.

After a database change, run `supabase/tests/brawl17_default_grants_check.sql` (read-only) and compare with its pass rules.

## Applied migrations (real project)

The real Supabase project (`tuoqpcgdvoiruwtfymjk`) has no migration history table, so nothing records which migrations were applied. Do not run `supabase db push` blindly: it cannot tell what is already there. Check this list first, and add a row whenever a migration is applied.

| Migration file | Date applied | How applied |
|---|---|---|
| `20261022000001_tighten_table_grants.sql` | 2026-10-22 (per the BRAWL-8 close log) | Unknown (not recorded; likely a plain SQL run) |
| `20261023000002_revoke_public_execute_default.sql` (run first) | 2026-10-23 | `supabase db query --linked -f` |
| `20261023000001_revoke_anon_default_privileges.sql` (run second) | 2026-10-23 | `supabase db query --linked -f` |

## Answering a "send me my data" email

1. Note the date the email arrived. The reply is due within one month.
2. Only answer to the account's own email address. If the request comes from another address, ask the person to write from the account's address.
3. Supabase dashboard → the real project → SQL editor. Find the account: `select id, email, created_at from auth.users where lower(email) = lower('<email>');`
4. No row: reply that no account uses that email, so you hold no app data for it. Login events and request logs are deleted after 1 hour and 1 day.
5. One row: pull everything in one go, using that `id`:
   `select json_build_object('account', (select json_build_object('email', email, 'created_at', created_at) from auth.users where id = '<id>'), 'players', (select coalesce(json_agg(p), '[]') from public.players p where p.user_id = '<id>'), 'tournaments', (select coalesce(json_agg(t), '[]') from public.tournaments t where t.user_id = '<id>'));`
6. Save the result as `brawl-data-<date>.json`. Check the player and tournament counts match `select count(*) from public.players where user_id = '<id>';` and the same for tournaments.
7. Reply to the same address with the file attached, within one month of step 1.
8. Delete the file from the Mac and from Downloads. We keep no copies (AC28). The sent email is the only record.

## Licence

Copyright (c) 2026 Saief Al-faour. All rights reserved. See [LICENSE](LICENSE).
