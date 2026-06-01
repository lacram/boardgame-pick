const { fetchWithTimeout } = require('../utils/httpUtils');

const DUMP_URL = process.env.BGG_DUMP_URL || 'https://boardgamegeek.com/data_dumps/bg_ranks';
const APP_TOKEN = process.env.BGG_APP_TOKEN;
const BATCH_SIZE = Math.max(parseInt(process.env.BGG_DUMP_BATCH_SIZE || '1000', 10), 1);
const FETCH_TIMEOUT_MS = parseInt(process.env.BGG_FETCH_TIMEOUT_MS || '15000', 10);

function normalizeHeader(value) {
    return value
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];
        const next = line[i + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
            continue;
        }

        current += char;
    }

    result.push(current);
    return result;
}

function mapRankDumpRow(headers, values, seenAtIso) {
    const normalized = headers.map(normalizeHeader);
    const row = {};
    for (let i = 0; i < headers.length; i += 1) {
        row[normalized[i]] = values[i] || '';
    }

    const id = parseInt(row.id || row.gameid || row.bggid || '', 10);
    const name = row.name || row.gamename || '';
    const rank = parseInt(row.rank || row.overallrank || '', 10);
    const averageRating = parseFloat(row.averagerating || row.avg || row.averageratingavg || row.average || '');

    if (!id) return null;

    return {
        bgg_id: id,
        name: name || null,
        rank: Number.isNaN(rank) ? null : rank,
        average_rating: Number.isNaN(averageRating) ? null : averageRating,
        last_dump_seen_at: seenAtIso
    };
}

async function upsertBatch(supabaseClient, batch) {
    if (batch.length === 0) return;
    const { error } = await supabaseClient
        .from('boardgames')
        .upsert(batch, { onConflict: 'bgg_id' });

    if (error) throw error;
}

async function runDumpSync(options = {}) {
    const startedAt = new Date();
    const fetcher = options.fetcher || fetchWithTimeout;
    const supabaseClient = options.supabaseClient || require('../../supabase-client');
    const dumpUrl = options.dumpUrl || DUMP_URL;
    const batchSize = Math.max(parseInt(options.batchSize || BATCH_SIZE, 10), 1);
    const parsedLimit = parseInt(options.limit, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
    const now = options.now || (() => new Date());
    const headers = APP_TOKEN ? { Authorization: `Bearer ${APP_TOKEN}` } : {};

    const response = await fetcher(dumpUrl, { headers, timeoutMs: FETCH_TIMEOUT_MS });
    if (!response.ok) {
        throw new Error(`CSV download failed: ${response.status} ${response.statusText}`);
    }

    const csv = await response.text();
    const lines = csv.split(/\n/);
    const headerLine = lines.shift();
    const csvHeaders = parseCsvLine((headerLine || '').replace(/\r$/, ''));
    const seenAtIso = now().toISOString();
    let batch = [];
    let discoveredCount = 0;
    let batchCount = 0;

    for (const rawLine of lines) {
        if (limit && discoveredCount >= limit) break;
        const line = rawLine.replace(/\r$/, '');
        if (!line.trim()) continue;

        const mapped = mapRankDumpRow(csvHeaders, parseCsvLine(line), seenAtIso);
        if (!mapped) continue;

        batch.push(mapped);
        discoveredCount += 1;

        if (batch.length >= batchSize) {
            await upsertBatch(supabaseClient, batch);
            batchCount += 1;
            batch = [];
        }
    }

    if (batch.length > 0) {
        await upsertBatch(supabaseClient, batch);
        batchCount += 1;
    }

    return {
        discoveredCount,
        batchCount,
        limit,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString()
    };
}

module.exports = {
    mapRankDumpRow,
    parseCsvLine,
    runDumpSync
};
