const { runBoardlifeNotifyJob } = require('../src/services/boardlifeNotifyService');

async function run() {
    const result = await runBoardlifeNotifyJob();
    console.log('[boardlife] worker result:', result);
}

run().catch(error => {
    console.error('[boardlife] worker failed:', error);
    process.exit(1);
});
