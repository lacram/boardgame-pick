const DEFAULT_CHUNK = 1000;
const DEFAULT_ROUNDS = 1;
const DEFAULT_SLEEP_MS = 60000;
const DEFAULT_RATE_LIMIT_MS = 5000;
const DEFAULT_BATCH_SIZE = 20;

function parsePositiveInteger(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInteger(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseArgs(args = process.argv.slice(2)) {
    const options = {
        chunk: DEFAULT_CHUNK,
        rounds: DEFAULT_ROUNDS,
        sleepMs: DEFAULT_SLEEP_MS,
        rateLimitMs: DEFAULT_RATE_LIMIT_MS,
        batchSize: DEFAULT_BATCH_SIZE,
        dryRun: false
    };

    for (const arg of args) {
        if (arg === '--dryRun' || arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (arg.startsWith('--chunk=')) {
            options.chunk = parsePositiveInteger(arg.slice('--chunk='.length), options.chunk);
            continue;
        }
        if (arg.startsWith('--rounds=')) {
            options.rounds = parsePositiveInteger(arg.slice('--rounds='.length), options.rounds);
            continue;
        }
        if (arg.startsWith('--sleep=')) {
            options.sleepMs = parseNonNegativeInteger(arg.slice('--sleep='.length), options.sleepMs);
            continue;
        }
        if (arg.startsWith('--sleepMs=')) {
            options.sleepMs = parseNonNegativeInteger(arg.slice('--sleepMs='.length), options.sleepMs);
            continue;
        }
        if (arg.startsWith('--rateLimitMs=')) {
            options.rateLimitMs = parseNonNegativeInteger(arg.slice('--rateLimitMs='.length), options.rateLimitMs);
            continue;
        }
        if (arg.startsWith('--batchSize=')) {
            options.batchSize = parsePositiveInteger(arg.slice('--batchSize='.length), options.batchSize);
        }
    }

    return options;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function countRemainingDetails(supabaseClient = require('../supabase-client')) {
    let lastError = null;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const { count, error } = await supabaseClient
            .from('boardgames')
            .select('bgg_id', { count: 'exact', head: true })
            .is('last_detail_sync_at', null);

        if (!error) return count || 0;
        lastError = error;
        await sleep(1000 * attempt);
    }

    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
        const url = `${process.env.SUPABASE_URL}/rest/v1/boardgames?select=bgg_id&last_detail_sync_at=is.null&limit=1`;
        const response = await fetch(url, {
            headers: {
                apikey: process.env.SUPABASE_ANON_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
                Prefer: 'count=exact'
            }
        });

        if (response.ok) {
            const contentRange = response.headers.get('content-range') || '';
            const countText = contentRange.split('/')[1];
            const parsedCount = parseInt(countText, 10);
            if (Number.isFinite(parsedCount)) return parsedCount;
        }
    }

    throw lastError;
}

async function runBackfill(options = {}) {
    const chunk = parsePositiveInteger(options.chunk, DEFAULT_CHUNK);
    const rounds = parsePositiveInteger(options.rounds, DEFAULT_ROUNDS);
    const sleepMs = parseNonNegativeInteger(options.sleepMs, DEFAULT_SLEEP_MS);
    const rateLimitMs = parseNonNegativeInteger(options.rateLimitMs, DEFAULT_RATE_LIMIT_MS);
    const batchSize = parsePositiveInteger(options.batchSize, DEFAULT_BATCH_SIZE);
    const dryRun = Boolean(options.dryRun);
    const syncService = options.syncService || require('../src/services/bggSyncService');
    const countRemaining = options.countRemaining || countRemainingDetails;
    const wait = options.sleep || sleep;
    const onRoundFinished = options.onRoundFinished || (() => {});

    const result = {
        chunk,
        rounds,
        sleepMs,
        rateLimitMs,
        batchSize,
        dryRun,
        roundsRun: 0,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        lastRemaining: null
    };

    for (let round = 1; round <= rounds; round += 1) {
        const remainingBefore = await countRemaining();
        result.lastRemaining = remainingBefore;

        if (remainingBefore === 0) break;

        const limit = Math.min(chunk, remainingBefore);
        let detail = null;

        if (!dryRun) {
            detail = await syncService.runDetailSync({
                jobType: 'incremental',
                limit,
                requestedBy: 'backfill-script',
                rateLimitMs,
                batchSize,
                missingDetailsOnly: true
            });
        }

        result.roundsRun += 1;
        const summary = {
            round,
            remainingBefore,
            limit,
            detail,
            dryRun
        };
        onRoundFinished(summary);

        if (round < rounds) {
            await wait(sleepMs);
        }
    }

    result.finishedAt = new Date().toISOString();
    return result;
}

async function main() {
    const options = parseArgs();
    console.log('BGG detail backfill started:', options);

    const result = await runBackfill({
        ...options,
        onRoundFinished: summary => {
            console.log('BGG detail backfill round completed:', summary);
        }
    });

    console.log('BGG detail backfill completed:', result);
}

if (require.main === module) {
    main().catch(err => {
        console.error(err && Object.keys(err).length > 0 ? err : {
            message: err?.message || String(err),
            stack: err?.stack
        });
        process.exit(1);
    });
}

module.exports = {
    countRemainingDetails,
    parseArgs,
    runBackfill
};
