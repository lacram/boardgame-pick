const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const bggDiscoveryService = require('../src/services/bggDiscoveryService');

const unzip = promisify(zlib.unzip);

function parseArgs(args = process.argv.slice(2)) {
    const options = {
        url: undefined,
        limit: undefined,
        output: undefined
    };

    for (const arg of args) {
        if (arg.startsWith('--url=')) {
            options.url = arg.slice('--url='.length);
            continue;
        }
        if (arg.startsWith('--limit=')) {
            const value = parseInt(arg.slice('--limit='.length), 10);
            if (Number.isFinite(value) && value > 0) options.limit = value;
            continue;
        }
        if (arg.startsWith('--output=')) {
            options.output = arg.slice('--output='.length);
        }
    }

    return options;
}

function pickCsvEntryName(entryNames) {
    const csvNames = entryNames.filter(name => /\.csv$/i.test(name));
    return (
        csvNames.find(name => /boardgames?_ranks/i.test(name)) ||
        csvNames.find(name => /ranks/i.test(name)) ||
        csvNames[0] ||
        null
    );
}

function readUInt16LE(buffer, offset) {
    return buffer.readUInt16LE(offset);
}

function readUInt32LE(buffer, offset) {
    return buffer.readUInt32LE(offset);
}

async function extractCsvFromZip(buffer) {
    const entries = [];
    let offset = 0;

    while (offset + 30 <= buffer.length) {
        const signature = readUInt32LE(buffer, offset);
        if (signature !== 0x04034b50) break;

        const compressionMethod = readUInt16LE(buffer, offset + 8);
        const compressedSize = readUInt32LE(buffer, offset + 18);
        const fileNameLength = readUInt16LE(buffer, offset + 26);
        const extraLength = readUInt16LE(buffer, offset + 28);
        const fileNameStart = offset + 30;
        const fileNameEnd = fileNameStart + fileNameLength;
        const dataStart = fileNameEnd + extraLength;
        const dataEnd = dataStart + compressedSize;
        const name = buffer.subarray(fileNameStart, fileNameEnd).toString('utf8');

        entries.push({
            name,
            compressionMethod,
            data: buffer.subarray(dataStart, dataEnd)
        });

        offset = dataEnd;
    }

    const csvName = pickCsvEntryName(entries.map(entry => entry.name));
    if (!csvName) {
        throw new Error('No CSV file found in downloaded ZIP');
    }

    const entry = entries.find(item => item.name === csvName);
    if (entry.compressionMethod === 0) {
        return entry.data.toString('utf8');
    }
    if (entry.compressionMethod === 8) {
        const inflated = await unzip(entry.data);
        return inflated.toString('utf8');
    }

    throw new Error(`Unsupported ZIP compression method ${entry.compressionMethod} for ${csvName}`);
}

async function downloadBuffer(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'boardgame-pick/1.0',
            Accept: 'text/csv,application/zip,application/octet-stream,*/*'
        }
    });

    if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
        buffer: Buffer.from(arrayBuffer),
        contentType: response.headers.get('content-type') || ''
    };
}

async function csvFromDownload(url) {
    const { buffer, contentType } = await downloadBuffer(url);
    const looksZip = buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;

    if (looksZip || /zip/i.test(contentType)) {
        return extractCsvFromZip(buffer);
    }

    return buffer.toString('utf8');
}

function createCsvFetcher(csv) {
    return async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => csv
    });
}

async function main() {
    const options = parseArgs();
    if (!options.url) {
        throw new Error('Missing required --url=<download-url>');
    }

    const csv = await csvFromDownload(options.url);
    const outputPath = options.output || path.join(os.tmpdir(), `bgg-ranks-${Date.now()}.csv`);
    await fs.writeFile(outputPath, csv, 'utf8');

    const result = await bggDiscoveryService.runDumpSync({
        fetcher: createCsvFetcher(csv),
        limit: options.limit,
        requestedBy: 'download-script'
    });

    console.log('BGG dump download and sync completed:', {
        outputPath,
        ...result
    });
}

if (require.main === module) {
    main().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = {
    csvFromDownload,
    extractCsvFromZip,
    parseArgs,
    pickCsvEntryName
};
