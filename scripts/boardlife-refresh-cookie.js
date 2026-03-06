require('dotenv').config();

const { loginWithPlaywright } = require('../src/services/boardlifeSessionService');

async function main() {
    const cookie = await loginWithPlaywright();
    console.log('[boardlife] cookie refreshed');
    if (process.env.BOARDLIFE_PRINT_COOKIE === 'true') {
        console.log(cookie);
    }
}

main().catch(error => {
    console.error('[boardlife] cookie refresh failed:', error);
    process.exit(1);
});
