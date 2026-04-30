const config = require('../../config');
const userService = require('../services/userService');
const {
    appendSetCookie,
    parseCookies,
    serializeCookie,
    signValue,
    verifySignedValue
} = require('../utils/cookieUtils');
const { buildCookieOptions } = require('./securityMiddleware');

function isValidUserId(userId) {
    if (!userId || typeof userId !== 'string') return false;
    if (userId.length < 1 || userId.length > 40) return false;
    return /^[a-zA-Z0-9_-]+$/.test(userId);
}

function resolveUserIdFromCookies(cookies) {
    const rawCookie = cookies.bgp_user;
    const verifiedUserId = verifySignedValue(rawCookie, config.security.cookieSecret);
    if (isValidUserId(verifiedUserId)) return { userId: verifiedUserId, shouldRefreshCookie: false };

    // 개발 환경에서는 기존 unsigned 쿠키를 한 번 받아 서명 쿠키로 마이그레이션한다.
    if (config.nodeEnv !== 'production' && isValidUserId(rawCookie)) {
        return { userId: rawCookie, shouldRefreshCookie: true };
    }

    return { userId: config.reviewUserId, shouldRefreshCookie: true };
}

async function userMiddleware(req, res, next) {
    if (req.path === '/api/cron/sync-bgg') {
        return next();
    }

    try {
        const cookies = parseCookies(req.headers.cookie);
        const { userId, shouldRefreshCookie } = resolveUserIdFromCookies(cookies);

        // 사용자 존재 보장
        await userService.ensureUserExists(userId);

        req.userId = userId;
        res.locals.currentUserId = userId;
        res.locals.localProfileMode = config.security.localProfileMode;

        if (shouldRefreshCookie) {
            appendSetCookie(
                res,
                serializeCookie(
                    'bgp_user',
                    signValue(userId, config.security.cookieSecret),
                    buildCookieOptions({ maxAge: 60 * 60 * 24 * 365 })
                )
            );
        }

        next();
    } catch (error) {
        console.error('유저 미들웨어 오류:', error);
        req.userId = config.reviewUserId;
        res.locals.currentUserId = config.reviewUserId;
        res.locals.localProfileMode = config.security.localProfileMode;
        next();
    }
}

module.exports = { userMiddleware };
