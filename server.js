const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 데이터베이스 연결
const db = new sqlite3.Database(path.join(__dirname, './boardgames.db'));

// 메인 페이지
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const searchPlayers = req.query.searchPlayers || '';
    const searchBest = req.query.searchBest || '';
    const weightMin = req.query.weightMin || '';
    const weightMax = req.query.weightMax || '';
    const showFavoritesOnly = req.query.showFavoritesOnly === 'on';
    const sortBy = req.query.sortBy || 'rating'; // 기본값: geek rating
    const sortOrder = req.query.sortOrder || 'desc'; // 기본값: 내림차순
    const pageSize = 20;

    // 쿼리 빌드 - 한글 제목과 영어 제목 모두 검색 가능
    let query = `SELECT 
        rowid as rowid, bgg_id, name, korean_name, main_image_url, players_min, players_max, players_best, players_recommended,
        play_time_min, play_time_max, weight, rating, type, category, mechanism, url, is_favorite
        FROM boardgames WHERE 1=1`;
    let params = [];

    if (search) {
        query += ' AND (name LIKE ? OR korean_name LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (searchPlayers) {
        try {
            // 범위 검색 지원 (예: "2-4", "3-6")
            if (searchPlayers.includes('-')) {
                const [minPlayers, maxPlayers] = searchPlayers.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(minPlayers) && !isNaN(maxPlayers)) {
                    // 입력한 범위와 recommend 플레이어 수가 겹치는 게임들 검색
                    query += ` AND (
                        players_recommended LIKE '%${minPlayers}%' OR 
                        players_recommended LIKE '%${maxPlayers}%' OR
                        players_recommended LIKE '%${minPlayers}-${maxPlayers}%' OR
                        players_recommended LIKE '%${minPlayers}~${maxPlayers}%' OR
                        players_recommended LIKE '%${minPlayers},${maxPlayers}%' OR
                        players_recommended LIKE '%${maxPlayers},${minPlayers}%'
                    )`;
                }
            } else {
                // 단일 숫자 검색
                const n = parseInt(searchPlayers);
                if (!isNaN(n)) {
                    // 입력한 숫자가 recommend 플레이어 수에 포함되는 경우
                    query += ' AND players_recommended LIKE ?';
                    params.push(`%${searchPlayers}%`);
                } else {
                    // 숫자가 아닌 경우 무시
                }
            }
        } catch (e) {
            // 숫자가 아닌 경우 무시
        }
    }
    if (searchBest) {
        try {
            // 범위 검색 지원 (예: "1-3", "2-4")
            if (searchBest.includes('-')) {
                const [minBest, maxBest] = searchBest.split('-').map(s => parseInt(s.trim()));
                if (!isNaN(minBest) && !isNaN(maxBest)) {
                    // 베스트 인원과 입력 범위의 교집합이 있거나, 입력 범위에 속하는 숫자가 있는 경우
                    query += ` AND (
                        players_best LIKE '%${minBest}%' OR 
                        players_best LIKE '%${maxBest}%' OR
                        players_best LIKE '%${minBest}-${maxBest}%' OR
                        players_best LIKE '%${minBest}~${maxBest}%' OR
                        players_best LIKE '%${minBest},${maxBest}%' OR
                        players_best LIKE '%${maxBest},${minBest}%'
                    )`;
                }
            } else {
                // 단일 숫자 검색
                const n = parseInt(searchBest);
                if (!isNaN(n)) {
                    // 입력한 숫자가 베스트 인원에 포함되는 경우
                    query += ' AND players_best LIKE ?';
                    params.push(`%${searchBest}%`);
                } else {
                    // 숫자가 아닌 경우 텍스트 검색
                    query += ' AND players_best LIKE ?';
                    params.push(`%${searchBest}%`);
                }
            }
        } catch (e) {
            // 숫자가 아닌 경우 무시
        }
    }
    if (weightMin) {
        try {
            const minWeight = parseFloat(weightMin);
            if (!isNaN(minWeight)) {
                query += ' AND weight >= ?';
                params.push(minWeight);
            }
        } catch (e) {
            // 숫자가 아닌 경우 무시
        }
    }
    
    if (weightMax) {
        try {
            const maxWeight = parseFloat(weightMax);
            if (!isNaN(maxWeight)) {
                query += ' AND weight <= ?';
                params.push(maxWeight);
            }
        } catch (e) {
            // 숫자가 아닌 경우 무시
        }
    }
    
    if (showFavoritesOnly) {
        query += ' AND is_favorite = 1';
    }

    // 정렬 조건 추가
    let orderBy = '';
    if (sortBy === 'myRating') {
        // 내 평점으로 정렬할 때는 서브쿼리 사용
        orderBy = `ORDER BY (
            SELECT rating FROM reviews 
            WHERE reviews.bgg_id = boardgames.bgg_id 
            ORDER BY created_at DESC LIMIT 1
        ) ${sortOrder.toUpperCase()}, rating DESC`;
    } else {
        // 다른 필드로 정렬
        const validSortFields = ['rating', 'weight', 'name', 'players_recommended', 'play_time_min'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'rating';
        orderBy = `ORDER BY ${sortField} ${sortOrder.toUpperCase()}`;
    }

    // 전체 개수 조회
    const countQuery = `SELECT COUNT(*) FROM (${query})`;
    db.get(countQuery, params, (err, row) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        const total = row['COUNT(*)'];
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        const offset = (page - 1) * pageSize;

        // 데이터 조회 (정렬 포함)
        query += ' ' + orderBy + ' LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error');
            }

            // 각 게임의 리뷰 정보 조회 및 표시 제목 결정
            const gamesWithReviews = rows.map(game => {
                return new Promise((resolve) => {
                    db.get('SELECT rating FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC LIMIT 1', 
                        [game.bgg_id], (err, review) => {
                        game.myRating = review ? review.rating : null;
                        
                        // 표시 제목 결정: 한글 제목이 있으면 한글, 없으면 영어
                        game.displayName = game.korean_name || game.name;
                        
                        resolve(game);
                    });
                });
            });

            Promise.all(gamesWithReviews).then(games => {
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
            });
        });
    });
});

// 즐겨찾기 토글
app.post('/toggle-favorite', (req, res) => {
    const { rowId, currentFav } = req.body;
    const newFav = currentFav ? 0 : 1;

    db.run('UPDATE boardgames SET is_favorite = ? WHERE rowid = ?', 
        [newFav, rowId], function(err) {
        if (err) {
            console.error('데이터베이스 에러:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, isFavorite: newFav });
    });
});

// 리뷰 추가
app.post('/add-review', (req, res) => {
    const { bggId, rating, text } = req.body;

    db.run('INSERT INTO reviews (bgg_id, rating, text) VALUES (?, ?, ?)', 
        [bggId, rating, text], (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true });
    });
});

// 리뷰 조회
app.get('/get-review', (req, res) => {
    const { bggId } = req.query;

    db.get('SELECT rating, text FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC LIMIT 1', 
        [bggId], (err, review) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json({ success: true, review });
    });
});



// 서버 시작
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 