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
