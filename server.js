const express = require('express');
const path = require('path');
const supabase = require('./supabase-client');

const app = express();
const PORT = process.env.PORT;

// 환경 변수를 상수로 미리 로드 (성능 최적화)
const PAGE_SIZE = parseInt(process.env.PAGE_SIZE) || 20;
const DEFAULT_SORT_BY = process.env.DEFAULT_SORT_BY || 'rating';
const DEFAULT_SORT_ORDER = process.env.DEFAULT_SORT_ORDER || 'desc';

// 검색값이 범위에 포함되는지 확인하는 함수
function isInRange(searchValue, rangeStr) {
    if (!rangeStr) return false;
    
    const searchNum = parseInt(searchValue);
    if (isNaN(searchNum)) return false;
    
    // "6-9" 형태 파싱 (하이픈, en dash, em dash 모두 지원)
    if (rangeStr.includes('-') || rangeStr.includes('–') || rangeStr.includes('—')) {
        // 모든 종류의 대시를 일반 하이픈으로 변환
        const normalizedRange = rangeStr.replace(/[–—]/g, '-');
        const parts = normalizedRange.split('-').map(s => parseInt(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return searchNum >= parts[0] && searchNum <= parts[1];
        }
    }
    
    // "6|9" 형태 파싱
    if (rangeStr.includes('|')) {
        const parts = rangeStr.split('|').map(s => parseInt(s.trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return searchNum === parts[0] || searchNum === parts[1];
        }
    }
    
    // 단일 숫자
    const num = parseInt(rangeStr);
    if (!isNaN(num)) {
        return searchNum === num;
    }
    
    return false;
}



// 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Supabase만 사용
console.log('Supabase 사용');

// 메인 페이지
app.get('/', async (req, res) => {
    const startTime = Date.now();
    
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const searchPlayers = req.query.searchPlayers || '';
    const searchBest = req.query.searchBest || '';
    const weightMin = req.query.weightMin || '';
    const weightMax = req.query.weightMax || '';
    const showFavoritesOnly = req.query.showFavoritesOnly === 'on';
    const sortBy = req.query.sortBy || DEFAULT_SORT_BY;
    const sortOrder = req.query.sortOrder || DEFAULT_SORT_ORDER;

    try {
        let games = [];
        let total = 0;

        // Supabase 쿼리
        let query = supabase
            .from('boardgames')
            .select('id, *', { count: 'exact' });

        // 필터링
        if (search) {
            query = query.or(`name.ilike.%${search}%,korean_name.ilike.%${search}%`);
        }
        if (weightMin) {
            query = query.gte('weight', parseFloat(weightMin));
        }
        if (weightMax) {
            query = query.lte('weight', parseFloat(weightMax));
        }
        if (showFavoritesOnly) {
            query = query.eq('is_favorite', true);
        }

        // 정렬
        const validSortFields = ['rating', 'weight', 'name'];
        if (validSortFields.includes(sortBy)) {
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }

        // 범위 검색이 있는 경우 페이지네이션 없이 모든 데이터 가져오기
        if (searchPlayers || searchBest) {
            console.log(`🔍 범위 검색 시작: ${searchPlayers || ''} ${searchBest || ''}`);
            const queryStartTime = Date.now();
            
            const { data: allData, error, count } = await query;
            
            if (error) throw error;
            
            const queryEndTime = Date.now();
            console.log(`📊 DB 쿼리 시간: ${queryEndTime - queryStartTime}ms, 데이터 개수: ${allData?.length || 0}`);
            
            let allGames = allData || [];
            
            // 범위 검색 필터링 (JavaScript로 정확한 범위 검색)
            const filterStartTime = Date.now();
            allGames = allGames.filter(game => {
                let includeGame = true;
                
                // 인원 검색 필터링
                if (searchPlayers && game.players_recommended) {
                    includeGame = includeGame && isInRange(searchPlayers, game.players_recommended.toString());
                }
                
                // 베스트 인원 검색 필터링
                if (searchBest && game.players_best) {
                    includeGame = includeGame && isInRange(searchBest, game.players_best.toString());
                }
                
                return includeGame;
            });
            
            const filterEndTime = Date.now();
            console.log(`🎯 필터링 시간: ${filterEndTime - filterStartTime}ms, 필터링 후 개수: ${allGames.length}`);
            
            // 필터링 후 총 개수와 페이지네이션
            total = allGames.length;
            const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE;
            games = allGames.slice(from, to);
        } else {
            // 일반 검색의 경우 기존 페이지네이션 사용
            const from = (page - 1) * PAGE_SIZE;
            const to = from + PAGE_SIZE - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;
            if (error) throw error;
            games = data || [];
            total = count || 0;
        }

        const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

        const endTime = Date.now();
        console.log(`⚡ 전체 요청 처리 시간: ${endTime - startTime}ms`);

        res.render('index', {
            games,
            currentPage: page,
            totalPages,
            total,
            search,
            searchPlayers,
            searchBest,
            weightMin,
            weightMax,
            showFavoritesOnly,
            sortBy,
            sortOrder
        });
    } catch (error) {
        console.error('데이터베이스 오류:', error);
        res.status(500).send('데이터베이스 오류가 발생했습니다.');
    }
});

// 즐겨찾기 토글
app.post('/toggle-favorite', async (req, res) => {
    const { rowId, currentFav } = req.body;
    const newFav = currentFav ? 0 : 1;

    try {
        const { error } = await supabase
            .from('boardgames')
            .update({ is_favorite: newFav })
            .eq('bgg_id', rowId);
        
        if (error) throw error;
        res.json({ success: true, isFavorite: newFav });
    } catch (error) {
        console.error('즐겨찾기 토글 오류:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// 리뷰 추가
app.post('/add-review', async (req, res) => {
    const { bggId, rating, text } = req.body;

    try {
        const { error } = await supabase
            .from('reviews')
            .insert([{ bgg_id: bggId, rating, text }]);
        
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('리뷰 추가 오류:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// 리뷰 조회
app.get('/get-review', async (req, res) => {
    const { bggId } = req.query;

    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('rating, text')
            .eq('bgg_id', bggId)
            .order('created_at', { ascending: false })
            .limit(1);
        
        if (error) throw error;
        const review = data?.[0];
        res.json({ success: true, review });
    } catch (error) {
        console.error('리뷰 조회 오류:', error);
        res.status(500).json({ error: 'Database error' });
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 