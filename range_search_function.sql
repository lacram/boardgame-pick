-- 범위 값을 파싱하는 함수
CREATE OR REPLACE FUNCTION parse_range(range_str TEXT)
RETURNS TABLE(min_val INTEGER, max_val INTEGER) AS $$
BEGIN
    -- "6-9" 형태 파싱
    IF range_str LIKE '%-%' THEN
        RETURN QUERY
        SELECT 
            CAST(SPLIT_PART(range_str, '-', 1) AS INTEGER),
            CAST(SPLIT_PART(range_str, '-', 2) AS INTEGER);
    -- "6|9" 형태 파싱
    ELSIF range_str LIKE '%|%' THEN
        RETURN QUERY
        SELECT 
            CAST(SPLIT_PART(range_str, '|', 1) AS INTEGER),
            CAST(SPLIT_PART(range_str, '|', 2) AS INTEGER);
    -- 단일 숫자
    ELSE
        RETURN QUERY
        SELECT 
            CAST(range_str AS INTEGER),
            CAST(range_str AS INTEGER);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 검색값이 범위에 포함되는지 확인하는 함수
CREATE OR REPLACE FUNCTION is_in_range(search_value INTEGER, range_str TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    range_min INTEGER;
    range_max INTEGER;
BEGIN
    SELECT min_val, max_val INTO range_min, range_max
    FROM parse_range(range_str);
    
    RETURN search_value >= range_min AND search_value <= range_max;
EXCEPTION
    WHEN OTHERS THEN
        RETURN FALSE;
END;
$$ LANGUAGE plpgsql; 