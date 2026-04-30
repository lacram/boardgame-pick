const crypto = require('crypto');
const config = require('../../config');
const {
    appendSetCookie,
    parseCookies,
    serializeCookie,
    signValue,
    verifySignedValue
} = require('../utils/cookieUtils');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_EXEMPT_PATHS = new Set(['/api/cron/sync-bgg']);

function buildCookieOptions({ httpOnly = true, maxAge } = {}) {
    return {
        httpOnly,
        maxAge,
        path: '/',
        sameSite: 'Strict',
        secure: config.security.secureCookies
    };
}

function setSecurityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader(
        'Content-Security-Policy-Report-Only',
        [
            "default-src 'self'",
            "base-uri 'self'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "img-src 'self' https: data:",
            "style-src 'self' 'unsafe-inline'",
            "script-src 'self' 'unsafe-inline'",
            "connect-src 'self'"
        ].join('; ')
    );
    next();
}

function createCsrfToken() {
    return crypto.randomBytes(32).toString('base64url');
}

function getOrCreateCsrfToken(req, res) {
    const cookies = parseCookies(req.headers.cookie);
    const signedToken = cookies[config.security.csrfCookieName];
    const existingToken = verifySignedValue(signedToken, config.security.cookieSecret);
    const token = existingToken || createCsrfToken();

    if (!existingToken) {
        appendSetCookie(
            res,
            serializeCookie(
                config.security.csrfCookieName,
                signValue(token, config.security.cookieSecret),
                buildCookieOptions({ httpOnly: true, maxAge: 60 * 60 * 24 })
            )
        );
    }

    return token;
}

function csrfMiddleware(req, res, next) {
    if (!config.security.cookieSecret) {
        if (config.nodeEnv === 'production') {
            return res.status(500).json({ error: 'CSRF 설정이 누락되었습니다.' });
        }
        res.locals.csrfToken = '';
        return next();
    }

    const token = getOrCreateCsrfToken(req, res);
    res.locals.csrfToken = token;

    if (SAFE_METHODS.has(req.method) || CSRF_EXEMPT_PATHS.has(req.path)) {
        return next();
    }

    const providedToken = req.headers[config.security.csrfHeaderName];
    if (!providedToken || providedToken !== token) {
        return res.status(403).json({
            error: 'CSRF 토큰이 유효하지 않습니다.'
        });
    }

    return next();
}

module.exports = {
    buildCookieOptions,
    csrfMiddleware,
    setSecurityHeaders
};
