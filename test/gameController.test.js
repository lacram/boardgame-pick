const test = require('node:test');
const assert = require('node:assert/strict');
const gameController = require('../src/controllers/gameController');

test('pagination urls preserve and encode active search filters', () => {
    const params = gameController._parseSearchParams({
        page: '3',
        search: 'Cat & Chocolate',
        searchPlayers: '2-4',
        searchBest: '3|5',
        weightMin: '1.5',
        weightMax: '3.5',
        showFavoritesOnly: 'on',
        sortBy: 'rating',
        sortOrder: 'desc'
    });

    const buildPageUrl = gameController._buildPageUrlFactory(params);
    const url = buildPageUrl(4);

    assert.equal(url, '?page=4&search=Cat+%26+Chocolate&searchPlayers=2-4&searchBest=3%7C5&weightMin=1.5&weightMax=3.5&showFavoritesOnly=on&sortBy=rating&sortOrder=desc');
});

test('pagination urls preserve advanced discovery filters', () => {
    const params = gameController._parseSearchParams({
        page: '1',
        category: '카드',
        mechanism: '덱빌딩',
        sortBy: 'rating',
        sortOrder: 'desc'
    });

    assert.equal(params.category, '카드');
    assert.equal(params.mechanism, '덱빌딩');

    const buildPageUrl = gameController._buildPageUrlFactory(params);
    assert.equal(
        buildPageUrl(2),
        '?page=2&category=%EC%B9%B4%EB%93%9C&mechanism=%EB%8D%B1%EB%B9%8C%EB%94%A9&sortBy=rating&sortOrder=desc'
    );
});

test('cache keys include advanced discovery filters', () => {
    const withCategory = gameController._parseSearchParams({
        category: '카드',
        mechanism: '덱빌딩'
    });
    const withoutCategory = gameController._parseSearchParams({});

    assert.notEqual(
        gameController._generateCacheKey(withCategory, 'local-user'),
        gameController._generateCacheKey(withoutCategory, 'local-user')
    );
});

test('recommendations render only on first unfiltered page', () => {
    assert.equal(gameController._shouldLoadRecommendations(gameController._parseSearchParams({})), true);
    assert.equal(gameController._shouldLoadRecommendations(gameController._parseSearchParams({ page: '2' })), false);
    assert.equal(gameController._shouldLoadRecommendations(gameController._parseSearchParams({ search: 'cat' })), false);
    assert.equal(gameController._shouldLoadRecommendations(gameController._parseSearchParams({ category: '카드' })), false);
});
