const gameService = require('../services/gameService');
const config = require('../../config');

class GameController {
    /**
     * 메인 페이지 - 게임 목록
     */
    async index(req, res) {
        try {
            // 쿼리 파라미터 파싱
            const searchParams = this._parseSearchParams(req.query);
            
            // 캐시 키 생성
            const cacheKey = this._generateCacheKey(searchParams);
            
            // 캐시 확인 (캐시 객체는 미들웨어에서 주입됨)
            const cached = req.cache.get(cacheKey);
            if (cached) {
                return res.render('index', cached);
            }

            // 게임 데이터 조회
            const { games, total, totalPages } = await gameService.getGames(searchParams);

            const renderData = {
                games,
                currentPage: searchParams.page,
                totalPages,
                total,
                ...this._extractSearchParams(searchParams)
            };

            // 캐시 저장
            req.cache.set(cacheKey, renderData);

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

            const result = await gameService.toggleFavorite(rowId, currentFav);
            
            // 캐시 무효화
            req.cache.clear();
            
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
    async toggleScheduled(req, res) {
        try {
            const { rowId, currentScheduled } = req.body;
            
            if (!rowId || currentScheduled === undefined) {
                return res.status(400).json({ 
                    error: '필수 파라미터가 누락되었습니다.' 
                });
            }

            const result = await gameService.toggleScheduled(rowId, currentScheduled);
            
            // 캐시 무효화
            req.cache.clear();
            
            res.json({ success: true, ...result });
        } catch (error) {
            console.error('플레이 예정 토글 오류:', error);
            res.status(500).json({ 
                error: '플레이 예정 상태를 변경하는 중 오류가 발생했습니다.' 
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

            const result = await gameService.addReview(bggId, rating, text);
            
            // 캐시 무효화
            req.cache.clear();
            
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

            const review = await gameService.getReview(bggId);
            
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
            weightMin: query.weightMin || '',
            weightMax: query.weightMax || '',
            showFavoritesOnly: query.showFavoritesOnly === 'on',
            showScheduledOnly: query.showScheduledOnly === 'on',
            sortBy: query.sortBy || config.defaultSortBy,
            sortOrder: query.sortOrder || config.defaultSortOrder
        };
    }

    /**
     * 캐시 키 생성
     */
    _generateCacheKey(params) {
        const { 
            search, searchPlayers, searchBest, weightMin, weightMax,
            showFavoritesOnly, showScheduledOnly, sortBy, sortOrder, page 
        } = params;
        
        return `${search}-${searchPlayers}-${searchBest}-${weightMin}-${weightMax}-${showFavoritesOnly}-${showScheduledOnly}-${sortBy}-${sortOrder}-${page}`;
    }

    /**
     * 렌더링용 검색 파라미터 추출
     */
    _extractSearchParams(params) {
        return {
            search: params.search,
            searchPlayers: params.searchPlayers,
            searchBest: params.searchBest,
            weightMin: params.weightMin,
            weightMax: params.weightMax,
            showFavoritesOnly: params.showFavoritesOnly,
            showScheduledOnly: params.showScheduledOnly,
            sortBy: params.sortBy,
            sortOrder: params.sortOrder
        };
    }
}

module.exports = new GameController();
