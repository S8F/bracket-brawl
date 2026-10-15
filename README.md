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

## Licence

No licence has been chosen yet. Until one is added, all rights are reserved.
