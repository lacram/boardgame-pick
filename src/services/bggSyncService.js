const { Parser } = require('xml2js');
const supabase = require('../../supabase-client');
const { parsePlayersToSet } = require('../../utils/searchUtils');

const BASE_URL = process.env.BGG_XML_API_URL || 'https://boardgamegeek.com/xmlapi2/thing';
const APP_TOKEN = process.env.BGG_APP_TOKEN;
const BATCH_SIZE = Math.max(parseInt(process.env.BGG_DETAIL_BATCH_SIZE || '20', 10), 1);
const DEFAULT_SYNC_LIMIT = parseInt(process.env.BGG_DETAIL_SYNC_LIMIT || '200', 10);
const MIN_AGE_DAYS = parseInt(process.env.BGG_DETAIL_MIN_AGE_DAYS || '0', 10);
const RATE_LIMIT_MS = parseInt(process.env.BGG_DETAIL_RATE_LIMIT_MS || '5000', 10);
const CRON_FULL_RATE_LIMIT_MS = parseInt(process.env.BGG_DETAIL_RATE_LIMIT_MS_CRON_FULL || '1000', 10);
const RETRY_BASE_MINUTES = parseInt(process.env.BGG_SYNC_RETRY_BASE_MINUTES || '30', 10);
const RETRY_MAX_MINUTES = parseInt(process.env.BGG_SYNC_RETRY_MAX_MINUTES || '1440', 10);

const parser = new Parser({ explicitArray: false, mergeAttrs: true, explicitRoot: false });

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function toInt(value) {
    const num = parseInt(value, 10);
    return Number.isNaN(num) ? null : num;
}

function toFloat(value) {
    const num = parseFloat(value);
    return Number.isNaN(num) ? null : num;
}

function ensureArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
}

function formatSetToRanges(values) {
    if (!values || values.length === 0) return '';
    const sorted = Array.from(new Set(values)).sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i += 1) {
        const current = sorted[i];
        if (current === prev + 1) {
            prev = current;
            continue;
        }
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = current;
        prev = current;
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(',');
}

function parsePollSummary(pollSummary) {
    if (!pollSummary || !pollSummary.result) return null;
    const results = ensureArray(pollSummary.result);
    const best = results.find(r => r.name === 'bestwith');
    const recommended = results.find(r => r.name === 'recommmendedwith' || r.name === 'recommendedwith');

    return {
        bestRaw: best?.value || '',
        recommendedRaw: recommended?.value || ''
    };
}

function parseSuggestedNumPlayers(polls) {
    const poll = ensureArray(polls).find(p => p.name === 'suggested_numplayers');
    if (!poll || !poll.results) return null;

    const bestSet = new Set();
    const recommendedSet = new Set();
    const results = ensureArray(poll.results);

    for (const entry of results) {
        const numPlayersValue = entry.numplayers || entry.$?.numplayers;
        if (!numPlayersValue) continue;

        const numValue = numPlayersValue.replace(/\+/, '').trim();
        const numPlayers = toInt(numValue);
        if (!numPlayers) continue;

        const votes = ensureArray(entry.result);
        const bestVotes = toInt(votes.find(v => v.value === 'Best')?.numvotes) || 0;
        const recVotes = toInt(votes.find(v => v.value === 'Recommended')?.numvotes) || 0;
        const notRecVotes = toInt(votes.find(v => v.value === 'Not Recommended')?.numvotes) || 0;

        if (bestVotes >= recVotes && bestVotes > notRecVotes) {
            bestSet.add(numPlayers);
        }
        if (recVotes > notRecVotes) {
            recommendedSet.add(numPlayers);
        }
    }

    return {
        bestRaw: formatSetToRanges(Array.from(bestSet)),
        recommendedRaw: formatSetToRanges(Array.from(recommendedSet))
    };
}

function summarizeSet(setArr) {
    if (!setArr || setArr.length === 0) {
        return { min: null, max: null, set: [] };
    }

    return {
        min: setArr[0],
        max: setArr[setArr.length - 1],
        set: setArr
    };
}

function extractKoreanName(names) {
    for (const name of ensureArray(names)) {
        const value = name.value;
        if (value && /[가-힣]/.test(value)) return value;
    }
    return null;
}

function parseItem(item) {
    const names = ensureArray(item.name);
    const primaryName = names.find(n => n.type === 'primary')?.value || names[0]?.value || null;

    const pollSummary = item['poll-summary'] ? parsePollSummary(item['poll-summary']) : null;
    const pollDerived = item.poll ? parseSuggestedNumPlayers(item.poll) : null;

    const bestRaw = (pollSummary?.bestRaw || pollDerived?.bestRaw || '')
        .replace('Best with ', '')
        .replace(' players', '')
        .trim();
    const recommendedRaw = (pollSummary?.recommendedRaw || pollDerived?.recommendedRaw || '')
        .replace('Recommended with ', '')
        .replace(' players', '')
        .trim();

    const bestSet = parsePlayersToSet(bestRaw);
    const recommendedSet = parsePlayersToSet(recommendedRaw);
    const bestSummary = summarizeSet(bestSet);
    const recSummary = summarizeSet(recommendedSet);

    const categories = ensureArray(item.link).filter(l => l.type === 'boardgamecategory').map(l => l.value).filter(Boolean);
    const mechanisms = ensureArray(item.link).filter(l => l.type === 'boardgamemechanic').map(l => l.value).filter(Boolean);
    const types = ensureArray(item.link).filter(l => l.type === 'boardgamesubdomain').map(l => l.value).filter(Boolean);
    const ratings = item.statistics?.ratings || {};
    const nowIso = new Date().toISOString();

    return {
        bgg_id: toInt(item.id),
        name: primaryName,
        korean_name: extractKoreanName(names),
        main_image_url: item.image || null,
        players_min: toInt(item.minplayers?.value),
        players_max: toInt(item.maxplayers?.value),
        players_best: bestRaw || null,
        players_recommended: recommendedRaw || null,
        players_best_raw: bestRaw || null,
        players_recommended_raw: recommendedRaw || null,
        players_best_set: bestSummary.set,
        players_best_min: bestSummary.min,
        players_best_max: bestSummary.max,
        players_recommended_set: recSummary.set,
        players_recommended_min: recSummary.min,
        players_recommended_max: recSummary.max,
        play_time_min: toInt(item.minplaytime?.value),
        play_time_max: toInt(item.maxplaytime?.value),
        age: toInt(item.minage?.value),
        weight: toFloat(ratings.averageweight?.value),
        rating: toFloat(ratings.bayesaverage?.value),
        type: types.join(', '),
        category: categories.join(', '),
        mechanism: mechanisms.join(', '),
        url: item.id ? `https://boardgamegeek.com/boardgame/${item.id}` : null,
        raw_json: item,
        source_updated_at: nowIso,
        last_detail_sync_at: nowIso,
        detail_sync_status: 'success'
    };
}

function isEmptyValue(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return false;
}

function mergeRow(existing, incoming) {
    if (!existing) return incoming;
    const result = { ...incoming };

    Object.keys(incoming).forEach(key => {
        if (key === 'bgg_id') return;
        if (isEmptyValue(incoming[key]) && !isEmptyValue(existing[key])) {
            result[key] = existing[key];
        }
    });

    return result;
}

function isMissingTableError(error) {
    return error && error.code === '42P01';
}

function toDateIsoAfterMinutes(minutes) {
    return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function getBackoffMinutes(attemptCount) {
    const count = Math.max(1, attemptCount);
    const minutes = RETRY_BASE_MINUTES * (2 ** (count - 1));
    return Math.min(minutes, RETRY_MAX_MINUTES);
}

async function safeInsertJob(payload) {
    const { data, error } = await supabase
        .from('sync_jobs')
        .insert([payload])
        .select('id')
        .single();

    if (error) {
        if (isMissingTableError(error)) return null;
        throw error;
    }
    return data?.id || null;
}

async function safeUpdateJob(jobId, payload) {
    if (!jobId) return;
    const { error } = await supabase
        .from('sync_jobs')
        .update(payload)
        .eq('id', jobId);

    if (error && !isMissingTableError(error)) {
        throw error;
    }
}

async function safeLogErrors(rows) {
    if (!rows || rows.length === 0) return;
    const { error } = await supabase
        .from('sync_errors')
        .insert(rows);

    if (error && !isMissingTableError(error)) {
        throw error;
    }
}

async function loadCandidates(limit, jobType) {
    const parsedLimit = parseInt(limit, 10);
    const isLimited = Number.isFinite(parsedLimit) && parsedLimit > 0;
    const normalizedLimit = isLimited ? parsedLimit : (jobType === 'full' ? null : DEFAULT_SYNC_LIMIT);
    const seen = new Set();
    const candidates = [];

    if (jobType !== 'full') {
        const nowIso = new Date().toISOString();
        const { data: targetRows, error: targetError } = await supabase
            .from('sync_targets')
            .select('bgg_id')
            .or(`next_sync_at.is.null,next_sync_at.lte.${nowIso}`)
            .order('priority', { ascending: false })
            .order('next_sync_at', { ascending: true })
            .limit(normalizedLimit);

        if (targetError && !isMissingTableError(targetError)) {
            throw targetError;
        }

        for (const row of targetRows || []) {
            if (!row.bgg_id || seen.has(row.bgg_id)) continue;
            candidates.push(row.bgg_id);
            seen.add(row.bgg_id);
        }
    }

    if (jobType === 'full') {
        const pageSize = 1000;
        let from = 0;

        while (true) {
            const to = from + pageSize - 1;
            const { data, error } = await supabase
                .from('boardgames')
                .select('bgg_id, last_detail_sync_at')
                .order('last_detail_sync_at', { ascending: true })
                .range(from, to);

            if (error) throw error;
            if (!data || data.length === 0) break;

            for (const row of data) {
                if (!row.bgg_id || seen.has(row.bgg_id)) continue;
                candidates.push(row.bgg_id);
                seen.add(row.bgg_id);

                if (isLimited && candidates.length >= normalizedLimit) {
                    return candidates;
                }
            }

            if (data.length < pageSize) break;
            from += pageSize;
        }

        return candidates;
    }

    if (candidates.length < normalizedLimit) {
        let query = supabase
            .from('boardgames')
            .select('bgg_id, last_detail_sync_at')
            .order('last_detail_sync_at', { ascending: true })
            .limit(normalizedLimit - candidates.length);

        if (jobType !== 'full') {
            if (MIN_AGE_DAYS > 0) {
                const cutoff = new Date(Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
                query = query.or(`last_detail_sync_at.is.null,last_detail_sync_at.lt.${cutoff}`);
            } else {
                query = query.is('last_detail_sync_at', null);
            }
        }

        const { data, error } = await query;
        if (error) throw error;

        for (const row of data || []) {
            if (!row.bgg_id || seen.has(row.bgg_id)) continue;
            candidates.push(row.bgg_id);
            seen.add(row.bgg_id);
        }
    }

    return candidates;
}

async function fetchDetails(ids) {
    const headers = APP_TOKEN ? { Authorization: `Bearer ${APP_TOKEN}` } : {};
    const url = `${BASE_URL}?id=${ids.join(',')}&stats=1`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
        throw new Error(`XML API request failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const parsed = await parser.parseStringPromise(text);
    const items = ensureArray(parsed.item || parsed.items?.item);
    return items.filter(Boolean).map(parseItem);
}

async function updateRows(rows) {
    if (!rows || rows.length === 0) return;

    const ids = rows.map(row => row.bgg_id).filter(Boolean);
    const { data: existingRows, error: existingError } = await supabase
        .from('boardgames')
        .select([
            'bgg_id',
            'name',
            'korean_name',
            'main_image_url',
            'players_min',
            'players_max',
            'players_best',
            'players_recommended',
            'players_best_raw',
            'players_recommended_raw',
            'players_best_set',
            'players_best_min',
            'players_best_max',
            'players_recommended_set',
            'players_recommended_min',
            'players_recommended_max',
            'play_time_min',
            'play_time_max',
            'age',
            'weight',
            'rating',
            'type',
            'category',
            'mechanism',
            'url',
            'raw_json',
            'source_updated_at'
        ].join(', '))
        .in('bgg_id', ids);

    if (existingError) throw existingError;

    const existingMap = new Map((existingRows || []).map(row => [row.bgg_id, row]));
    const mergedRows = rows.map(row => mergeRow(existingMap.get(row.bgg_id), row));

    const { error } = await supabase
        .from('boardgames')
        .upsert(mergedRows, { onConflict: 'bgg_id' });

    if (error) throw error;
}

async function upsertSyncTargets(ids, payloadOverrides) {
    if (!ids || ids.length === 0) return;
    const nowIso = new Date().toISOString();
    const rows = ids.map(id => ({
        bgg_id: id,
        priority: 1,
        next_sync_at: payloadOverrides?.next_sync_at || nowIso,
        last_attempt_at: payloadOverrides?.last_attempt_at || nowIso,
        attempt_count: payloadOverrides?.attempt_count ?? 0,
        last_error: payloadOverrides?.last_error || null
    }));

    const { error } = await supabase
        .from('sync_targets')
        .upsert(rows, { onConflict: 'bgg_id' });

    if (error && !isMissingTableError(error)) {
        throw error;
    }
}

async function markBatchFailed(batch, errorMessage) {
    const { data, error } = await supabase
        .from('sync_targets')
        .select('bgg_id, attempt_count')
        .in('bgg_id', batch);

    if (error && !isMissingTableError(error)) {
        throw error;
    }

    const currentMap = new Map((data || []).map(row => [row.bgg_id, row.attempt_count || 0]));
    const nowIso = new Date().toISOString();
    const rows = batch.map(id => {
        const nextAttempt = (currentMap.get(id) || 0) + 1;
        return {
            bgg_id: id,
            priority: 1,
            attempt_count: nextAttempt,
            last_attempt_at: nowIso,
            last_error: errorMessage,
            next_sync_at: toDateIsoAfterMinutes(getBackoffMinutes(nextAttempt))
        };
    });

    const { error: upsertError } = await supabase
        .from('sync_targets')
        .upsert(rows, { onConflict: 'bgg_id' });

    if (upsertError && !isMissingTableError(upsertError)) {
        throw upsertError;
    }

    await supabase
        .from('boardgames')
        .update({
            detail_sync_status: 'fail',
            last_detail_sync_at: nowIso
        })
        .in('bgg_id', batch);
}

async function runDetailSync(options = {}) {
    const startedAt = new Date();
    const jobType = options.jobType === 'full' ? 'full' : 'incremental';
    const parsedLimit = parseInt(options.limit, 10);
    const limit = Number.isFinite(parsedLimit) && parsedLimit > 0
        ? parsedLimit
        : (jobType === 'full' ? null : DEFAULT_SYNC_LIMIT);
    const requestedBy = options.requestedBy || 'manual';
    const effectiveRateLimitMs = requestedBy === 'vercel-cron' && jobType === 'full'
        ? CRON_FULL_RATE_LIMIT_MS
        : RATE_LIMIT_MS;

    const jobId = await safeInsertJob({
        job_type: jobType,
        trigger_source: requestedBy,
        started_at: startedAt.toISOString(),
        status: 'running',
        total_count: 0,
        success_count: 0,
        fail_count: 0
    });

    const result = {
        jobId,
        jobType,
        requestedBy,
        limit,
        batchSize: BATCH_SIZE,
        totalCandidates: 0,
        successCount: 0,
        failCount: 0,
        startedAt: startedAt.toISOString(),
        finishedAt: null
    };

    try {
        const candidates = await loadCandidates(limit, jobType);
        result.totalCandidates = candidates.length;
        await safeUpdateJob(jobId, { total_count: candidates.length });

        if (candidates.length === 0) {
            result.finishedAt = new Date().toISOString();
            await safeUpdateJob(jobId, {
                status: 'success',
                finished_at: result.finishedAt
            });
            return result;
        }

        await upsertSyncTargets(candidates, { next_sync_at: new Date().toISOString(), attempt_count: 0 });

        for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            const batch = candidates.slice(i, i + BATCH_SIZE);
            try {
                const rows = await fetchDetails(batch);
                await updateRows(rows);
                result.successCount += batch.length;

                await upsertSyncTargets(batch, {
                    attempt_count: 0,
                    last_error: null,
                    next_sync_at: toDateIsoAfterMinutes(MIN_AGE_DAYS * 24 * 60 || 60)
                });

                console.log(`BGG detail sync success: ${i + 1} - ${i + batch.length}`);
            } catch (err) {
                result.failCount += batch.length;
                const errorMessage = err?.message || 'unknown error';
                console.error(`BGG detail sync failed for ids ${batch.join(',')}: ${errorMessage}`);

                await markBatchFailed(batch, errorMessage);
                await safeLogErrors(batch.map(id => ({
                    job_id: jobId,
                    bgg_id: id,
                    error_code: err?.code || 'SYNC_FAIL',
                    message: errorMessage
                })));
            }

            if (i + BATCH_SIZE < candidates.length) {
                await delay(effectiveRateLimitMs);
            }
        }

        result.finishedAt = new Date().toISOString();
        const finalStatus = result.failCount === 0 ? 'success' : (result.successCount > 0 ? 'partial' : 'fail');
        await safeUpdateJob(jobId, {
            status: finalStatus,
            success_count: result.successCount,
            fail_count: result.failCount,
            finished_at: result.finishedAt
        });

        return result;
    } catch (error) {
        result.finishedAt = new Date().toISOString();
        await safeUpdateJob(jobId, {
            status: 'fail',
            success_count: result.successCount,
            fail_count: result.failCount || result.totalCandidates,
            finished_at: result.finishedAt,
            last_error: error.message
        });
        throw error;
    }
}

module.exports = {
    runDetailSync
};
