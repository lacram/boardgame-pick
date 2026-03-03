const bggSyncService = require('../src/services/bggSyncService');

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        jobType: 'incremental',
        limit: undefined
    };

    for (const arg of args) {
        if (arg === '--full') {
            options.jobType = 'full';
            continue;
        }

        if (arg.startsWith('--limit=')) {
            const value = parseInt(arg.split('=')[1], 10);
            if (!Number.isNaN(value) && value > 0) {
                options.limit = value;
            }
        }
    }

    return options;
}

async function main() {
    const options = parseArgs();
    const result = await bggSyncService.runDetailSync({
        jobType: options.jobType,
        limit: options.limit,
        requestedBy: 'script'
    });

    console.log('BGG detail sync completed:', result);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
