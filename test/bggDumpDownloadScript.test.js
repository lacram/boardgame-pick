const test = require('node:test');
const assert = require('node:assert/strict');

const {
    parseArgs,
    pickCsvEntryName
} = require('../scripts/download-and-sync-bgg-dump');

test('parseArgs accepts a BGG dump download URL and optional limit', () => {
    assert.deepEqual(
        parseArgs([
            '--url=https://boardgamegeek.com/data_dumps/bg_ranks?download=1',
            '--limit=1000',
            '--output=tmp/ranks.csv'
        ]),
        {
            url: 'https://boardgamegeek.com/data_dumps/bg_ranks?download=1',
            limit: 1000,
            output: 'tmp/ranks.csv'
        }
    );
});

test('pickCsvEntryName prefers boardgame ranks csv from zip entries', () => {
    assert.equal(
        pickCsvEntryName([
            'readme.txt',
            'boardgames_categories.csv',
            'boardgames_ranks.csv'
        ]),
        'boardgames_ranks.csv'
    );
});
