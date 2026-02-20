const supabase = require('../../supabase-client');
const { parsePlayersToSet } = require('../../utils/searchUtils');
const config = require('../../config');

class GameService {
    /**
     * 게임 목록을 가져오는 메인 서비스 함수
     */
    async getGames(searchParams, userId) {
        const {
            search, searchPlayers, searchBest,
            weightMin, weightMax, showFavoritesOnly, showWishlistOnly, showOwnedOnly, showPlannedOnly,
            sortBy, sortOrder, page
        } = searchParams;

        let userFilteredIds = null;
        const hasFlagFilters = showFavoritesOnly || showWishlistOnly || showOwnedOnly || showPlannedOnly;

        if (hasFlagFilters) {
            const flagFilters = [];
            if (showFavoritesOnly) flagFilters.push('is_favorite.eq.true');
            if (showWishlistOnly) flagFilters.push('is_wishlist.eq.true');
            if (showOwnedOnly) flagFilters.push('is_owned.eq.true');
            if (showPlannedOnly) flagFilters.push('is_planned.eq.true');

            let userQuery = supabase
                .from('user_data')
                .select('bgg_id')
                .eq('user_id', userId);

            if (flagFilters.length > 1) {
                userQuery = userQuery.or(flagFilters.join(','));
            } else if (flagFilters.length === 1) {
                const [filter] = flagFilters;
                const [column] = filter.split('.');
                userQuery = userQuery.eq(column, true);
            }

            const { data: userRows, error: userError } = await userQuery;
            if (userError) throw userError;
            userFilteredIds = (userRows || []).map(row => row.bgg_id);

            if (userFilteredIds.length === 0) {
                return { games: [], total: 0, totalPages: 1 };
            }
        }

        const needsMyRatingSort = sortBy === 'myRating';

        let query = supabase
            .from('boardgames')
            .select(`
                id, name, korean_name, rating, weight,
                players_recommended, players_best, players_recommended_raw, players_best_raw,
                bgg_id, main_image_url, url, 
                play_time_min, play_time_max
            `, { count: needsMyRatingSort ? 'exact' : 'exact' });

        query = this._applyFilters(query, {
            search, searchPlayers, searchBest, weightMin, weightMax
        });

        if (userFilteredIds) {
            query = query.in('bgg_id', userFilteredIds);
        }

        if (!needsMyRatingSort) {
            query = this._applySorting(query, sortBy, sortOrder);
        }

        let games, total;

        if (needsMyRatingSort) {
            ({ games, total } = await this._handleFullSearch(query));
        } else {
            ({ games, total } = await this._handleRegularSearch(query, page));
        }

        if (games.length === 0) {
            return { games: [], total: 0, totalPages: 1 };
        }

        const userDataMap = await this._getUserDataMap(userId, games.map(game => game.bgg_id));
        this._mergeUserData(games, userDataMap);

        if (needsMyRatingSort) {
            games = this._sortByMyRating(games, sortOrder);
            const from = (page - 1) * config.pageSize;
            const to = from + config.pageSize;
            games = games.slice(from, to);
        }

        if (games.length > 0) {
            this._decorateGames(games);
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
            weightMin, weightMax
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
        return query;
    }

    /**
     * 정렬 로직 적용
     */
    _applySorting(query, sortBy, sortOrder) {
        const normalizedSortBy = sortBy === 'myRating' ? 'my_rating' : sortBy;
        const validSortFields = ['rating', 'weight', 'name', 'my_rating'];
        if (validSortFields.includes(normalizedSortBy)) {
            query = query.order(normalizedSortBy, { ascending: sortOrder === 'asc' });
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

    async _handleFullSearch(query) {
        const { data, error, count } = await query;

        if (error) throw error;

        return {
            games: data || [],
            total: count || 0
        };
    }

    async _getUserDataMap(userId, bggIds) {
        if (!bggIds || bggIds.length === 0) return new Map();

        const { data, error } = await supabase
            .from('user_data')
            .select('bgg_id, is_favorite, is_wishlist, is_owned, is_planned, my_rating')
            .eq('user_id', userId)
            .in('bgg_id', bggIds);

        if (error) throw error;

        const map = new Map();
        (data || []).forEach(row => {
            map.set(row.bgg_id, row);
        });
        return map;
    }

    _mergeUserData(games, userDataMap) {
        games.forEach(game => {
            const userData = userDataMap.get(game.bgg_id);
            game.is_favorite = userData?.is_favorite || false;
            game.is_wishlist = userData?.is_wishlist || false;
            game.is_owned = userData?.is_owned || false;
            game.is_planned = userData?.is_planned || false;
            game.my_rating = userData?.my_rating || null;
        });
    }

    _sortByMyRating(games, sortOrder) {
        const direction = sortOrder === 'asc' ? 1 : -1;
        return games.slice().sort((a, b) => {
            const aRating = a.my_rating || 0;
            const bRating = b.my_rating || 0;
            if (aRating === bRating) return 0;
            if (aRating === 0) return 1;
            if (bRating === 0) return -1;
            return (aRating - bRating) * direction;
        });
    }

    /**
     * 게임에 리뷰 정보 첨부
     */
    _decorateGames(games) {
        games.forEach(game => {
            game.myRating = game.my_rating || null;
            game.displayName = game.korean_name || game.name;
            game.playersRecommendedDisplay = game.players_recommended_raw || game.players_recommended || '';
            game.playersBestDisplay = game.players_best_raw || game.players_best || '';
        });
    }

    /**
     * 즐겨찾기 토글
     */
    async toggleFavorite(userId, bggId, currentFav) {
        const newFav = currentFav ? 0 : 1;
        
        const { error } = await supabase
            .from('user_data')
            .upsert([{ user_id: userId, bgg_id: bggId, is_favorite: newFav }], {
                onConflict: 'user_id,bgg_id'
            });

        if (error) throw error;
        
        return { isFavorite: newFav };
    }

    /**
     * 플레이 예정 토글
     */
    async toggleWishlist(userId, bggId, currentWishlist) {
        const newWishlist = currentWishlist ? 0 : 1;
        
        const { error } = await supabase
            .from('user_data')
            .upsert([{ user_id: userId, bgg_id: bggId, is_wishlist: newWishlist }], {
                onConflict: 'user_id,bgg_id'
            });

        if (error) throw error;
        
        return { isWishlist: newWishlist };
    }

    async togglePlanned(userId, bggId, currentPlanned) {
        const newPlanned = currentPlanned ? 0 : 1;
        
        const { error } = await supabase
            .from('user_data')
            .upsert([{ user_id: userId, bgg_id: bggId, is_planned: newPlanned }], {
                onConflict: 'user_id,bgg_id'
            });

        if (error) throw error;
        
        return { isPlanned: newPlanned };
    }

    /**
     * 보유 토글
     */
    async toggleOwned(userId, bggId, currentOwned) {
        const newOwned = currentOwned ? 0 : 1;
        
        const { error } = await supabase
            .from('user_data')
            .upsert([{ user_id: userId, bgg_id: bggId, is_owned: newOwned }], {
                onConflict: 'user_id,bgg_id'
            });

        if (error) throw error;
        
        return { isOwned: newOwned };
    }

    /**
     * 리뷰 추가
     */
    async addReview(userId, bggId, rating, text) {
        const { error } = await supabase
            .from('reviews')
            .upsert([{ user_id: userId, bgg_id: bggId, rating, text }], {
                onConflict: 'user_id,bgg_id'
            });

        if (error) throw error;

        const { error: ratingError } = await supabase
            .from('user_data')
            .upsert([{ user_id: userId, bgg_id: bggId, my_rating: rating }], {
                onConflict: 'user_id,bgg_id'
            });

        if (ratingError) throw ratingError;
        
        return { success: true, rating, text: text || '' };
    }

    /**
     * 리뷰 조회
     */
    async getReview(userId, bggId) {
        const { data, error } = await supabase
            .from('reviews')
            .select('rating, text')
            .eq('bgg_id', bggId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) throw error;
        
        return data?.[0] || null;
    }
}

module.exports = new GameService();
