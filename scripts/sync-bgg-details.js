const { Parser } = require('xml2js');
const supabase = require('../supabase-client');
const { parsePlayersToSet } = require('../utils/searchUtils');

const BASE_URL = process.env.BGG_XML_API_URL || 'https://boardgamegeek.com/xmlapi2/thing';
const APP_TOKEN = process.env.BGG_APP_TOKEN;
const BATCH_SIZE = Math.min(parseInt(process.env.BGG_DETAIL_BATCH_SIZE || '20', 10), 20);
const SYNC_LIMIT = parseInt(process.env.BGG_DETAIL_SYNC_LIMIT || '200', 10);
const MIN_AGE_DAYS = parseInt(process.env.BGG_DETAIL_MIN_AGE_DAYS || '0', 10);
const RATE_LIMIT_MS = parseInt(process.env.BGG_DETAIL_RATE_LIMIT_MS || '5000', 10);

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

    const bestRaw = (pollSummary?.bestRaw || pollDerived?.bestRaw || '').replace('Best with ', '').replace(' players', '').trim();
    const recommendedRaw = (pollSummary?.recommendedRaw || pollDerived?.recommendedRaw || '').replace('Recommended with ', '').replace(' players', '').trim();

    const bestSet = parsePlayersToSet(bestRaw);
    const recommendedSet = parsePlayersToSet(recommendedRaw);
    const bestSummary = summarizeSet(bestSet);
    const recSummary = summarizeSet(recommendedSet);

    const categories = ensureArray(item.link).filter(l => l.type === 'boardgamecategory').map(l => l.value).filter(Boolean);
    const mechanisms = ensureArray(item.link).filter(l => l.type === 'boardgamemechanic').map(l => l.value).filter(Boolean);
    const types = ensureArray(item.link).filter(l => l.type === 'boardgamesubdomain').map(l => l.value).filter(Boolean);

    const ratings = item.statistics?.ratings || {};

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
        last_detail_sync_at: new Date().toISOString(),
        detail_sync_status: 'success'
    };
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

async function loadCandidates() {
    let query = supabase
        .from('boardgames')
        .select('bgg_id, last_detail_sync_at')
        .order('last_detail_sync_at', { ascending: true })
        .limit(SYNC_LIMIT);

    if (MIN_AGE_DAYS > 0) {
        const cutoff = new Date(Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
        query = query.or(`last_detail_sync_at.is.null,last_detail_sync_at.lt.${cutoff}`);
    } else {
        query = query.is('last_detail_sync_at', null);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(row => row.bgg_id).filter(Boolean);
}

async function updateRows(rows) {
    if (!rows || rows.length === 0) return;

    const { error } = await supabase
        .from('boardgames')
        .upsert(rows, { onConflict: 'bgg_id' });

    if (error) throw error;
}

async function syncDetails() {
    const candidates = await loadCandidates();
    if (candidates.length === 0) {
        console.log('No detail sync candidates found.');
        return;
    }

    console.log(`Syncing ${candidates.length} games in batches of ${BATCH_SIZE}...`);
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
        const batch = candidates.slice(i, i + BATCH_SIZE);
        try {
            const rows = await fetchDetails(batch);
            await updateRows(rows);
            console.log(`Synced batch ${i + 1} - ${i + batch.length}`);
        } catch (err) {
            console.error(`Batch failed for ids ${batch.join(',')}:`, err.message);
            await supabase
                .from('boardgames')
                .update({
                    detail_sync_status: 'fail',
                    last_detail_sync_at: new Date().toISOString()
                })
                .in('bgg_id', batch);
        }

        if (i + BATCH_SIZE < candidates.length) {
            await delay(RATE_LIMIT_MS);
        }
    }
}

if (!APP_TOKEN) {
    console.warn('BGG_APP_TOKEN이 없어서 상세 동기화를 건너뜁니다.');
    process.exit(0);
}

syncDetails().catch(err => {
    console.error(err);
    process.exit(1);
});
