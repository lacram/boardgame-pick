const test = require('node:test');
const assert = require('node:assert/strict');
const GameValidator = require('../src/validators/gameValidator');

test('toggle validation rejects malformed positive integers', () => {
    const invalid = GameValidator.validateToggleRequest({
        rowId: '1abc',
        currentFav: 0
    });
    assert.equal(invalid.isValid, false);

    const valid = GameValidator.validateToggleRequest({
        rowId: '123',
        currentFav: '0'
    });
    assert.equal(valid.isValid, true);

    const invalidState = GameValidator.validateToggleRequest({
        rowId: '123',
        currentFav: 'off'
    });
    assert.equal(invalidState.isValid, false);
});

test('review validation accepts only integer ratings from 1 to 10', () => {
    assert.equal(GameValidator.validateReviewRequest({ bggId: '1', rating: '10' }).isValid, true);
    assert.equal(GameValidator.validateReviewRequest({ bggId: '1', rating: '10.5' }).isValid, false);
    assert.equal(GameValidator.validateReviewRequest({ bggId: '1', rating: '1abc' }).isValid, false);
    assert.equal(GameValidator.validateReviewRequest({ bggId: '1', rating: '0' }).isValid, false);
});

test('search validation accepts supported sort options only', () => {
    assert.equal(GameValidator.validateSearchParams({ sortBy: 'myRating', sortOrder: 'asc' }).isValid, true);
    assert.equal(GameValidator.validateSearchParams({ sortBy: 'play_time_min', sortOrder: 'desc' }).isValid, true);

    const invalidField = GameValidator.validateSearchParams({ sortBy: 'drop table', sortOrder: 'desc' });
    assert.equal(invalidField.isValid, false);
    assert.match(invalidField.errors.join('\n'), /정렬 기준/);

    const invalidOrder = GameValidator.validateSearchParams({ sortBy: 'rating', sortOrder: 'down' });
    assert.equal(invalidOrder.isValid, false);
    assert.match(invalidOrder.errors.join('\n'), /정렬 방향/);
});

test('search validation limits advanced discovery filter length', () => {
    assert.equal(GameValidator.validateSearchParams({ category: '카드', mechanism: '덱빌딩' }).isValid, true);

    const longValue = '가'.repeat(101);
    const invalidCategory = GameValidator.validateSearchParams({ category: longValue });
    const invalidMechanism = GameValidator.validateSearchParams({ mechanism: longValue });

    assert.equal(invalidCategory.isValid, false);
    assert.match(invalidCategory.errors.join('\n'), /게임 종류/);
    assert.equal(invalidMechanism.isValid, false);
    assert.match(invalidMechanism.errors.join('\n'), /진행 방식/);
});
