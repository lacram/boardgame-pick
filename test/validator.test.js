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
