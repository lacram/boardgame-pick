-- Boardgame Pick 성능 최적화 인덱스 + 인원수 정규화 컬럼
-- Supabase SQL Editor에서 실행하세요

-- boardgames 테이블 인덱스
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 인원수 정규화 컬럼 (원본 보존 + 검색 최적화)
ALTER TABLE boardgames
    ADD COLUMN IF NOT EXISTS rank int,
    ADD COLUMN IF NOT EXISTS last_dump_seen_at timestamptz,
    ADD COLUMN IF NOT EXISTS source_updated_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_detail_sync_at timestamptz,
    ADD COLUMN IF NOT EXISTS detail_sync_status text,
    ADD COLUMN IF NOT EXISTS category text,
    ADD COLUMN IF NOT EXISTS mechanism text,
    ADD COLUMN IF NOT EXISTS players_best_raw text,
    ADD COLUMN IF NOT EXISTS players_best_min int,
    ADD COLUMN IF NOT EXISTS players_best_max int,
    ADD COLUMN IF NOT EXISTS players_best_set int[],
    ADD COLUMN IF NOT EXISTS players_recommended_raw text,
    ADD COLUMN IF NOT EXISTS players_recommended_min int,
    ADD COLUMN IF NOT EXISTS players_recommended_max int,
    ADD COLUMN IF NOT EXISTS players_recommended_set int[];

-- raw_json은 과거 원본 payload 보관용 컬럼이었고 현재 앱은 저장하지 않습니다.
-- 무료 티어 용량 회수 목적이면 아래 DROP COLUMN을 운영 DB에서 별도 실행하세요.
-- ALTER TABLE boardgames DROP COLUMN IF EXISTS raw_json;

-- 1. weight 컬럼 인덱스 (범위 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_weight ON boardgames(weight);

-- 3. rating 컬럼 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_rating ON boardgames(rating DESC);

-- 4. name/korean_name 부분 문자열 검색 최적화
-- 앱 쿼리는 ILIKE '%검색어%'를 사용하므로 trigram 인덱스가 실제 쿼리와 맞습니다.
CREATE INDEX IF NOT EXISTS idx_boardgames_name_trgm
    ON boardgames USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_boardgames_korean_name_trgm
    ON boardgames USING gin (korean_name gin_trgm_ops);

-- 운영 DB에서는 아래 두 GIN 인덱스를 트래픽이 적은 시간에 각각 별도 실행하는 것을 권장합니다.
-- CREATE INDEX CONCURRENTLY는 트랜잭션 블록 안에서 실행할 수 없습니다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boardgames_category_trgm
    ON boardgames USING gin (category gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_boardgames_mechanism_trgm
    ON boardgames USING gin (mechanism gin_trgm_ops);

-- 8. players_recommended_set GIN 인덱스 (범위/단일 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_players_recommended_set_gin
    ON boardgames USING gin (players_recommended_set);

-- 9. players_best_set GIN 인덱스 (범위/단일 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_players_best_set_gin
    ON boardgames USING gin (players_best_set);

-- 10. rank 컬럼 인덱스 (순위 정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_rank ON boardgames(rank);

-- 11. average_rating 컬럼 인덱스 (정렬 최적화)
-- average_rating 컬럼은 현재 앱에서 rating으로 통합해 사용합니다.

-- 12. 마지막 상세 동기화 시각 조회 최적화
CREATE INDEX IF NOT EXISTS idx_boardgames_last_detail_sync_at
    ON boardgames(last_detail_sync_at DESC)
    WHERE last_detail_sync_at IS NOT NULL;

-- reviews 테이블 사용자 구분
ALTER TABLE reviews
    ADD COLUMN IF NOT EXISTS user_id text;

-- 기존 리뷰에 기본 사용자 ID 설정 (필요 시 수정)
-- UPDATE reviews SET user_id = 'local-user' WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_user_bgg
    ON reviews(user_id, bgg_id);

-- reviews 테이블 인덱스

-- 10. bgg_id 컬럼 인덱스 (조인 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_bgg_id ON reviews(bgg_id);

-- 11. created_at 컬럼 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- 12. 복합 인덱스: bgg_id + created_at (가장 최신 리뷰 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_bgg_id_created_at ON reviews(bgg_id, created_at DESC);

-- app_users 테이블 (간단한 유저 목록)
CREATE TABLE IF NOT EXISTS app_users (
    id text PRIMARY KEY,
    created_at timestamptz DEFAULT now()
);

-- user_data 테이블 (유저별 즐겨찾기/보유/플레이 예정/내 평점)
CREATE TABLE IF NOT EXISTS user_data (
    id bigserial PRIMARY KEY,
    user_id text NOT NULL,
    bgg_id int NOT NULL,
    is_favorite boolean DEFAULT false,
    is_wishlist boolean DEFAULT false,
    is_owned boolean DEFAULT false,
    is_planned boolean DEFAULT false,
    is_recommendation_excluded boolean DEFAULT false,
    my_rating int,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 기존 테이블 보정 (컬럼 추가)
ALTER TABLE user_data
    ADD COLUMN IF NOT EXISTS is_wishlist boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_planned boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_recommendation_excluded boolean DEFAULT false;

-- 기존 is_scheduled가 있었다면 위시리스트로 이관
-- UPDATE user_data SET is_wishlist = is_scheduled WHERE is_scheduled = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_data_user_bgg
    ON user_data(user_id, bgg_id);

CREATE INDEX IF NOT EXISTS idx_user_data_user_favorite
    ON user_data(user_id, is_favorite);

CREATE INDEX IF NOT EXISTS idx_user_data_user_scheduled
    ON user_data(user_id, is_wishlist);

CREATE INDEX IF NOT EXISTS idx_user_data_user_owned
    ON user_data(user_id, is_owned);

CREATE INDEX IF NOT EXISTS idx_user_data_user_planned
    ON user_data(user_id, is_planned);

CREATE INDEX IF NOT EXISTS idx_user_data_user_recommendation_excluded
    ON user_data(user_id, is_recommendation_excluded);

CREATE INDEX IF NOT EXISTS idx_user_data_user_rating
    ON user_data(user_id, my_rating DESC);

-- 내 평점순 정렬과 사용자 플래그 필터는 user_data 조인 기반 RPC/View로 옮기는 것이
-- 장기적으로 가장 빠릅니다. 현재 앱은 안전한 앱 레벨 fallback을 사용합니다.

-- BGG 동기화 상태 테이블
CREATE TABLE IF NOT EXISTS sync_jobs (
    id bigserial PRIMARY KEY,
    job_type text NOT NULL DEFAULT 'incremental',
    trigger_source text,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running',
    total_count int NOT NULL DEFAULT 0,
    success_count int NOT NULL DEFAULT 0,
    fail_count int NOT NULL DEFAULT 0,
    last_error text
);

CREATE TABLE IF NOT EXISTS sync_targets (
    bgg_id int PRIMARY KEY,
    priority int NOT NULL DEFAULT 1,
    next_sync_at timestamptz,
    last_attempt_at timestamptz,
    attempt_count int NOT NULL DEFAULT 0,
    last_error text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_errors (
    id bigserial PRIMARY KEY,
    job_id bigint REFERENCES sync_jobs(id) ON DELETE SET NULL,
    bgg_id int,
    error_code text,
    message text,
    payload_snippet text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_started_at
    ON sync_jobs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_status
    ON sync_jobs(status);

CREATE INDEX IF NOT EXISTS idx_sync_targets_next_sync_at
    ON sync_targets(next_sync_at);

CREATE INDEX IF NOT EXISTS idx_sync_targets_priority_next
    ON sync_targets(priority DESC, next_sync_at);

CREATE INDEX IF NOT EXISTS idx_sync_errors_job_id
    ON sync_errors(job_id);

CREATE INDEX IF NOT EXISTS idx_sync_errors_created_at
    ON sync_errors(created_at DESC);

-- 인덱스 생성 확인 쿼리
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('boardgames', 'reviews')
ORDER BY tablename, indexname; 
