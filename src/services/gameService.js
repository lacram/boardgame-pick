const supabase = require('../../supabase-client');
const { parsePlayersToSet } = require('../../utils/searchUtils');
const config = require('../../config');

class GameService {
    /**
     * 게임 목록을 가져오는 메인 서비스 함수
     */
    async getGames(searchParams) {
        const {
            search, searchPlayers, searchBest,
            weightMin, weightMax, showFavoritesOnly, showScheduledOnly,
            sortBy, sortOrder, page
        } = searchParams;

        let query = supabase
            .from('boardgames')
            .select(`
                id, name, korean_name, rating, weight, 
                is_favorite, is_scheduled, players_recommended, 
                players_best, players_recommended_raw, players_best_raw,
                bgg_id, main_image_url, url, 
                play_time_min, play_time_max
            `, { count: 'exact' });

        // 필터링 적용
        query = this._applyFilters(query, {
            search, searchPlayers, searchBest, weightMin, weightMax, showFavoritesOnly, showScheduledOnly
        });

        // 정렬 적용
        query = this._applySorting(query, sortBy, sortOrder);

        let games, total;

        ({ games, total } = await this._handleRegularSearch(query, page));

        // 리뷰 정보 추가
        if (games.length > 0) {
            await this._attachReviews(games);
        }

        const totalPages = Math.max(1, Math.ceil(total / config.pageSize));

        return { games, total, totalPages };
    }

    /**
     * 필터링 로직 적용
     */
    _applyFilters(query, filters) {
        const {
            search, searchPlayers, searchBest,
            weightMin, weightMax, showFavoritesOnly, showScheduledOnly
        } = filters;

        if (search) {
            query = query.or(`name.ilike.%${search}%,korean_name.ilike.%${search}%`);
        }
        if (searchPlayers) {
            const playersSet = parsePlayersToSet(searchPlayers);
            if (playersSet.length > 0) {
                query = query.overlaps('players_recommended_set', playersSet);
            }
        }
        if (searchBest) {
            const bestSet = parsePlayersToSet(searchBest);
            if (bestSet.length > 0) {
                query = query.overlaps('players_best_set', bestSet);
            }
        }
        if (weightMin) {
            query = query.gte('weight', parseFloat(weightMin));
        }
        if (weightMax) {
            query = query.lte('weight', parseFloat(weightMax));
        }
        if (showFavoritesOnly && showScheduledOnly) {
            query = query.or('is_favorite.eq.true,is_scheduled.eq.true');
        } else {
            if (showFavoritesOnly) {
                query = query.eq('is_favorite', true);
            }
            if (showScheduledOnly) {
                query = query.eq('is_scheduled', true);
            }
        }

        return query;
    }

    /**
     * 정렬 로직 적용
     */
    _applySorting(query, sortBy, sortOrder) {
        const validSortFields = ['rating', 'weight', 'name'];
        if (validSortFields.includes(sortBy)) {
            query = query.order(sortBy, { ascending: sortOrder === 'asc' });
        }
        return query;
    }

    /**
     * 일반 검색 처리
     */
    async _handleRegularSearch(query, page) {
        const from = (page - 1) * config.pageSize;
        const to = from + config.pageSize - 1;
        
        query = query.range(from, to);
        const { data, error, count } = await query;
        
        if (error) throw error;

        return {
            games: data || [],
            total: count || 0
        };
    }

    /**
     * 게임에 리뷰 정보 첨부
     */
    async _attachReviews(games) {
        const bggIds = games.map(game => game.bgg_id);
        
        const { data: reviews } = await supabase
            .from('reviews')
            .select('bgg_id, rating')
            .in('bgg_id', bggIds)
            .order('created_at', { ascending: false });

        // 리뷰 맵 생성 (가장 최신 리뷰만)
        const reviewMap = new Map();
        reviews?.forEach(review => {
            if (!reviewMap.has(review.bgg_id)) {
                reviewMap.set(review.bgg_id, review.rating);
            }
        });

        // 게임에 리뷰 정보 추가
        games.forEach(game => {
            game.myRating = reviewMap.get(game.bgg_id) || null;
            game.displayName = game.korean_name || game.name;
            game.playersRecommendedDisplay = game.players_recommended_raw || game.players_recommended || '';
            game.playersBestDisplay = game.players_best_raw || game.players_best || '';
        });
    }

    /**
     * 즐겨찾기 토글
     */
    async toggleFavorite(bggId, currentFav) {
        const newFav = currentFav ? 0 : 1;
        
        const { error } = await supabase
            .from('boardgames')
            .update({ is_favorite: newFav })
            .eq('bgg_id', bggId);

        if (error) throw error;
        
        return { isFavorite: newFav };
    }

    /**
     * 플레이 예정 토글
     */
    async toggleScheduled(bggId, currentScheduled) {
        const newScheduled = currentScheduled ? 0 : 1;
        
        const { error } = await supabase
            .from('boardgames')
            .update({ is_scheduled: newScheduled })
            .eq('bgg_id', bggId);

        if (error) throw error;
        
        return { isScheduled: newScheduled };
    }

    /**
     * 리뷰 추가
     */
    async addReview(bggId, rating, text) {
        const { error } = await supabase
            .from('reviews')
            .insert([{ bgg_id: bggId, rating, text }]);

        if (error) throw error;
        
        return { success: true };
    }

    /**
     * 리뷰 조회
     */
    async getReview(bggId) {
        const { data, error } = await supabase
            .from('reviews')
            .select('rating, text')
            .eq('bgg_id', bggId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        
        return data?.[0] || null;
    }
}

module.exports = new GameService();
