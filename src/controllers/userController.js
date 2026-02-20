const userService = require('../services/userService');
const config = require('../../config');

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
            const data = await userService.getMyPageData(req.userId);
            res.render('mypage', {
                currentUserId: req.userId,
                ...data
            });
        } catch (error) {
            console.error('마이페이지 조회 오류:', error);
            res.status(500).render('error', { 
                message: '마이페이지를 불러오는 중 오류가 발생했습니다.' 
            });
        }
    }

    _isValidUserId(userId) {
        if (!userId || typeof userId !== 'string') return false;
        if (userId.length < 1 || userId.length > 40) return false;
        return /^[a-zA-Z0-9_-]+$/.test(userId);
    }

    _buildUserCookie(userId) {
        const encoded = encodeURIComponent(userId);
        const maxAge = 60 * 60 * 24 * 365;
        return `bgp_user=${encoded}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
}

module.exports = new UserController();
