const fs = require('fs/promises');
const bggDiscoveryService = require('../src/services/bggDiscoveryService');

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        file: undefined,
        limit: undefined
    };

    for (const arg of args) {
        if (arg.startsWith('--file=')) {
            options.file = arg.slice('--file='.length);
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

function createFileFetcher(filePath) {
    return async () => {
        const csv = await fs.readFile(filePath, 'utf8');
        return {
            ok: true,
            status: 200,
            statusText: 'OK',
            text: async () => csv
        };
    };
}

async function main() {
    const options = parseArgs();
    const result = await bggDiscoveryService.runDumpSync({
        fetcher: options.file ? createFileFetcher(options.file) : undefined,
        limit: options.limit,
        requestedBy: 'script'
    });

    console.log('BGG dump sync completed:', result);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
