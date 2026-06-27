const test = require('node:test');
const assert = require('node:assert/strict');
const {
    CATEGORY_OPTIONS,
    MECHANISM_OPTIONS,
    normalizeDiscoveryFilter
} = require('../src/utils/discoveryFilters');

test('discovery filter option lists expose Korean labels with canonical query values', () => {
    assert.ok(CATEGORY_OPTIONS.some(option => option.label === '카드' && option.value === 'Card Game'));
    assert.ok(CATEGORY_OPTIONS.some(option => option.label === '경제' && option.value === 'Economic'));
    assert.ok(MECHANISM_OPTIONS.some(option => option.label === '덱빌딩' && option.value === 'Deck, Bag, and Pool Building'));
    assert.ok(MECHANISM_OPTIONS.some(option => option.label === '일꾼 놓기' && option.value === 'Worker Placement'));
});

test('discovery filter normalization accepts labels and canonical values', () => {
    assert.equal(normalizeDiscoveryFilter('category', '카드'), 'Card Game');
    assert.equal(normalizeDiscoveryFilter('category', 'Card Game'), 'Card Game');
    assert.equal(normalizeDiscoveryFilter('mechanism', '덱빌딩'), 'Deck, Bag, and Pool Building');
    assert.equal(normalizeDiscoveryFilter('mechanism', 'Worker Placement'), 'Worker Placement');
    assert.equal(normalizeDiscoveryFilter('mechanism', '   '), '');
});
