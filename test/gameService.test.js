const test = require('node:test');
const assert = require('node:assert/strict');
const gameService = require('../src/services/gameService');

class MockQuery {
    constructor() {
        this.calls = [];
    }

    or(value) {
        this.calls.push(['or', value]);
        return this;
    }

    overlaps(column, value) {
        this.calls.push(['overlaps', column, value]);
        return this;
    }

    gte(column, value) {
        this.calls.push(['gte', column, value]);
        return this;
    }

    lte(column, value) {
        this.calls.push(['lte', column, value]);
        return this;
    }

    ilike(column, value) {
        this.calls.push(['ilike', column, value]);
        return this;
    }
}

test('advanced filters normalize Korean aliases and apply category and mechanism ilike filters', () => {
    const query = new MockQuery();

    gameService._applyFilters(query, {
        category: '카드',
        mechanism: '덱빌딩'
    });

    assert.deepEqual(query.calls, [
        ['ilike', 'category', '%Card Game%'],
        ['ilike', 'mechanism', '%Deck, Bag, and Pool Building%']
    ]);
});

test('advanced filters escape SQL wildcard characters before ilike', () => {
    const query = new MockQuery();

    gameService._applyFilters(query, {
        category: '100% 카드_',
        mechanism: ''
    });

    assert.deepEqual(query.calls, [
        ['ilike', 'category', '%100\\% 카드\\_%']
    ]);
});

test('advanced filters ignore whitespace-only values', () => {
    const query = new MockQuery();

    gameService._applyFilters(query, {
        category: '   ',
        mechanism: '\t'
    });

    assert.deepEqual(query.calls, []);
});

test('boardgame query builder carries advanced filters through shared paths', () => {
    const originalSupabase = gameService._supabase;
    const query = new MockQuery();

    gameService._supabase = {
        from(table) {
            assert.equal(table, 'boardgames');
            return {
                select() {
                    return query;
                }
            };
        }
    };

    try {
        gameService._buildBoardgameQuery({
            category: '경제',
            mechanism: '일꾼 놓기'
        }, 'bgg_id');
    } finally {
        gameService._supabase = originalSupabase;
    }

    assert.deepEqual(query.calls, [
        ['ilike', 'category', '%Economic%'],
        ['ilike', 'mechanism', '%Worker Placement%']
    ]);
});
