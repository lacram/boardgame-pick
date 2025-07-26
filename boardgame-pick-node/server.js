const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = 3000;

// 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 데이터베이스 연결
const db = new sqlite3.Database(path.join(__dirname, '../boardgames.db'));

// 데이터베이스 초기화
function initDB() {
    db.serialize(() => {
        // boardgames 테이블 생성
        db.run(`CREATE TABLE IF NOT EXISTS boardgames (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bgg_id INTEGER UNIQUE,
            name TEXT NOT NULL,
            korean_name TEXT,
            main_image_url TEXT,
            players_min INTEGER,
            players_max INTEGER,
            players_best TEXT,
            players_recommended TEXT,
            play_time_min INTEGER,
            play_time_max INTEGER,
            age INTEGER,
            weight REAL,
            rating REAL,
            type TEXT,
            category TEXT,
            mechanism TEXT,
            url TEXT,
            is_favorite INTEGER DEFAULT 0
        )`);

        // korean_name 컬럼 추가 (기존 테이블에 없으면)
        db.run(`ALTER TABLE boardgames ADD COLUMN korean_name TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('korean_name 컬럼 추가 중 오류:', err);
            }
        });
        
        // players_recommended 컬럼 추가 (기존 테이블에 없으면)
        db.run(`ALTER TABLE boardgames ADD COLUMN players_recommended TEXT`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('players_recommended 컬럼 추가 중 오류:', err);
            }
        });
        
        // is_favorite 컬럼 추가 (기존 테이블에 없으면)
        db.run(`ALTER TABLE boardgames ADD COLUMN is_favorite INTEGER DEFAULT 0`, (err) => {
            if (err && !err.message.includes('duplicate column name')) {
                console.error('is_favorite 컬럼 추가 중 오류:', err);
            }
        });
        
        // players_best 컬럼 타입을 TEXT로 변경
        db.all(`PRAGMA table_info(boardgames)`, (err, rows) => {
            if (!err && rows) {
                // players_best 컬럼이 INTEGER인지 확인
                const playersBestColumn = rows.find(row => row.name === 'players_best');
                if (playersBestColumn && playersBestColumn.type === 'INTEGER') {
                    console.log('players_best 컬럼 타입을 TEXT로 변경 중...');
                    // SQLite에서는 컬럼 타입 변경이 제한적이므로 임시 테이블 사용
                    db.serialize(() => {
                        db.run(`CREATE TABLE boardgames_temp AS SELECT * FROM boardgames`);
                        db.run(`DROP TABLE boardgames`);
                        db.run(`CREATE TABLE boardgames (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            bgg_id INTEGER UNIQUE,
                            name TEXT NOT NULL,
                            korean_name TEXT,
                            main_image_url TEXT,
                            players_min INTEGER,
                            players_max INTEGER,
                            players_best TEXT,
                            players_recommended TEXT,
                            play_time_min INTEGER,
                            play_time_max INTEGER,
                            age INTEGER,
                            weight REAL,
                            rating REAL,
                            type TEXT,
                            category TEXT,
                            mechanism TEXT,
                            url TEXT,
                            is_favorite INTEGER DEFAULT 0
                        )`);
                        db.run(`INSERT INTO boardgames SELECT * FROM boardgames_temp`);
                        db.run(`DROP TABLE boardgames_temp`);
                        console.log('players_best 컬럼 타입이 TEXT로 변경되었습니다.');
                    });
                }
            }
        });

        // reviews 테이블 생성
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bgg_id INTEGER,
            rating INTEGER,
            text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

// 메인 페이지
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const searchPlayers = req.query.searchPlayers || '';
    const searchBest = req.query.searchBest || '';
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

// 크롤링 시작
app.post('/start-crawling', async (req, res) => {
    res.json({ message: '크롤링이 시작되었습니다. (실제 구현은 별도 스크립트로)' });
});

// 서버 시작
initDB();
app.listen(PORT, () => {
    console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
}); 