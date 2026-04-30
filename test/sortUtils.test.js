const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalizeSortBy,
    normalizeSortOrder,
    isMissingMyRatingRpc
} = require('../src/utils/sortUtils');

test('sort normalization keeps supported values and falls back on invalid values', () => {
    assert.equal(normalizeSortBy('myRating'), 'myRating');
    assert.equal(normalizeSortBy('players_recommended'), 'players_recommended');
    assert.equal(normalizeSortBy('unknown', 'weight'), 'weight');

    assert.equal(normalizeSortOrder('asc'), 'asc');
    assert.equal(normalizeSortOrder('desc'), 'desc');
    assert.equal(normalizeSortOrder('down', 'desc'), 'desc');
});

test('missing myRating RPC errors are detected for safe fallback', () => {
    assert.equal(isMissingMyRatingRpc({ code: 'PGRST202', message: 'Could not find the function' }), true);
    assert.equal(isMissingMyRatingRpc({ code: '42883', message: 'function does not exist' }), true);
    assert.equal(isMissingMyRatingRpc({ code: '42501', message: 'permission denied' }), false);
});
