# Discovery Filters And Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build category/mechanism filters and a personalized recommendation section for the main boardgame list.

**Architecture:** Keep advanced filters inside the existing list query pipeline. Add recommendations as a separate service consumed by the main controller so recommendation failures cannot break search.

**Tech Stack:** Node.js, Express, EJS, Supabase PostgREST client, vanilla CSS/JS, `node:test`.

---

## File Structure

- Modify `src/controllers/gameController.js`: parse, cache, render, and preserve new filter params; load recommendations safely.
- Modify `src/services/gameService.js`: include category/mechanism in selected rows and filter query.
- Create `src/services/recommendationService.js`: derive user preference signals and score candidate games.
- Modify `src/validators/gameValidator.js`: validate new query params.
- Modify `views/index.ejs`: add category/mechanism inputs and recommendation section.
- Modify `public/css/styles.css`: style the new filter row and recommendation strip.
- Modify `database_indexes.sql`: document required category/mechanism columns and optional trigram indexes for those fields.
- Add/modify tests in `test/gameController.test.js`, `test/validator.test.js`, `test/gameService.test.js`, and `test/recommendationService.test.js`.

## Tasks

### Task 1: Lock Advanced Filter Parameter Behavior

- [ ] Add tests proving `category` and `mechanism` are parsed, included in cache keys, and preserved in pagination URLs.
- [ ] Add tests proving the controller can identify whether recommendations should render only for page 1 with no active filters.
- [ ] Update `GameController._parseSearchParams`, `_generateCacheKey`, `_extractSearchParams`, and `_buildPageUrlFactory`.
- [ ] Run `node --test test/gameController.test.js` and confirm the tests pass.

### Task 2: Validate New Query Params

- [ ] Add validator tests for overlong `category` and `mechanism` values.
- [ ] Update `GameValidator.validateSearchQuery` with 100-character limits.
- [ ] Run `node --test test/validator.test.js`.

### Task 3: Apply Category And Mechanism Filters

- [ ] Add a mock-query test proving `_applyFilters` calls `ilike('category', '%...%')` and `ilike('mechanism', '%...%')`.
- [ ] Add tests for Korean alias normalization and escaping `%`/`_` before `ILIKE`.
- [ ] Add a regression test covering `myRating` search params with category/mechanism through `_buildBoardgameQuery`.
- [ ] Update `GameService._applyFilters` and every `_buildBoardgameQuery` caller to pass the new filter fields.
- [ ] Include `category` and `mechanism` in selected columns where recommendation/display logic needs them.
- [ ] Run the new service test plus existing game-controller tests.

### Task 4: Build Recommendation Service

- [ ] Create `src/services/recommendationService.js`.
- [ ] Add pure helper tests for token extraction, score calculation, and exclusion rules.
- [ ] Implement `getRecommendations(userId, limit)` using user signals, max 30 seeds, max 5 category tokens, max 5 mechanism tokens, max 300 candidates, app-level scoring, and safe empty returns.
- [ ] Run `node --test test/recommendationService.test.js`.

### Task 5: Wire Recommendations Into The Main Page

- [ ] Add controller tests with mocked recommendation service for success, failure, and no-call filtered/page cases.
- [ ] Update `GameController.index` to pass `recommendations` in render data and cache.
- [ ] Ensure recommendation failures are logged but do not change the main list response and do not cache the failed recommendation render.
- [ ] Run controller tests.

### Task 6: Render And Style UI

- [ ] Add category/mechanism inputs to a collapsed `상세 필터` area with Korean labels `게임 종류` and `진행 방식`.
- [ ] Add a compact recommendation strip above `.game-grid` that renders only on the first unfiltered page.
- [ ] Add compact empty states for no recommendations and no search results.
- [ ] Add CSS for compact recommendation cards with stable image dimensions.
- [ ] Run JS syntax checks and `node --test`.

### Task 7: Operational Docs And Indexes

- [ ] Add `ADD COLUMN IF NOT EXISTS category text` and `ADD COLUMN IF NOT EXISTS mechanism text`.
- [ ] Add optional trigram indexes for `category` and `mechanism` in `database_indexes.sql`.
- [ ] Mention the new filters and recommendation behavior in `README.md`.
- [ ] Run `git diff --check`.

### Task 8: Verify, Commit, Push, And Deploy Check

- [ ] Run full `node --test`.
- [ ] Run JS syntax checks under `api`, `config`, `src`, `public/js`, `scripts`, `utils`, and `test`.
- [ ] Start the local server with the known `NODE_PATH` fallback and verify the page renders.
- [ ] Commit with Lore protocol trailers.
- [ ] Push `master`.
- [ ] Verify production routes after deployment.
