# 성능 최적화 취합 계획

## 1단계: 저위험 즉시 개선

- 페이지네이션 URL을 `URLSearchParams` 기반 서버 helper로 생성한다.
- 메인 목록과 마이페이지 이미지에 `loading`, `decoding`, `width`, `height`, `aspect-ratio`를 적용한다.
- 검색 폼 제출 중 pending 상태를 표시한다.

## 2단계: 데이터베이스 문서 정리

- 현재 앱이 쓰지 않는 `boardgames` 사용자 상태 컬럼과 제거된 `raw_json` 저장 정책을 SQL 문서에서 분리한다.
- 현재 `ILIKE` 검색에 맞는 `pg_trgm` 인덱스와 `last_detail_sync_at` 부분 인덱스를 제안한다.
- 운영 SQL은 “필수 스키마”, “검색 성능 인덱스”, “용량 회수 작업”으로 나눈다.

## 3단계: 쿼리 구조 개선

- `myRating` 정렬을 DB 함수 또는 view 기반 페이지네이션으로 되돌리되, 함수 부재/권한 오류 시 앱 fallback을 유지한다.
- 사용자 플래그 필터를 큰 `IN` 목록 대신 DB JOIN/RPC로 처리한다.
- `lastSyncAt`는 별도 캐시 또는 `sync_jobs` 기반으로 분리한다.

## 4단계: UX 구조 개선

- 마이페이지 탭별 lazy load 또는 탭별 pagination API를 추가한다.
- `alert` 기반 피드백을 toast/snackbar로 바꾼다.
- 모바일 카드 액션 밀도를 낮추고 터치 타깃을 키운다.

## 이번 커밋 적용 범위

- 1단계 저위험 개선만 포함한다.
- DB 구조 변경과 RPC 재도입은 운영 쿼리 영향이 크므로 별도 테스트와 커밋으로 진행한다.
