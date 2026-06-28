const test = require('node:test');
const assert = require('node:assert/strict');
const recommendationService = require('../src/services/recommendationService');

test('extractTokens counts comma-separated categories and mechanisms', () => {
    const tokens = recommendationService._extractPreferenceTokens([
        { category: 'Card Game, Economic', mechanism: 'Deck, Bag, and Pool Building, Worker Placement' },
        { category: 'Card Game', mechanism: 'Deck, Bag, and Pool Building' }
    ], 3);

    assert.deepEqual(tokens.categories, ['Card Game', 'Economic']);
    assert.deepEqual(tokens.mechanisms, ['Deck, Bag, and Pool Building', 'Worker Placement']);
});

test('scoreCandidate rewards shared tags and produces a multi-signal Korean reason', () => {
    const scored = recommendationService._scoreCandidate(
        {
            bgg_id: 20,
            name: 'Candidate',
            category: 'Card Game',
            mechanism: 'Deck, Bag, and Pool Building',
            weight: 2.1,
            rating: 7.4,
            players_recommended_raw: '2-4'
        },
        {
            categories: ['Card Game'],
            mechanisms: ['Deck, Bag, and Pool Building'],
            averageWeight: 2.0,
            players: [2, 3, 4]
        }
    );

    assert.ok(scored.score > 10);
    assert.match(scored.reason, /덱빌딩|카드/);
    assert.match(scored.reason, /난이도|인원|구성/);
});

test('filterCandidates excludes owned, seed, and recommendation-excluded games', () => {
    const candidates = [
        { bgg_id: 1, name: 'Seed' },
        { bgg_id: 2, name: 'Owned' },
        { bgg_id: 3, name: 'Excluded' },
        { bgg_id: 4, name: 'Fresh' }
    ];

    const filtered = recommendationService._filterCandidates(candidates, new Set([1]), new Set([2]), new Set([3]));

    assert.deepEqual(filtered.map(game => game.bgg_id), [4]);
});

test('getRecommendations excludes games that are only marked as owned', async () => {
    const calls = [];
    const client = {
        from(table) {
            calls.push(table);
            if (table === 'user_data') {
                return {
                    select() { return this; },
                    eq(column, value) {
                        this.eqValue = { column, value };
                        return this;
                    },
                    or(filter) {
                        this.filter = filter;
                        this.blockedQuery = filter.includes('is_recommendation_excluded');
                        return this;
                    },
                    order() { return this; },
                    limit() {
                        if (this.filter) {
                            return Promise.resolve({
                                data: [
                                    { bgg_id: 1, my_rating: 9, is_owned: false },
                                    { bgg_id: 2, my_rating: null, is_owned: true }
                                ],
                                error: null
                            });
                        }
                        return Promise.resolve({
                            data: [{ bgg_id: 2, is_owned: true }],
                            error: null
                        });
                    }
                };
            }

            return {
                select() { return this; },
                in(column, values) {
                    this.values = values;
                    return Promise.resolve({
                        data: [
                            {
                                bgg_id: 1,
                                name: 'Seed',
                                category: 'Card Game',
                                mechanism: 'Deck, Bag, and Pool Building',
                                weight: 2,
                                rating: 7,
                                players_recommended_set: [2, 3]
                            }
                        ],
                        error: null
                    });
                },
                gte() { return this; },
                order() { return this; },
                limit() {
                    return Promise.resolve({
                        data: [
                            {
                                bgg_id: 2,
                                name: 'Owned Only',
                                category: 'Card Game',
                                mechanism: 'Deck, Bag, and Pool Building',
                                weight: 2,
                                rating: 8,
                                players_recommended_set: [2, 3]
                            },
                            {
                                bgg_id: 3,
                                name: 'Fresh',
                                category: 'Card Game',
                                mechanism: 'Deck, Bag, and Pool Building',
                                weight: 2,
                                rating: 8,
                                players_recommended_set: [2, 3]
                            }
                        ],
                        error: null
                    });
                }
            };
        }
    };
    const originalClient = recommendationService._supabase;
    recommendationService._supabase = client;

    try {
        const recommendations = await recommendationService.getRecommendations('local-user', 3);
        assert.deepEqual(recommendations.map(game => game.bgg_id), [3]);
        assert.deepEqual(calls.filter(table => table === 'user_data').length, 2);
    } finally {
        recommendationService._supabase = originalClient;
    }
});

test('getRecommendations excludes games hidden from recommendations', async () => {
    const client = {
        from(table) {
            if (table === 'user_data') {
                return {
                    select() { return this; },
                    eq(column, value) {
                        this.eqColumn = column;
                        this.eqValue = value;
                        return this;
                    },
                    or(filter) {
                        this.filter = filter;
                        this.blockedQuery = filter.includes('is_recommendation_excluded');
                        return this;
                    },
                    order() { return this; },
                    limit() {
                        if (this.blockedQuery) {
                            return Promise.resolve({
                                data: [{ bgg_id: 2, is_recommendation_excluded: true }],
                                error: null
                            });
                        }
                        if (this.filter) {
                            return Promise.resolve({
                                data: [{ bgg_id: 1, my_rating: 9, is_owned: false }],
                                error: null
                            });
                        }
                        return Promise.resolve({ data: [], error: null });
                    }
                };
            }

            return {
                select() { return this; },
                in() {
                    return Promise.resolve({
                        data: [{
                            bgg_id: 1,
                            name: 'Seed',
                            category: 'Card Game',
                            mechanism: 'Deck, Bag, and Pool Building',
                            weight: 2,
                            rating: 7,
                            players_recommended_set: [2, 3]
                        }],
                        error: null
                    });
                },
                gte() { return this; },
                order() { return this; },
                limit() {
                    return Promise.resolve({
                        data: [
                            {
                                bgg_id: 2,
                                name: 'Hidden',
                                category: 'Card Game',
                                mechanism: 'Deck, Bag, and Pool Building',
                                weight: 2,
                                rating: 8,
                                players_recommended_set: [2, 3]
                            },
                            {
                                bgg_id: 3,
                                name: 'Fresh',
                                category: 'Card Game',
                                mechanism: 'Deck, Bag, and Pool Building',
                                weight: 2,
                                rating: 8,
                                players_recommended_set: [2, 3]
                            }
                        ],
                        error: null
                    });
                }
            };
        }
    };
    const originalClient = recommendationService._supabase;
    recommendationService._supabase = client;

    try {
        const recommendations = await recommendationService.getRecommendations('local-user', 3);
        assert.deepEqual(recommendations.map(game => game.bgg_id), [3]);
    } finally {
        recommendationService._supabase = originalClient;
    }
});

test('getRecommendationPage paginates ranked recommendations and wraps next page', async () => {
    const userRows = [{ bgg_id: 1, my_rating: 9, is_owned: false }];
    const seedGames = [{
        bgg_id: 1,
        name: 'Seed',
        category: 'Card Game',
        mechanism: 'Deck, Bag, and Pool Building',
        weight: 2,
        rating: 8,
        players_recommended_set: [2, 3]
    }];
    const candidateGames = [2, 3, 4, 5, 6].map(id => ({
        bgg_id: id,
        name: `Candidate ${id}`,
        korean_name: '',
        category: 'Card Game',
        mechanism: 'Deck, Bag, and Pool Building',
        weight: 2,
        rating: 9 - id / 10,
        players_recommended_set: [2, 3],
        url: `https://example.com/${id}`
    }));
    const client = {
        from(table) {
            if (table === 'user_data') {
                return {
                    select() { return this; },
                    eq(column, value) {
                        this.eqColumn = column;
                        this.eqValue = value;
                        return this;
                    },
                    or() {
                        this.seedQuery = true;
                        return this;
                    },
                    order() { return this; },
                    limit() {
                        if (this.seedQuery) return Promise.resolve({ data: userRows, error: null });
                        return Promise.resolve({ data: [], error: null });
                    }
                };
            }

            return {
                select() { return this; },
                in() {
                    return Promise.resolve({ data: seedGames, error: null });
                },
                gte() { return this; },
                order() { return this; },
                limit() {
                    return Promise.resolve({ data: candidateGames, error: null });
                }
            };
        }
    };
    const originalClient = recommendationService._supabase;
    recommendationService._supabase = client;

    try {
        const firstPage = await recommendationService.getRecommendationPage('local-user', { page: 1, pageSize: 2 });
        const thirdPage = await recommendationService.getRecommendationPage('local-user', { page: 3, pageSize: 2 });

        assert.deepEqual(firstPage.items.map(game => game.bgg_id), [2, 3]);
        assert.equal(firstPage.total, 5);
        assert.equal(firstPage.totalPages, 3);
        assert.equal(firstPage.nextPage, 2);
        assert.equal(firstPage.prevPage, 3);
        assert.deepEqual(thirdPage.items.map(game => game.bgg_id), [6]);
        assert.equal(thirdPage.nextPage, 1);
        assert.equal(thirdPage.prevPage, 2);
    } finally {
        recommendationService._supabase = originalClient;
    }
});
