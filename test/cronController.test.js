const test = require('node:test');
const assert = require('node:assert/strict');

function loadCronController({ discoveryResult, detailResult }) {
    const controllerPath = require.resolve('../src/controllers/cronController');
    const discoveryPath = require.resolve('../src/services/bggDiscoveryService');
    const detailPath = require.resolve('../src/services/bggSyncService');
    const configPath = require.resolve('../config');

    delete require.cache[controllerPath];
    require.cache[configPath] = {
        exports: {
            cron: {
                secret: 'secret',
                maxSyncLimit: 500,
                maxDumpLimit: 10000
            }
        }
    };
    require.cache[discoveryPath] = {
        exports: {
            runDumpSync: async options => {
                discoveryResult.calls.push(options);
                return discoveryResult.value;
            }
        }
    };
    require.cache[detailPath] = {
        exports: {
            runDetailSync: async options => {
                detailResult.calls.push(options);
                return detailResult.value;
            }
        }
    };

    return require('../src/controllers/cronController');
}

function createResponse() {
    return {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        }
    };
}

test('Vercel BGG cron discovers new games before detail sync', async () => {
    const discoveryResult = {
        calls: [],
        value: { discoveredCount: 2, batchCount: 1 }
    };
    const detailResult = {
        calls: [],
        value: { successCount: 2, failCount: 0 }
    };
    const controller = loadCronController({ discoveryResult, detailResult });
    const res = createResponse();

    await controller.syncBgg({
        headers: {
            authorization: 'Bearer secret',
            'x-vercel-cron': '1'
        },
        query: {},
        body: {}
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(discoveryResult.calls.length, 1);
    assert.equal(discoveryResult.calls[0].requestedBy, 'vercel-cron');
    assert.equal(detailResult.calls.length, 1);
    assert.equal(detailResult.calls[0].jobType, 'full');
    assert.deepEqual(res.body.result.discovery, discoveryResult.value);
    assert.deepEqual(res.body.result.detail, detailResult.value);
});

test('BGG cron can skip discovery for manual calls', async () => {
    const discoveryResult = {
        calls: [],
        value: { discoveredCount: 1, batchCount: 1 }
    };
    const detailResult = {
        calls: [],
        value: { successCount: 1, failCount: 0 }
    };
    const controller = loadCronController({ discoveryResult, detailResult });
    const res = createResponse();

    await controller.syncBgg({
        headers: { authorization: 'Bearer secret' },
        query: { discover: 'false' },
        body: {}
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(discoveryResult.calls.length, 0);
    assert.equal(detailResult.calls.length, 1);
    assert.equal(res.body.result.discovery, null);
    assert.deepEqual(res.body.result.detail, detailResult.value);
});
