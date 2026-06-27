const test = require('node:test');
const assert = require('node:assert/strict');
const MemoryCache = require('../utils/cache');

test('clearByPrefix removes only matching cache keys', () => {
    const cache = new MemoryCache(60 * 1000);

    try {
        cache.set('user-a-search-1', { page: 1 });
        cache.set('user-a-search-2', { page: 2 });
        cache.set('user-b-search-1', { page: 1 });

        const removed = cache.clearByPrefix('user-a-');

        assert.equal(removed, 2);
        assert.equal(cache.get('user-a-search-1'), null);
        assert.equal(cache.get('user-a-search-2'), null);
        assert.deepEqual(cache.get('user-b-search-1'), { page: 1 });
    } finally {
        cache.destroy();
    }
});
