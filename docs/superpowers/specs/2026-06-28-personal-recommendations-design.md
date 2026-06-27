# Personal Recommendations Design

## Goal

Add a lightweight recommendation section that helps a user discover boardgames similar to games they already rated highly or saved, without requiring a separate recommendation engine.

## Scope

This feature adds a recommendations block to the main page. It is personalized for the current shared profile and uses existing `user_data` signals:

- Strong signal: `my_rating >= 8`.
- Medium signal: `is_favorite`, `is_wishlist`, or `is_planned`.
- Exclusion: owned games and every seed game are excluded from recommendations.

## Approach

Create a focused `recommendationService` that reads user preference seeds, derives preferred categories, mechanisms, weight range, player range, and then fetches candidate games from `boardgames`.

The candidate set is intentionally bounded:

- Read at most 30 seed rows.
- Use at most 5 category tokens and 5 mechanism tokens.
- Fetch at most 300 candidate games.
- Prefer candidates with `rating >= 5`.
- Exclude seed and owned IDs before scoring.

The recommendation score is calculated in app code to avoid new SQL functions:

- Category overlap.
- Mechanism overlap.
- Weight closeness.
- Player-count compatibility.
- BGG rating as a small tie-breaker.

The first release returns up to three recommendations on the first page when no search/filter is active. If the user has no usable preference data, render a compact empty state explaining that ratings or saved games will improve recommendations.

## UI

Place a compact horizontal `추천 게임` section above the normal grid only on the unfiltered first page. Cards are smaller than normal game cards and show:

- Image.
- Display name.
- Rating and weight.
- A short reason with at least two signals, for example `덱빌딩 취향과 2-4인 구성이 비슷해요`.

The section links to the BGG URL and avoids duplicating the full set of personal action buttons in the first iteration. The normal grid remains the primary workflow.

## Data Flow

1. Main controller fetches paginated games as today.
2. If `page === 1` and no search/filter is active, controller asks `recommendationService.getRecommendations(userId, 3)`.
3. Recommendation service fetches current user signals from `user_data`.
4. It loads source game metadata from `boardgames`.
5. It queries a bounded candidate set by rating and basic availability.
6. It scores candidates and returns decorated recommendation objects with human-readable Korean reasons.
7. Controller passes `recommendations` to `views/index.ejs`.

## Error Handling

Recommendations must never break the main list. If the recommendation query fails, log the error and render the page with an empty recommendation list. The controller must not cache render data when the recommendation lookup failed, so a transient recommendation failure does not persist for the cache TTL.

## Testing

Add unit tests for:

- Preference token extraction from comma-separated category/mechanism strings.
- Scoring candidates by shared mechanism/category and rating.
- Excluding owned and seed games.
- Controller rendering an empty recommendation list when the service fails.
- Controller requesting recommendations only on the first unfiltered page.

## Future Work

Once category/mechanism filters are normalized, recommendation scoring can move to SQL or materialized views. A later UI can add a dedicated recommendations page with explanation filters and feedback buttons.
