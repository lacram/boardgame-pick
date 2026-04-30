const test = require('node:test');
const assert = require('node:assert/strict');
const {
    extractBearerToken,
    isCronAuthorized,
    normalizeJobType,
    normalizeLimit
} = require('../src/utils/cronAuth');

test('cron auth requires a configured secret and matching bearer token', () => {
    assert.equal(isCronAuthorized({ authorization: 'Bearer abc' }, ''), false);
    assert.equal(isCronAuthorized({ authorization: 'Bearer wrong' }, 'abc'), false);
    assert.equal(isCronAuthorized({ authorization: 'Bearer abc' }, 'abc'), true);
});

test('cron auth supports x-cron-secret for manual header-based calls', () => {
    assert.equal(isCronAuthorized({ 'x-cron-secret': 'abc' }, 'abc'), true);
});

test('cron helper normalizes unsafe input', () => {
    assert.equal(extractBearerToken('Basic abc'), '');
    assert.equal(normalizeJobType('unexpected'), 'incremental');
    assert.equal(normalizeJobType('full'), 'full');
    assert.equal(normalizeLimit('9999', 500), 500);
    assert.equal(normalizeLimit('12abc', 500), undefined);
    assert.equal(normalizeLimit('not-number', 500), undefined);
});
