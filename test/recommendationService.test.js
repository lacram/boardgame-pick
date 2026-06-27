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

test('filterCandidates excludes owned and seed games', () => {
    const candidates = [
        { bgg_id: 1, name: 'Seed' },
        { bgg_id: 2, name: 'Owned' },
        { bgg_id: 3, name: 'Fresh' }
    ];

    const filtered = recommendationService._filterCandidates(candidates, new Set([1]), new Set([2]));

    assert.deepEqual(filtered.map(game => game.bgg_id), [3]);
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
