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
