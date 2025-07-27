const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const supabase = require('./sqlite/migrate-to-supabase');

const app = express();
const PORT = process.env.PORT;

// 미들웨어 설정
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 데이터베이스 연결 (로컬에서는 SQLite, 배포에서는 Supabase)
let db;
let useSupabase = false;

if (process.env.NODE_ENV === 'production' && process.env.SUPABASE_URL) {
    useSupabase = true;
    console.log('Supabase 사용');
} else {
    db = new sqlite3.Database(path.join(__dirname, 'boardgames.db'));
    console.log('SQLite 사용');
}

// 메인 페이지
app.get('/', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const searchPlayers = req.query.searchPlayers || '';
    const searchBest = req.query.searchBest || '';
    const weightMin = req.query.weightMin || '';
    const weightMax = req.query.weightMax || '';
    const showFavoritesOnly = req.query.showFavoritesOnly === 'on';
    const sortBy = req.query.sortBy || 'rating';
    const sortOrder = req.query.sortOrder || 'desc';
    const pageSize = 20;

    try {
        let games = [];
        let total = 0;

        if (useSupabase) {
            // Supabase 쿼리
            let query = supabase
                .from('boardgames')
                .select('*', { count: 'exact' });

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
            if (sortBy === 'rating') {
                query = query.order('rating', { ascending: sortOrder === 'asc' });
            } else if (sortBy === 'weight') {
                query = query.order('weight', { ascending: sortOrder === 'asc' });
            } else if (sortBy === 'name') {
                query = query.order('name', { ascending: sortOrder === 'asc' });
            }

            // 페이지네이션
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            query = query.range(from, to);

            const { data, error, count } = await query;
            
            if (error) throw error;
            
            games = data || [];
            total = count || 0;

            // 리뷰 정보 추가
            for (let game of games) {
                const { data: review } = await supabase
                    .from('reviews')
                    .select('rating')
                    .eq('bgg_id', game.bgg_id)
                    .order('created_at', { ascending: false })
                    .limit(1);
                
                game.myRating = review?.[0]?.rating || null;
                game.displayName = game.korean_name || game.name;
            }

        } else {
            // SQLite 쿼리 (기존 코드)
            let query = `SELECT 
                rowid as rowid, bgg_id, name, korean_name, main_image_url, players_min, players_max, players_best, players_recommended,
                play_time_min, play_time_max, weight, rating, type, category, mechanism, url, is_favorite
                FROM boardgames WHERE 1=1`;
            let params = [];

            if (search) {
                query += ' AND (name LIKE ? OR korean_name LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }
            if (weightMin) {
                try {
                    const minWeight = parseFloat(weightMin);
                    if (!isNaN(minWeight)) {
                        query += ' AND weight >= ?';
                        params.push(minWeight);
                    }
                } catch (e) {}
            }
            if (weightMax) {
                try {
                    const maxWeight = parseFloat(weightMax);
                    if (!isNaN(maxWeight)) {
                        query += ' AND weight <= ?';
                        params.push(maxWeight);
                    }
                } catch (e) {}
            }
            if (showFavoritesOnly) {
                query += ' AND is_favorite = 1';
            }

            // 정렬
            let orderBy = '';
            if (sortBy === 'myRating') {
                orderBy = `ORDER BY (
                    SELECT rating FROM reviews 
                    WHERE reviews.bgg_id = boardgames.bgg_id 
                    ORDER BY created_at DESC LIMIT 1
                ) ${sortOrder.toUpperCase()}, rating DESC`;
            } else {
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

                total = row['COUNT(*)'];
                const totalPages = Math.max(1, Math.ceil(total / pageSize));
                const offset = (page - 1) * pageSize;

                // 데이터 조회
                query += ' ' + orderBy + ' LIMIT ? OFFSET ?';
                params.push(pageSize, offset);

                db.all(query, params, (err, rows) => {
                    if (err) {
                        console.error(err);
                        return res.status(500).send('Database error');
                    }

                    // 리뷰 정보 조회
                    const gamesWithReviews = rows.map(game => {
                        return new Promise((resolve) => {
                            db.get('SELECT rating FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC LIMIT 1', 
                                [game.bgg_id], (err, review) => {
                                game.myRating = review ? review.rating : null;
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
            return;
        }

        const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
        if (useSupabase) {
            const { error } = await supabase
                .from('boardgames')
                .update({ is_favorite: newFav })
                .eq('rowid', rowId);
            
            if (error) throw error;
        } else {
            db.run('UPDATE boardgames SET is_favorite = ? WHERE rowid = ?', 
                [newFav, rowId], function(err) {
                if (err) {
                    console.error('데이터베이스 에러:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
            });
        }
        
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
        if (useSupabase) {
            const { error } = await supabase
                .from('reviews')
                .insert([{ bgg_id: bggId, rating, text }]);
            
            if (error) throw error;
        } else {
            db.run('INSERT INTO reviews (bgg_id, rating, text) VALUES (?, ?, ?)', 
                [bggId, rating, text], (err) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Database error' });
                }
            });
        }
        
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
        let review;
        
        if (useSupabase) {
            const { data, error } = await supabase
                .from('reviews')
                .select('rating, text')
                .eq('bgg_id', bggId)
                .order('created_at', { ascending: false })
                .limit(1);
            
            if (error) throw error;
            review = data?.[0];
        } else {
            db.get('SELECT rating, text FROM reviews WHERE bgg_id = ? ORDER BY created_at DESC LIMIT 1', 
                [bggId], (err, reviewData) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({ error: 'Database error' });
                }
                review = reviewData;
            });
        }
        
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