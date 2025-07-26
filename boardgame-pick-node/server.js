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
            main_image_url TEXT,
            players_min INTEGER,
            players_max INTEGER,
            players_best TEXT,
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
    const pageSize = 20;

    // 쿼리 빌드
    let query = `SELECT 
        rowid as rowid, bgg_id, name, main_image_url, players_min, players_max, players_best,
        play_time_min, play_time_max, weight, rating, type, category, mechanism, url, is_favorite
        FROM boardgames WHERE 1=1`;
    let params = [];

    if (search) {
        query += ' AND name LIKE ?';
        params.push(`%${search}%`);
    }
    if (searchPlayers) {
        try {
            const n = parseInt(searchPlayers);
            query += ' AND players_min <= ? AND players_max >= ?';
            params.push(n, n);
        } catch (e) {
            // 숫자가 아닌 경우 무시
        }
    }
    if (searchBest) {
        query += ' AND players_best LIKE ?';
        params.push(`%${searchBest}%`);
    }
    if (showFavoritesOnly) {
        query += ' AND is_favorite = 1';
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

        // 데이터 조회
        query += ' LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        db.all(query, params, (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Database error');
            }

            // 각 게임의 리뷰 정보 조회
            const gamesWithReviews = rows.map(game => {
                return new Promise((resolve) => {
                    db.get('SELECT rating FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC LIMIT 1', 
                        [game.bgg_id], (err, review) => {
                        game.myRating = review ? review.rating : null;
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
                    showFavoritesOnly
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