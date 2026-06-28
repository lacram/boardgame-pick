const userService = require('../services/userService');
const recommendationService = require('../services/recommendationService');
const config = require('../../config');
const { serializeCookie, signValue } = require('../utils/cookieUtils');
const { buildCookieOptions } = require('../middleware/securityMiddleware');

class UserController {
    async listUsers(req, res) {
        try {
            const users = await userService.listUsers();
            res.json({ success: true, users });
        } catch (error) {
            console.error('유저 목록 조회 오류:', error);
            res.status(500).json({ error: '유저 목록을 불러오는 중 오류가 발생했습니다.' });
        }
    }

    async addUser(req, res) {
        try {
            const { userId } = req.body;

            if (!this._isValidUserId(userId)) {
                return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
            }

            await userService.addUser(userId);
            res.json({ success: true, id: userId });
        } catch (error) {
            console.error('유저 추가 오류:', error);
            res.status(500).json({ error: '유저를 추가하는 중 오류가 발생했습니다.' });
        }
    }

    async selectUser(req, res) {
        try {
            const { userId } = req.body;

            if (!this._isValidUserId(userId)) {
                return res.status(400).json({ error: '유효한 사용자 ID가 필요합니다.' });
            }

            await userService.ensureUserExists(userId);

            res.setHeader('Set-Cookie', this._buildUserCookie(userId));
            res.json({ success: true, id: userId });
        } catch (error) {
            console.error('유저 선택 오류:', error);
            res.status(500).json({ error: '유저를 변경하는 중 오류가 발생했습니다.' });
        }
    }

    async myPage(req, res) {
        try {
            const activeTab = this._normalizeMyPageTab(req.query.tab);
            const recommendationPage = this._parsePositiveInt(req.query.recommendationPage, 1);
            const data = await userService.getMyPageData(req.userId);
            const recommendations = await this._loadRecommendations(req.userId, recommendationPage);

            res.render('mypage', {
                currentUserId: req.userId,
                activeTab,
                recommendations: recommendations.items,
                recommendationPage: recommendations.page,
                recommendationTotal: recommendations.total,
                recommendationTotalPages: recommendations.totalPages,
                recommendationPageUrl: this._buildRecommendationPageUrl,
                ...data
            });
        } catch (error) {
            console.error('마이페이지 조회 오류:', error);
            res.status(500).render('error', { 
                message: '마이페이지를 불러오는 중 오류가 발생했습니다.' 
            });
        }
    }

    async _loadRecommendations(userId, page) {
        try {
            return await recommendationService.getRecommendationPage(userId, {
                page,
                pageSize: 18
            });
        } catch (error) {
            console.error('마이페이지 추천 게임 조회 오류:', error);
            return {
                items: [],
                total: 0,
                page: 1,
                pageSize: 18,
                totalPages: 1,
                nextPage: 1
            };
        }
    }

    _normalizeMyPageTab(tab) {
        const allowedTabs = new Set([
            'favorites',
            'wishlist',
            'owned',
            'planned',
            'reviews',
            'recommendations'
        ]);
        return allowedTabs.has(tab) ? tab : 'favorites';
    }

    _parsePositiveInt(value, fallback) {
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    _buildRecommendationPageUrl(page) {
        const query = new URLSearchParams({
            tab: 'recommendations',
            recommendationPage: String(page)
        });
        return `/mypage?${query.toString()}`;
    }

    _isValidUserId(userId) {
        if (!userId || typeof userId !== 'string') return false;
        if (userId.length < 1 || userId.length > 40) return false;
        return /^[a-zA-Z0-9_-]+$/.test(userId);
    }

    _buildUserCookie(userId) {
        const maxAge = 60 * 60 * 24 * 365;
        return serializeCookie(
            'bgp_user',
            signValue(userId, config.security.cookieSecret),
            buildCookieOptions({ maxAge })
        );
    }
}

module.exports = new UserController();
