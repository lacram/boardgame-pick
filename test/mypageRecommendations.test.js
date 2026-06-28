const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('mypage template exposes recommendations tab and pagination links', () => {
    const template = fs.readFileSync(
        path.join(__dirname, '..', 'views', 'mypage.ejs'),
        'utf8'
    );

    assert.match(template, /data-tab="recommendations"/);
    assert.match(template, /추천 게임/);
    assert.match(template, /recommendationPageUrl/);
});

test('main page recommendation strip has next button for more recommendations', () => {
    const template = fs.readFileSync(
        path.join(__dirname, '..', 'views', 'index.ejs'),
        'utf8'
    );

    assert.match(template, /id="recommendationNextButton"/);
    assert.match(template, /data-next-page/);
});
