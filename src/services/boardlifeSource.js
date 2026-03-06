const crypto = require('crypto');

const FEED_URL = process.env.BOARDLIFE_FEED_URL || 'https://boardlife.co.kr/feed_ajax.php';
const SITE_URL = process.env.BOARDLIFE_SITE_URL || 'https://boardlife.co.kr';
function stripHtml(value) {
    if (!value || typeof value !== 'string') return '';
    return value
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function toAbsoluteUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    if (url.startsWith('/')) return `${SITE_URL}${url}`;
    return `${SITE_URL}/${url}`;
}

function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function itemId(item) {
    return String(
        item?.id ??
        item?.idx ??
        item?.no ??
        item?.notification_id ??
        item?.feed_id ??
        ''
    ).trim();
}

function itemUrl(item) {
    return toAbsoluteUrl(
        item?.url ||
        item?.link ||
        item?.href ||
        ''
    );
}

function itemTitle(item) {
    return stripHtml(
        item?.title ||
        item?.subject ||
        item?.name ||
        item?.message ||
        ''
    );
}

function itemBody(item) {
    return stripHtml(
        item?.message ||
        item?.content ||
        item?.text ||
        item?.description ||
        ''
    );
}

function itemOccurredAt(item) {
    return parseDate(
        item?.created_at ||
        item?.regdate ||
        item?.datetime ||
        item?.timestamp ||
        item?.time ||
        ''
    );
}

function makeDedupeHash(externalId, title, body, url) {
    const base = [externalId, title, body, url].join('|');
    return crypto.createHash('sha256').update(base).digest('hex');
}

function normalizeJsonItems(items) {
    return (items || [])
        .map(item => {
            const externalId = itemId(item);
            const title = itemTitle(item);
            const body = itemBody(item);
            const url = itemUrl(item);
            const occurredAt = itemOccurredAt(item);

            if (!externalId && !title && !body) return null;

            return {
                externalId: externalId || null,
                title: title || '새 알림',
                body: body || '',
                url: url || null,
                occurredAt,
                dedupeHash: makeDedupeHash(externalId, title, body, url),
                rawPayload: item
            };
        })
        .filter(Boolean);
}

function findArrayPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    const candidates = [
        payload.data,
        payload.items,
        payload.list,
        payload.notifications,
        payload.feeds,
        payload.results
    ];

    for (const candidate of candidates) {
        if (Array.isArray(candidate)) return candidate;
    }

    return [];
}

function normalizeHtml(text) {
    const rowRegex = /<a[^>]*class=['"][^'"]*feed-list-wrapper[^'"]*['"][^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
    const notifications = [];
    let rowMatch;

    while ((rowMatch = rowRegex.exec(text)) !== null) {
        const [, href, inner] = rowMatch;
        const titleMatch = inner.match(/<span[^>]*class=['"][^'"]*main-text[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i);
        const timeMatches = [...inner.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)];
        const whenRaw = timeMatches.length > 1 ? stripHtml(timeMatches[1][1]) : '';

        const title = stripHtml(titleMatch ? titleMatch[1] : inner);
        if (!title) continue;

        const url = toAbsoluteUrl(href);
        const externalId = (() => {
            const m = url.match(/(?:bbs_num|num)=([0-9]+)/i);
            return m ? m[1] : '';
        })();

        notifications.push({
            externalId: externalId || null,
            title,
            body: whenRaw || '',
            url: url || null,
            occurredAt: null,
            dedupeHash: makeDedupeHash(externalId, title, whenRaw, url),
            rawPayload: { href, whenRaw }
        });
    }

    if (notifications.length > 0) {
        return notifications;
    }

    const anchorRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
    let match;

    while ((match = anchorRegex.exec(text)) !== null) {
        const [, href, inner] = match;
        const title = stripHtml(inner);
        if (!title) continue;

        const url = toAbsoluteUrl(href);
        notifications.push({
            externalId: null,
            title,
            body: '',
            url: url || null,
            occurredAt: null,
            dedupeHash: makeDedupeHash('', title, '', url),
            rawPayload: { href, inner }
        });
    }

    return notifications;
}

function isAuthResponse(text) {
    if (!text) return false;
    return /login|로그인|member_login|signin/i.test(text);
}

async function fetchBoardlifeNotifications(options = {}) {
    const cookie = options.cookie || process.env.BOARDLIFE_COOKIE || '';
    if (!cookie) {
        throw new Error('BOARDLIFE_COOKIE is required');
    }

    const response = await fetch(FEED_URL, {
        method: 'POST',
        headers: {
            Cookie: cookie,
            Accept: 'application/json, text/plain, text/html;q=0.9,*/*;q=0.8',
            'X-Requested-With': 'XMLHttpRequest',
            Referer: SITE_URL,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'boardgame-pick-boardlife-notifier/1.0'
        },
        body: 'action=feedList'
    });

    if (!response.ok) {
        throw new Error(`BoardLife feed request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    if (isAuthResponse(text)) {
        throw new Error('BoardLife session appears expired; login required');
    }

    try {
        const parsed = JSON.parse(text);
        const list = findArrayPayload(parsed);
        return normalizeJsonItems(list);
    } catch (_) {
        return normalizeHtml(text);
    }
}

module.exports = {
    fetchBoardlifeNotifications
};
