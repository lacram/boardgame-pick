const crypto = require('crypto');

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

function signValue(value, secret) {
    if (!secret) return value;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(value)
        .digest('base64url');
    return `${value}.${signature}`;
}

function verifySignedValue(signedValue, secret) {
    if (!signedValue || !secret || typeof signedValue !== 'string') return null;

    const separatorIndex = signedValue.lastIndexOf('.');
    if (separatorIndex <= 0) return null;

    const value = signedValue.slice(0, separatorIndex);
    const signature = signedValue.slice(separatorIndex + 1);
    const expected = signValue(value, secret).slice(value.length + 1);

    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (signatureBuffer.length !== expectedBuffer.length) return null;

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer) ? value : null;
}

function serializeCookie(name, value, options = {}) {
    const parts = [`${name}=${encodeURIComponent(value)}`];

    if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
    if (options.path) parts.push(`Path=${options.path}`);
    if (options.httpOnly) parts.push('HttpOnly');
    if (options.secure) parts.push('Secure');
    if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

    return parts.join('; ');
}

function appendSetCookie(res, cookie) {
    const existing = res.getHeader('Set-Cookie');
    if (!existing) {
        res.setHeader('Set-Cookie', cookie);
        return;
    }

    const values = Array.isArray(existing) ? existing : [existing];
    res.setHeader('Set-Cookie', [...values, cookie]);
}

module.exports = {
    appendSetCookie,
    parseCookies,
    serializeCookie,
    signValue,
    verifySignedValue
};
