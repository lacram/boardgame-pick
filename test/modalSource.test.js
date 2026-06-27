const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('rating modal receives the clicked button explicitly', () => {
    const modalSource = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'js', 'modals.js'),
        'utf8'
    );
    const indexTemplate = fs.readFileSync(
        path.join(__dirname, '..', 'views', 'index.ejs'),
        'utf8'
    );
    const mypageTemplate = fs.readFileSync(
        path.join(__dirname, '..', 'views', 'mypage.ejs'),
        'utf8'
    );

    assert.match(modalSource, /function openRatingModal\(bggId, trigger\)/);
    assert.equal(modalSource.includes('event.target'), false);
    assert.match(indexTemplate, /openRatingModal\(<%= game\.bgg_id %>, this\)/);
    assert.match(mypageTemplate, /openRatingModal\(<%= review\.bgg_id %>, this\)/);
});
