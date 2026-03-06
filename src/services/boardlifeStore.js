const supabase = require('../../supabase-client');

const NOTIFICATIONS_TABLE = process.env.BOARDLIFE_NOTIFICATIONS_TABLE || 'external_notifications';
const DELIVERIES_TABLE = process.env.BOARDLIFE_DELIVERIES_TABLE || 'notification_deliveries';
const PROVIDER = 'boardlife';

async function findKnownHashes(hashes) {
    if (!hashes || hashes.length === 0) return new Set();

    const { data, error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .select('dedupe_hash')
        .eq('provider', PROVIDER)
        .in('dedupe_hash', hashes);

    if (error) throw error;
    return new Set((data || []).map(row => row.dedupe_hash));
}

async function insertNotifications(notifications) {
    if (!notifications || notifications.length === 0) return [];
    const nowIso = new Date().toISOString();

    const rows = notifications.map(item => ({
        provider: PROVIDER,
        external_id: item.externalId,
        dedupe_hash: item.dedupeHash,
        title: item.title,
        body: item.body,
        source_url: item.url,
        occurred_at: item.occurredAt,
        first_seen_at: nowIso,
        last_seen_at: nowIso,
        status: 'new',
        sent_count: 0,
        first_sent_at: null,
        last_sent_at: null,
        raw_payload: item.rawPayload
    }));

    const { data, error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .insert(rows)
        .select('id, provider, external_id, dedupe_hash, title, body, source_url, occurred_at');

    if (error) throw error;
    return data || [];
}

async function markDelivery(notificationId, status, errorMessage) {
    const row = {
        notification_id: notificationId,
        channel: 'email',
        status,
        error_message: errorMessage || null,
        delivered_at: status === 'sent' ? new Date().toISOString() : null
    };

    const { error } = await supabase
        .from(DELIVERIES_TABLE)
        .insert([row]);

    if (error) throw error;
}

async function markNotificationsSent(notificationIds) {
    if (!notificationIds || notificationIds.length === 0) return;
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .select('id, sent_count, first_sent_at')
        .in('id', notificationIds);

    if (error) throw error;

    const rows = (data || []).map(row => ({
        id: row.id,
        status: 'sent',
        sent_count: (row.sent_count || 0) + 1,
        first_sent_at: row.first_sent_at || nowIso,
        last_sent_at: nowIso
    }));

    if (rows.length === 0) return;

    const { error: upsertError } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .upsert(rows, { onConflict: 'id' });

    if (upsertError) throw upsertError;
}

async function markNotificationsFailed(notificationIds) {
    if (!notificationIds || notificationIds.length === 0) return;

    const rows = notificationIds.map(id => ({
        id,
        status: 'failed'
    }));

    const { error } = await supabase
        .from(NOTIFICATIONS_TABLE)
        .upsert(rows, { onConflict: 'id' });

    if (error) throw error;
}

module.exports = {
    findKnownHashes,
    insertNotifications,
    markDelivery,
    markNotificationsSent,
    markNotificationsFailed
};
