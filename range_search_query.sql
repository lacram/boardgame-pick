-- 방법 2: Supabase 쿼리에서 직접 범위 검색 구현

-- 예시 1: 단일 숫자 검색 (동적 쿼리)
-- 파라미터: search_value (예: 8)
-- DB에 "6-9", "7-10", "8", "8-12" 등이 있을 때 search_value 검색
SELECT * FROM boardgames 
WHERE (
    -- 정확히 일치하는 경우
    players_recommended = search_value::TEXT
    OR 
    -- 범위에 포함되는 경우 (예: "6-9", "7-10", "8-12")
    (
        -- 범위 형식인 경우 (예: "6-9")
        (players_recommended LIKE '%-%' AND 
         CAST(SPLIT_PART(players_recommended, '-', 1) AS INTEGER) <= search_value AND 
         CAST(SPLIT_PART(players_recommended, '-', 2) AS INTEGER) >= search_value)
        OR
        -- 단일 값 형식인 경우 (예: "6|9")
        (players_recommended LIKE '%|%' AND 
         (CAST(SPLIT_PART(players_recommended, '|', 1) AS INTEGER) = search_value OR 
          CAST(SPLIT_PART(players_recommended, '|', 2) AS INTEGER) = search_value))
    )
);

-- 예시 2: 범위 검색 (동적 쿼리)
-- 파라미터: min_search_value, max_search_value (예: 7, 9)
-- DB에 "6-9", "7-10", "8", "8-12" 등이 있을 때 min_search_value-max_search_value 검색
SELECT * FROM boardgames 
WHERE (
    -- 범위가 겹치는 경우
    (
        -- 범위 형식인 경우 (예: "6-9"와 "7-9"가 겹치는지 확인)
        (players_recommended LIKE '%-%' AND 
         CAST(SPLIT_PART(players_recommended, '-', 1) AS INTEGER) <= max_search_value AND 
         CAST(SPLIT_PART(players_recommended, '-', 2) AS INTEGER) >= min_search_value)
        OR
        -- 단일 값이 범위에 포함되는 경우 (예: "8"이 "7-9"에 포함되는지)
        (players_recommended NOT LIKE '%-%' AND 
         players_recommended NOT LIKE '%|%' AND
         CAST(players_recommended AS INTEGER) >= min_search_value AND 
         CAST(players_recommended AS INTEGER) <= max_search_value)
    )
); 