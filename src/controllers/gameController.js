const gameService = require('../services/gameService');
const recommendationService = require('../services/recommendationService');
const config = require('../../config');
const { normalizeSortBy, normalizeSortOrder } = require('../utils/sortUtils');
const {
    CATEGORY_OPTIONS,
    MECHANISM_OPTIONS
} = require('../utils/discoveryFilters');

function toBooleanState(value) {
    return value === true || value === 1 || value === '1';
}

class GameController {
    /**
     * 메인 페이지 - 게임 목록
     */
    async index(req, res) {
        try {
            // 쿼리 파라미터 파싱
            const searchParams = this._parseSearchParams(req.query);
            
            // 캐시 키 생성
            const cacheKey = this._generateCacheKey(searchParams, req.userId);
            
            // 캐시 확인 (캐시 객체는 미들웨어에서 주입됨)
            const cached = req.cache.get(cacheKey);
            if (cached) {
                return res.render('index', cached);
            }

            // 게임 데이터 조회
            const { games, total, totalPages, lastSyncAt } = await gameService.getGames(searchParams, req.userId);
            const recommendationResult = await this._loadRecommendations(searchParams, req.userId);

            const renderData = {
                games,
                recommendations: recommendationResult.recommendations,
                recommendationEmptyState: recommendationResult.emptyState,
                currentPage: searchParams.page,
                totalPages,
                total,
                lastSyncAt,
                currentUserId: req.userId,
                buildPageUrl: this._buildPageUrlFactory(searchParams),
                ...this._extractSearchParams(searchParams)
            };

            // 캐시 저장
            if (!recommendationResult.failed) {
                req.cache.set(cacheKey, renderData);
            }

            res.render('index', renderData);
        } catch (error) {
            console.error('게임 목록 조회 오류:', error);
            res.status(500).render('error', { 
                message: '게임 목록을 불러오는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 즐겨찾기 토글
     */
    async toggleFavorite(req, res) {
        try {
            const { rowId, currentFav } = req.body;
            
            if (!rowId || currentFav === undefined) {
                return res.status(400).json({ 
                    error: '필수 파라미터가 누락되었습니다.' 
                });
            }

            const result = await gameService.toggleFavorite(req.userId, rowId, toBooleanState(currentFav));
            
            this._clearUserCache(req);
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('즐겨찾기 토글 오류:', error);
            res.status(500).json({ 
                error: '즐겨찾기 상태를 변경하는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 플레이 예정 토글
     */
    async toggleWishlist(req, res) {
        try {
            const { rowId, currentWishlist } = req.body;
            
            if (!rowId || currentWishlist === undefined) {
                return res.status(400).json({ 
                    error: '필수 파라미터가 누락되었습니다.' 
                });
            }

            const result = await gameService.toggleWishlist(req.userId, rowId, toBooleanState(currentWishlist));
            
            this._clearUserCache(req);
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('위시리스트 토글 오류:', error);
            res.status(500).json({ 
                error: '위시리스트 상태를 변경하는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 플레이 예정 토글
     */
    async togglePlanned(req, res) {
        try {
            const { rowId, currentPlanned } = req.body;
            
            if (!rowId || currentPlanned === undefined) {
                return res.status(400).json({ 
                    error: '필수 파라미터가 누락되었습니다.' 
                });
            }

            const result = await gameService.togglePlanned(req.userId, rowId, toBooleanState(currentPlanned));
            
            this._clearUserCache(req);
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('플레이 예정 토글 오류:', error);
            res.status(500).json({ 
                error: '플레이 예정 상태를 변경하는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 보유 토글
     */
    async toggleOwned(req, res) {
        try {
            const { rowId, currentOwned } = req.body;
            
            if (!rowId || currentOwned === undefined) {
                return res.status(400).json({ 
                    error: '필수 파라미터가 누락되었습니다.' 
                });
            }

            const result = await gameService.toggleOwned(req.userId, rowId, toBooleanState(currentOwned));
            
            this._clearUserCache(req);
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('보유 토글 오류:', error);
            res.status(500).json({ 
                error: '보유 상태를 변경하는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 리뷰 추가
     */
    async addReview(req, res) {
        try {
            const { bggId, rating, text } = req.body;
            
            if (!bggId || !rating) {
                return res.status(400).json({ 
                    error: '게임 ID와 평점은 필수입니다.' 
                });
            }

            if (rating < 1 || rating > 10) {
                return res.status(400).json({ 
                    error: '평점은 1-10 사이의 값이어야 합니다.' 
                });
            }

            const result = await gameService.addReview(req.userId, bggId, rating, text);
            
            this._clearUserCache(req);
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('리뷰 추가 오류:', error);
            res.status(500).json({ 
                error: '리뷰를 저장하는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 리뷰 조회
     */
    async getReview(req, res) {
        try {
            const { bggId } = req.query;
            
            if (!bggId) {
                return res.status(400).json({ 
                    error: '게임 ID가 필요합니다.' 
                });
            }

            const review = await gameService.getReview(req.userId, bggId);
            
            res.json({ 
                success: true,
                review: review || null
            });
        } catch (error) {
            console.error('리뷰 조회 오류:', error);
            res.status(500).json({ 
                error: '리뷰를 조회하는 중 오류가 발생했습니다.' 
            });
        }
    }

    /**
     * 검색 파라미터 파싱
     */
    _parseSearchParams(query) {
        return {
            page: parseInt(query.page) || 1,
            search: query.search || '',
            searchPlayers: query.searchPlayers || '',
            searchBest: query.searchBest || '',
            category: query.category || '',
            mechanism: query.mechanism || '',
            weightMin: query.weightMin || '',
            weightMax: query.weightMax || '',
            showFavoritesOnly: query.showFavoritesOnly === 'on',
            showWishlistOnly: query.showWishlistOnly === 'on',
            showOwnedOnly: query.showOwnedOnly === 'on',
            showPlannedOnly: query.showPlannedOnly === 'on',
            sortBy: normalizeSortBy(query.sortBy, config.defaultSortBy),
            sortOrder: normalizeSortOrder(query.sortOrder, config.defaultSortOrder)
        };
    }

    /**
     * 캐시 키 생성
     */
    _generateCacheKey(params, userId) {
        const { 
            search, searchPlayers, searchBest, category, mechanism, weightMin, weightMax,
            showFavoritesOnly, showWishlistOnly, showOwnedOnly, showPlannedOnly, sortBy, sortOrder, page 
        } = params;
        
        return `${userId}-${search}-${searchPlayers}-${searchBest}-${category}-${mechanism}-${weightMin}-${weightMax}-${showFavoritesOnly}-${showWishlistOnly}-${showOwnedOnly}-${showPlannedOnly}-${sortBy}-${sortOrder}-${page}`;
    }

    _clearUserCache(req) {
        const prefix = `${req.userId}-`;
        if (typeof req.cache.clearByPrefix === 'function') {
            req.cache.clearByPrefix(prefix);
            return;
        }
        req.cache.clear();
    }

    /**
     * 렌더링용 검색 파라미터 추출
     */
    _extractSearchParams(params) {
        return {
            search: params.search,
            searchPlayers: params.searchPlayers,
            searchBest: params.searchBest,
            category: params.category,
            mechanism: params.mechanism,
            categoryOptions: CATEGORY_OPTIONS,
            mechanismOptions: MECHANISM_OPTIONS,
            weightMin: params.weightMin,
            weightMax: params.weightMax,
            showFavoritesOnly: params.showFavoritesOnly,
            showOwnedOnly: params.showOwnedOnly,
            showWishlistOnly: params.showWishlistOnly,
            showPlannedOnly: params.showPlannedOnly,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder
        };
    }

    _buildPageUrlFactory(params) {
        return function buildPageUrl(page) {
            const query = new URLSearchParams();
            query.set('page', String(page));

            const stringParams = ['search', 'searchPlayers', 'searchBest', 'category', 'mechanism', 'weightMin', 'weightMax'];
            stringParams.forEach(key => {
                if (params[key]) query.set(key, params[key]);
            });

            const flagParams = ['showFavoritesOnly', 'showWishlistOnly', 'showOwnedOnly', 'showPlannedOnly'];
            flagParams.forEach(key => {
                if (params[key]) query.set(key, 'on');
            });

            query.set('sortBy', params.sortBy);
            query.set('sortOrder', params.sortOrder);
            return `?${query.toString()}`;
        };
    }

    _shouldLoadRecommendations(params) {
        if (params.page !== 1) return false;

        const stringFilters = [
            'search',
            'searchPlayers',
            'searchBest',
            'category',
            'mechanism',
            'weightMin',
            'weightMax'
        ];
        if (stringFilters.some(key => Boolean(params[key]))) return false;

        return !params.showFavoritesOnly
            && !params.showWishlistOnly
            && !params.showOwnedOnly
            && !params.showPlannedOnly;
    }

    async _loadRecommendations(params, userId) {
        if (!this._shouldLoadRecommendations(params)) {
            return { recommendations: [], emptyState: false, failed: false };
        }

        try {
            const recommendations = await recommendationService.getRecommendations(userId, 3);
            return {
                recommendations,
                emptyState: recommendations.length === 0,
                failed: false
            };
        } catch (error) {
            console.error('추천 게임 조회 오류:', error);
            return { recommendations: [], emptyState: false, failed: true };
        }
    }
}

module.exports = new GameController();
