# Repository Guidelines

## Project Structure & Module Organization
- `api/index.js` is the Express entry point (also used by Vercel serverless).
- `src/` holds application logic: `controllers/`, `services/`, `routes/`, `middleware/`, `validators/`, `models/`.
- `views/` contains EJS templates (`index.ejs`, `error.ejs`).
- `public/` serves static assets (`public/css`, `public/js`).
- `config/` holds environment configuration; `supabase-client.js` configures Supabase.
- `sqlite/` contains data tooling (crawler, migration scripts).
- `database_indexes.sql` defines performance indexes.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the dev server with nodemon auto-reload.
- `npm start` runs the production server (`api/index.js`).
- `python sqlite/crawler.py` crawls BoardGameGeek data into SQLite (used for migration).
- `node sqlite/migrate-to-supabase.js` migrates data to Supabase.

## Coding Style & Naming Conventions
- JavaScript uses CommonJS (`require`, `module.exports`).
- Indentation is 4 spaces; semicolons are used.
- Filenames follow lower camel or lower kebab as seen in `gameController.js`, `cacheMiddleware.js`.
- Keep route/controller/service names aligned (e.g., `gameRoutes` → `GameController` → `gameService`).

## Testing Guidelines
- No automated test framework is configured in this repository.
- If you add tests, document the command in `package.json` and keep test files near their modules (e.g., `src/services/__tests__/gameService.test.js`).

## Commit & Pull Request Guidelines
- Commit history is short, descriptive, and often in Korean (no Conventional Commits). Keep messages concise and specific (e.g., “성능 개선”, “배포 버그 수정”).
- PRs should include a summary of changes, testing notes (or “not run”), and screenshots for UI changes.

## Security & Configuration Notes
- Copy `.env.example` to `.env` and set `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Do not commit secrets. Verify Vercel environment variables for deploys.
- When changing schema or indexes, update `database_indexes.sql` and mention the change in the PR.
