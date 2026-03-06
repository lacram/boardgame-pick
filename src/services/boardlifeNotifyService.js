const { fetchBoardlifeNotifications } = require('./boardlifeSource');
const {
    findKnownHashes,
    insertNotifications,
    markDelivery,
    markNotificationsSent,
    markNotificationsFailed
} = require('./boardlifeStore');
const { sendNotificationDigestEmail } = require('./boardlifeEmailNotifier');
const { getBoardlifeCookie } = require('./boardlifeSessionService');

const TEST_MODE = process.env.BOARDLIFE_TEST_MODE === 'true';
const TEST_LATEST_COUNT = Math.max(parseInt(process.env.BOARDLIFE_TEST_LATEST_COUNT || '5', 10), 1);

function toTimestamp(value) {
    if (!value) return 0;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sortLatest(items) {
    return items.slice().sort((a, b) => {
        const aTs = toTimestamp(a.occurredAt || a.occurred_at);
        const bTs = toTimestamp(b.occurredAt || b.occurred_at);
        return bTs - aTs;
    });
}

async function sendTestLatestNotifications(fetched) {
    const latest = sortLatest(fetched).slice(0, TEST_LATEST_COUNT);
    const testItems = latest.map(item => ({
        title: item.title,
        body: item.body,
        source_url: item.url || item.source_url || null,
        occurred_at: item.occurredAt || item.occurred_at || null
    }));
    for (const item of testItems) {
        // normalize shape for digest mail
        item.title = item.title || '제목 없음';
    }

    if (testItems.length === 0) {
        return {
            fetched: fetched.length,
            inserted: 0,
            sent: 0,
            failed: 0,
            testMode: true,
            latestCount: 0,
            noRealNotifications: true
        };
    }

    try {
        await sendNotificationDigestEmail(testItems, { testMode: true });
    } catch (_) {
        return {
            fetched: fetched.length,
            inserted: 0,
            sent: 0,
            failed: 1,
            testMode: true,
            latestCount: latest.length
        };
    }

    return {
        fetched: fetched.length,
        inserted: 0,
        sent: 1,
        failed: 0,
        testMode: true,
        latestCount: latest.length
    };
}

async function runBoardlifeNotifyJob() {
    const cookie = await getBoardlifeCookie();
    if (!cookie) {
        throw new Error('No BoardLife cookie available. Set BOARDLIFE_COOKIE or enable playwright login mode.');
    }

    const fetched = await fetchBoardlifeNotifications({ cookie });
    if (TEST_MODE) {
        return sendTestLatestNotifications(fetched);
    }

    if (fetched.length === 0) {
        return { fetched: 0, inserted: 0, sent: 0, failed: 0 };
    }

    const hashes = fetched.map(item => item.dedupeHash);
    const known = await findKnownHashes(hashes);
    const fresh = fetched.filter(item => !known.has(item.dedupeHash));

    if (fresh.length === 0) {
        return { fetched: fetched.length, inserted: 0, sent: 0, failed: 0 };
    }

    const inserted = await insertNotifications(fresh);
    const digestItems = inserted.map(item => ({
        title: item.title,
        body: item.body,
        source_url: item.source_url || null,
        occurred_at: item.occurred_at || null
    }));

    try {
        await sendNotificationDigestEmail(digestItems, { testMode: false });
        for (const notification of inserted) {
            await markDelivery(notification.id, 'sent');
        }
        await markNotificationsSent(inserted.map(item => item.id));
    } catch (error) {
        for (const notification of inserted) {
            await markDelivery(notification.id, 'failed', error.message);
        }
        await markNotificationsFailed(inserted.map(item => item.id));
        return {
            fetched: fetched.length,
            inserted: inserted.length,
            sent: 0,
            failed: 1
        };
    }

    return {
        fetched: fetched.length,
        inserted: inserted.length,
        sent: 1,
        failed: 0
    };
}

module.exports = {
    runBoardlifeNotifyJob
};
