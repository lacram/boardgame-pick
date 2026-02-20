-- Boardgame Pick 성능 최적화 인덱스 + 인원수 정규화 컬럼
-- Supabase SQL Editor에서 실행하세요

-- boardgames 테이블 인덱스

-- 인원수 정규화 컬럼 (원본 보존 + 검색 최적화)
ALTER TABLE boardgames
    ADD COLUMN IF NOT EXISTS raw_json jsonb,
    ADD COLUMN IF NOT EXISTS rank int,
    ADD COLUMN IF NOT EXISTS average_rating numeric,
    ADD COLUMN IF NOT EXISTS last_dump_seen_at timestamptz,
    ADD COLUMN IF NOT EXISTS last_detail_sync_at timestamptz,
    ADD COLUMN IF NOT EXISTS detail_sync_status text,
    ADD COLUMN IF NOT EXISTS my_rating int,
    ADD COLUMN IF NOT EXISTS players_best_raw text,
    ADD COLUMN IF NOT EXISTS players_best_min int,
    ADD COLUMN IF NOT EXISTS players_best_max int,
    ADD COLUMN IF NOT EXISTS players_best_set int[],
    ADD COLUMN IF NOT EXISTS players_recommended_raw text,
    ADD COLUMN IF NOT EXISTS players_recommended_min int,
    ADD COLUMN IF NOT EXISTS players_recommended_max int,
    ADD COLUMN IF NOT EXISTS players_recommended_set int[],
    ADD COLUMN IF NOT EXISTS is_owned boolean DEFAULT false;

-- 1. weight 컬럼 인덱스 (범위 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_weight ON boardgames(weight);

-- 2. is_favorite 컬럼 인덱스 (즐겨찾기 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_is_favorite ON boardgames(is_favorite);

-- 2-1. is_scheduled 컬럼 인덱스 (플레이 예정 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_is_scheduled ON boardgames(is_scheduled);

-- 2-2. is_owned 컬럼 인덱스 (보유 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_is_owned ON boardgames(is_owned);

-- 3. rating 컬럼 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_rating ON boardgames(rating DESC);

-- 4. name 컬럼 인덱스 (텍스트 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_name ON boardgames USING gin(to_tsvector('english', name));

-- 5. korean_name 컬럼 인덱스 (한국어 텍스트 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_korean_name ON boardgames USING gin(to_tsvector('simple', korean_name));

-- 6. 복합 인덱스: 즐겨찾기 + 평점 (자주 사용되는 조합)
CREATE INDEX IF NOT EXISTS idx_boardgames_favorite_rating ON boardgames(is_favorite, rating DESC);

-- 7. 복합 인덱스: 즐겨찾기 + 무게 (필터링 + 정렬)
CREATE INDEX IF NOT EXISTS idx_boardgames_favorite_weight ON boardgames(is_favorite, weight);

-- 7-1. 복합 인덱스: 플레이 예정 + 평점 (자주 사용되는 조합)
CREATE INDEX IF NOT EXISTS idx_boardgames_scheduled_rating ON boardgames(is_scheduled, rating DESC);

-- 7-2. 복합 인덱스: 플레이 예정 + 무게 (필터링 + 정렬)
CREATE INDEX IF NOT EXISTS idx_boardgames_scheduled_weight ON boardgames(is_scheduled, weight);

-- 7-3. 복합 인덱스: 보유 + 평점 (자주 사용되는 조합)
CREATE INDEX IF NOT EXISTS idx_boardgames_owned_rating ON boardgames(is_owned, rating DESC);

-- 7-4. 복합 인덱스: 보유 + 무게 (필터링 + 정렬)
CREATE INDEX IF NOT EXISTS idx_boardgames_owned_weight ON boardgames(is_owned, weight);

-- 8. players_recommended_set GIN 인덱스 (범위/단일 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_players_recommended_set_gin
    ON boardgames USING gin (players_recommended_set);

-- 9. players_best_set GIN 인덱스 (범위/단일 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_players_best_set_gin
    ON boardgames USING gin (players_best_set);

-- 10. rank 컬럼 인덱스 (순위 정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_rank ON boardgames(rank);

-- 11. average_rating 컬럼 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_average_rating ON boardgames(average_rating DESC);

-- 12. 내 평점 컬럼 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_my_rating ON boardgames(my_rating DESC);

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
    my_rating int,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 기존 테이블 보정 (컬럼 추가)
ALTER TABLE user_data
    ADD COLUMN IF NOT EXISTS is_wishlist boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_planned boolean DEFAULT false;

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

CREATE INDEX IF NOT EXISTS idx_user_data_user_rating
    ON user_data(user_id, my_rating DESC);

-- 인덱스 생성 확인 쿼리
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('boardgames', 'reviews')
ORDER BY tablename, indexname; 
