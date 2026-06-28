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

test('main page recommendation strip has previous and next buttons for more recommendations', () => {
    const template = fs.readFileSync(
        path.join(__dirname, '..', 'views', 'index.ejs'),
        'utf8'
    );

    assert.match(template, /id="recommendationPrevButton"/);
    assert.match(template, /data-prev-page/);
    assert.match(template, /id="recommendationNextButton"/);
    assert.match(template, /data-next-page/);
    assert.match(template, /recommendation-exclude-button/);
    assert.match(template, /data-rowid="<%= game\.bgg_id %>"/);
});

test('mypage card grid uses an even three-column desktop layout', () => {
    const styles = fs.readFileSync(
        path.join(__dirname, '..', 'public', 'css', 'styles.css'),
        'utf8'
    );

    assert.match(styles, /\.mypage-grid\s*{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
    assert.match(styles, /@media \(max-width: 900px\)[\s\S]*\.mypage-grid\s*{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    assert.match(styles, /@media \(max-width: 640px\)[\s\S]*\.mypage-grid\s*{[^}]*grid-template-columns:\s*1fr/);
});
