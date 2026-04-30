function extractBearerToken(authHeader) {
    if (!authHeader || typeof authHeader !== 'string') return '';
    const [scheme, token] = authHeader.split(' ');
    if (!scheme || !token) return '';
    if (scheme.toLowerCase() !== 'bearer') return '';
    return token.trim();
}

function getProvidedCronSecret(headers = {}) {
    return extractBearerToken(headers.authorization) || headers['x-cron-secret'] || '';
}

function isCronAuthorized(headers, cronSecret) {
    if (!cronSecret) return false;
    return getProvidedCronSecret(headers) === cronSecret;
}

function normalizeJobType(value) {
    return value === 'full' ? 'full' : 'incremental';
}

function normalizeLimit(value, maxLimit) {
    if (value === undefined || value === null || value === '') return undefined;
    if (!/^\d+$/.test(String(value))) return undefined;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return Math.min(parsed, maxLimit);
}

module.exports = {
    extractBearerToken,
    getProvidedCronSecret,
    isCronAuthorized,
    normalizeJobType,
    normalizeLimit
};
