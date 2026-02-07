const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const supabase = require('../supabase-client');

const DUMP_URL = process.env.BGG_DUMP_URL || 'https://boardgamegeek.com/data_dumps/bg_ranks';
const APP_TOKEN = process.env.BGG_APP_TOKEN;
const BATCH_SIZE = parseInt(process.env.BGG_DUMP_BATCH_SIZE || '1000', 10);

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

async function downloadDump(tempPath) {
    const headers = APP_TOKEN ? { Authorization: `Bearer ${APP_TOKEN}` } : {};
    const response = await fetch(DUMP_URL, { headers });

    if (!response.ok) {
        throw new Error(`CSV download failed: ${response.status} ${response.statusText}`);
    }

    const contentEncoding = response.headers.get('content-encoding') || '';
    const isGzip = contentEncoding.includes('gzip');

    if (isGzip) {
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        try {
            const unzipped = zlib.gunzipSync(buffer);
            fs.writeFileSync(tempPath, unzipped);
            return;
        } catch (err) {
            // Some servers send gzip headers while already decoding the body.
            fs.writeFileSync(tempPath, buffer);
            return;
        }
    }

    await pipeline(response.body, fs.createWriteStream(tempPath));
}

function mapRow(headers, values) {
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
        last_dump_seen_at: new Date().toISOString()
    };
}

async function upsertBatch(batch) {
    if (batch.length === 0) return;
    const { error } = await supabase
        .from('boardgames')
        .upsert(batch, { onConflict: 'bgg_id' });

    if (error) throw error;
}

async function syncDump() {
    const tempPath = path.join(os.tmpdir(), `bg_ranks_${Date.now()}.csv`);
    console.log(`Downloading CSV dump from ${DUMP_URL}...`);
    await downloadDump(tempPath);

    const stream = fs.createReadStream(tempPath, { encoding: 'utf8' });
    let buffer = '';
    let headers = null;
    let batch = [];
    let total = 0;

    for await (const chunk of stream) {
        buffer += chunk;
        let lineEnd = buffer.indexOf('\n');
        while (lineEnd >= 0) {
            const line = buffer.slice(0, lineEnd).replace(/\r$/, '');
            buffer = buffer.slice(lineEnd + 1);
            lineEnd = buffer.indexOf('\n');

            if (!headers) {
                headers = parseCsvLine(line);
                continue;
            }

            if (!line.trim()) continue;
            const values = parseCsvLine(line);
            const mapped = mapRow(headers, values);
            if (!mapped) continue;

            batch.push(mapped);
            if (batch.length >= BATCH_SIZE) {
                await upsertBatch(batch);
                total += batch.length;
                console.log(`Upserted ${total} rows...`);
                batch = [];
            }
        }
    }

    if (buffer.trim()) {
        const values = parseCsvLine(buffer.replace(/\r$/, ''));
        const mapped = mapRow(headers, values);
        if (mapped) batch.push(mapped);
    }

    if (batch.length > 0) {
        await upsertBatch(batch);
        total += batch.length;
    }

    fs.unlinkSync(tempPath);
    console.log(`CSV sync complete. Upserted ${total} rows.`);
}

syncDump().catch(err => {
    console.error(err);
    process.exit(1);
});
