const config = require('../../config');
const userService = require('../services/userService');

function parseCookies(cookieHeader) {
    const cookies = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(';').forEach(part => {
        const [rawKey, ...rest] = part.trim().split('=');
        if (!rawKey) return;
        const value = rest.join('=');
        cookies[rawKey] = decodeURIComponent(value || '');
    });

    return cookies;
}

async function userMiddleware(req, res, next) {
    try {
        const cookies = parseCookies(req.headers.cookie);
        const userId = cookies.bgp_user || config.reviewUserId;

        // 사용자 존재 보장
        await userService.ensureUserExists(userId);

        req.userId = userId;
        res.locals.currentUserId = userId;

        next();
    } catch (error) {
        console.error('유저 미들웨어 오류:', error);
        req.userId = config.reviewUserId;
        res.locals.currentUserId = config.reviewUserId;
        next();
    }
}

module.exports = { userMiddleware };
