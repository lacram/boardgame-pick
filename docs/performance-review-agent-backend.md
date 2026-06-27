# 성능 리뷰 보고서 - 에이전트 A

범위: 백엔드, Supabase 쿼리, 캐시, 동기화 작업.

## 핵심 발견

1. `myRating` 정렬은 DB 페이지네이션 대신 앱에서 `user_data` 전체 조회, `boardgames.in(...)`, 메모리 정렬/슬라이스를 수행한다. 사용자 평점 데이터가 늘면 PostgREST URL 길이, Vercel 함수 실행 시간, Node 메모리 사용이 모두 악화될 수 있다.

2. 텍스트 검색은 `ILIKE '%term%'`를 사용하지만 SQL 문서의 인덱스는 `to_tsvector` 기반이다. 현재 쿼리에는 `pg_trgm` 기반 GIN 인덱스가 더 직접적으로 맞는다.

3. 즐겨찾기/위시/보유/예정 필터는 `user_data`에서 ID 목록을 먼저 가져오고 `boardgames.in(...)`으로 넘긴다. 저장 항목이 많은 사용자에게 큰 `IN` 필터가 병목이 될 수 있다.

4. 목록 요청마다 `boardgames.last_detail_sync_at` 최신값을 별도 조회한다. `sync_jobs` 또는 캐시된 상태값으로 분리하는 편이 낫다.

5. 토글/리뷰 저장 시 전체 메모리 캐시를 지운다. 캐시 키가 `userId`를 포함하므로 사용자 단위 무효화가 더 적합하다.

6. 마이페이지는 사용자 데이터를 전체 로딩하고 앱에서 분류/정렬한다. 항목이 많아지면 탭별 페이지네이션 또는 lazy load가 필요하다.

7. BGG 동기화는 Vercel 함수 안에서 batch loop와 delay를 수행한다. 장기적으로는 cron이 작업을 enqueue하고 작은 배치 단위로 재호출하는 구조가 안전하다.

## 권장 순서

1. `myRating` 정렬을 DB 함수 또는 view 기반 페이지네이션으로 이관한다.
2. 검색 쿼리와 인덱스를 `pg_trgm` 또는 full-text 중 하나로 통일한다.
3. 사용자 플래그 필터를 JOIN/RPC 기반으로 바꾼다.
4. `lastSyncAt` 조회를 작은 상태 테이블 또는 앱 캐시로 분리한다.
5. 캐시 무효화를 전체 clear에서 사용자 prefix 단위로 줄인다.
