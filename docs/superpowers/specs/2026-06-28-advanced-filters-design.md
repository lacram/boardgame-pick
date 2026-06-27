# Advanced Filters Design

## Goal

Add category and mechanism filters to the boardgame list so users can narrow results by the actual style of game, not only name, players, weight, and personal flags.

## Scope

This feature covers the main list page only. It adds two optional advanced filters:

- `category`: matches `boardgames.category`.
- `mechanism`: matches `boardgames.mechanism`.

Both filters are additive with the existing filters. If a user searches for two players, medium weight, and a mechanism, all conditions must match.

## Approach

Use the existing list query flow instead of adding a new endpoint. `GameController._parseSearchParams()` accepts the new query params, cache keys include them, pagination preserves them, and `GameService._applyFilters()` adds case-insensitive partial matching against `category` and `mechanism`.

The first implementation uses single-value text inputs because the current schema stores comma-separated BGG category and mechanism names. Comma-separated multi-value filtering is explicitly out of scope for this release. A later improvement can add facet suggestions or normalized lookup tables.

Korean aliases are normalized before querying. For example:

- `카드` -> `Card Game`
- `경제` -> `Economic`
- `덱빌딩` -> `Deck, Bag, and Pool Building`
- `일꾼 놓기` -> `Worker Placement`

Wildcard characters `%` and `_` are escaped before building `ILIKE` patterns so accidental broad matches do not turn into full-table-style searches.

## UI

The search form gets a collapsed `상세 필터` area so the first mobile viewport does not become heavier. Inside the collapsed area:

- Category label: `게임 종류`, placeholder `카드, 경제`.
- Mechanism label: `진행 방식`, placeholder `덱빌딩, 일꾼 놓기`.

The controls follow existing `.search-input`, `.search-row`, and `.inline-pair` patterns. Pagination and cached renders must keep the fields populated.

## Data Flow

1. Browser submits `GET /?category=...&mechanism=...`.
2. Controller parses and validates the params as bounded strings.
3. Service normalizes Korean aliases and escapes wildcard characters.
4. Service applies `ILIKE '%value%'` to the corresponding boardgames columns.
5. Existing sorting, pagination, user flag merge, and decoration continue unchanged.

## Error Handling

Invalid or overlong filter values should not reach the database. Validation limits each field to 100 characters and returns the existing validation error flow.

If the database is missing `category` or `mechanism`, the query will fail. `database_indexes.sql` must document `ADD COLUMN IF NOT EXISTS category text` and `ADD COLUMN IF NOT EXISTS mechanism text` before the app code is deployed to a fresh environment.

## Testing

Add unit tests for:

- Controller param parsing, cache keys, and page URLs preserving category/mechanism.
- Validator rejecting overlong category/mechanism values.
- Service filter builder applying `ilike` to both columns through a mock query.
- `myRating` search params still carrying category/mechanism through the shared `_buildBoardgameQuery` path.
- Korean alias normalization and wildcard escaping.

## Future Work

Normalize categories and mechanisms into arrays or lookup tables when the app needs chip suggestions, include/exclude logic, or Korean labels.
