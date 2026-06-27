const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('BGG detail sync source does not persist raw XML payloads', () => {
    const source = fs.readFileSync(
        path.join(__dirname, '..', 'src', 'services', 'bggSyncService.js'),
        'utf8'
    );

    assert.equal(source.includes('raw_json'), false);
});
