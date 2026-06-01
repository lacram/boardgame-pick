const test = require('node:test');
const assert = require('node:assert/strict');

const {
    mapRankDumpRow,
    parseCsvLine,
    runDumpSync
} = require('../src/services/bggDiscoveryService');

test('parseCsvLine handles quoted commas and escaped quotes', () => {
    assert.deepEqual(
        parseCsvLine('1,"Terraforming Mars, Ares Expedition","say ""hi"""'),
        ['1', 'Terraforming Mars, Ares Expedition', 'say "hi"']
    );
});

test('mapRankDumpRow maps BGG rank dump columns to boardgames fields', () => {
    const mapped = mapRankDumpRow(
        ['ID', 'Name', 'Rank', 'Average Rating'],
        ['224517', 'Brass: Birmingham', '1', '8.41'],
        '2026-05-31T00:00:00.000Z'
    );

    assert.deepEqual(mapped, {
        bgg_id: 224517,
        name: 'Brass: Birmingham',
        rank: 1,
        average_rating: 8.41,
        last_dump_seen_at: '2026-05-31T00:00:00.000Z'
    });
});

test('runDumpSync upserts discovered boardgames and respects a row limit', async () => {
    const upserted = [];
    const fakeSupabase = {
        from(tableName) {
            assert.equal(tableName, 'boardgames');
            return {
                upsert(batch, options) {
                    upserted.push({ batch, options });
                    return Promise.resolve({ error: null });
                }
            };
        }
    };
    const csv = [
        'id,name,rank,average rating',
        '1,Gloomhaven,3,8.6',
        '2,Ark Nova,4,8.5',
        '3,Too Many Bones,20,8.2'
    ].join('\n');

    const result = await runDumpSync({
        supabaseClient: fakeSupabase,
        fetcher: async () => ({
            ok: true,
            text: async () => csv,
            status: 200,
            statusText: 'OK'
        }),
        now: () => new Date('2026-05-31T00:00:00.000Z'),
        batchSize: 2,
        limit: 2
    });

    assert.equal(result.discoveredCount, 2);
    assert.equal(result.batchCount, 1);
    assert.deepEqual(upserted, [{
        batch: [
            {
                bgg_id: 1,
                name: 'Gloomhaven',
                rank: 3,
                average_rating: 8.6,
                last_dump_seen_at: '2026-05-31T00:00:00.000Z'
            },
            {
                bgg_id: 2,
                name: 'Ark Nova',
                rank: 4,
                average_rating: 8.5,
                last_dump_seen_at: '2026-05-31T00:00:00.000Z'
            }
        ],
        options: { onConflict: 'bgg_id' }
    }]);
});
