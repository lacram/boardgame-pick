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
    ADD COLUMN IF NOT EXISTS players_best_raw text,
    ADD COLUMN IF NOT EXISTS players_best_min int,
    ADD COLUMN IF NOT EXISTS players_best_max int,
    ADD COLUMN IF NOT EXISTS players_best_set int[],
    ADD COLUMN IF NOT EXISTS players_recommended_raw text,
    ADD COLUMN IF NOT EXISTS players_recommended_min int,
    ADD COLUMN IF NOT EXISTS players_recommended_max int,
    ADD COLUMN IF NOT EXISTS players_recommended_set int[];

-- 1. weight 컬럼 인덱스 (범위 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_weight ON boardgames(weight);

-- 2. is_favorite 컬럼 인덱스 (즐겨찾기 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_is_favorite ON boardgames(is_favorite);

-- 2-1. is_scheduled 컬럼 인덱스 (플레이 예정 필터링 최적화)
CREATE INDEX IF NOT EXISTS idx_boardgames_is_scheduled ON boardgames(is_scheduled);

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

-- reviews 테이블 인덱스

-- 10. bgg_id 컬럼 인덱스 (조인 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_bgg_id ON reviews(bgg_id);

-- 11. created_at 컬럼 인덱스 (정렬 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);

-- 12. 복합 인덱스: bgg_id + created_at (가장 최신 리뷰 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_reviews_bgg_id_created_at ON reviews(bgg_id, created_at DESC);

-- 인덱스 생성 확인 쿼리
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('boardgames', 'reviews')
ORDER BY tablename, indexname; 
