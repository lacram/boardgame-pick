const supabase = require('../supabase-client');
const { parsePlayersToSet } = require('../utils/searchUtils');

const PAGE_SIZE = 500;

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

async function backfill() {
    let page = 0;
    let totalUpdated = 0;

    while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('boardgames')
            .select('id, players_best, players_recommended, players_best_raw, players_recommended_raw')
            .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;

        for (const row of data) {
            const bestRaw = row.players_best_raw || row.players_best || '';
            const recommendedRaw = row.players_recommended_raw || row.players_recommended || '';

            const bestSet = parsePlayersToSet(bestRaw);
            const recommendedSet = parsePlayersToSet(recommendedRaw);

            const bestSummary = summarizeSet(bestSet);
            const recSummary = summarizeSet(recommendedSet);

            const updatePayload = {
                players_best_raw: bestRaw || null,
                players_recommended_raw: recommendedRaw || null,
                players_best_set: bestSummary.set,
                players_best_min: bestSummary.min,
                players_best_max: bestSummary.max,
                players_recommended_set: recSummary.set,
                players_recommended_min: recSummary.min,
                players_recommended_max: recSummary.max
            };

            const { error: updateError } = await supabase
                .from('boardgames')
                .update(updatePayload)
                .eq('id', row.id);

            if (updateError) throw updateError;

            totalUpdated += 1;
        }

        page += 1;
        console.log(`Processed ${totalUpdated} rows...`);
    }

    console.log(`Backfill complete. Updated ${totalUpdated} rows.`);
}

backfill().catch(err => {
    console.error(err);
    process.exit(1);
});
