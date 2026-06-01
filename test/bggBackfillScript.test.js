const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseArgs,
    runBackfill
} = require('../scripts/backfill-bgg-details');

test('parseArgs normalizes backfill CLI options', () => {
    assert.deepEqual(
        parseArgs([
            '--chunk=1000',
            '--rounds=3',
            '--sleep=250',
            '--rateLimitMs=5000',
            '--batchSize=20',
            '--dryRun'
        ]),
        {
            chunk: 1000,
            rounds: 3,
            sleepMs: 250,
            rateLimitMs: 5000,
            batchSize: 20,
            dryRun: true
        }
    );
});

test('runBackfill repeats detail sync until rounds are exhausted', async () => {
    const calls = [];
    const remainingCounts = [2500, 1500, 500];
    const summaries = [];

    const result = await runBackfill({
        chunk: 1000,
        rounds: 3,
        sleepMs: 10,
        rateLimitMs: 5000,
        batchSize: 20,
        countRemaining: async () => remainingCounts.shift() ?? 0,
        sleep: async ms => calls.push({ type: 'sleep', ms }),
        onRoundFinished: summary => summaries.push(summary),
        syncService: {
            runDetailSync: async options => {
                calls.push({ type: 'sync', options });
                return {
                    totalCandidates: options.limit,
                    successCount: options.limit,
                    failCount: 0
                };
            }
        }
    });

    assert.equal(result.roundsRun, 3);
    assert.deepEqual(
        calls.filter(call => call.type === 'sync').map(call => call.options),
        [
            {
                jobType: 'incremental',
                limit: 1000,
                requestedBy: 'backfill-script',
                rateLimitMs: 5000,
                batchSize: 20,
                missingDetailsOnly: true
            },
            {
                jobType: 'incremental',
                limit: 1000,
                requestedBy: 'backfill-script',
                rateLimitMs: 5000,
                batchSize: 20,
                missingDetailsOnly: true
            },
            {
                jobType: 'incremental',
                limit: 500,
                requestedBy: 'backfill-script',
                rateLimitMs: 5000,
                batchSize: 20,
                missingDetailsOnly: true
            }
        ]
    );
    assert.equal(calls.filter(call => call.type === 'sleep').length, 2);
    assert.equal(summaries.length, 3);
});
