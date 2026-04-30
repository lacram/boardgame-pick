const test = require('node:test');
const assert = require('node:assert/strict');
const {
    parseCookies,
    signValue,
    verifySignedValue
} = require('../src/utils/cookieUtils');

test('signed cookie values verify only with the matching secret', () => {
    const signed = signValue('local-user', 'secret-a');
    assert.equal(verifySignedValue(signed, 'secret-a'), 'local-user');
    assert.equal(verifySignedValue(signed, 'secret-b'), null);
    assert.equal(verifySignedValue('local-user.bad-signature', 'secret-a'), null);
});

test('parseCookies decodes cookie header values', () => {
    const cookies = parseCookies('bgp_user=local-user; encoded=a%20b');
    assert.equal(cookies.bgp_user, 'local-user');
    assert.equal(cookies.encoded, 'a b');
});
