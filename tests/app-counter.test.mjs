import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

async function loadApp(overrides = {}) {
    const source = `${await readFile(new URL('../js/app.js', import.meta.url), 'utf8')}\n;globalThis.__testApp = App;`;
    const context = {
        console,
        document: { addEventListener() {} },
        fetch: async () => ({ ok: true, status: 200 }),
        Math,
        Promise,
        setTimeout,
        clearTimeout,
        Uint8Array,
        window: {
            crypto: webcrypto,
            location: { protocol: 'https:' }
        },
        ...overrides
    };
    context.globalThis = context;
    vm.runInNewContext(source, context, { filename: 'js/app.js' });
    return context.__testApp;
}

test('client creates a random, server-valid import ID', async () => {
    const app = await loadApp();
    const importId = app.createAnalysisImportId();

    assert.match(importId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
test('client retry reuses the ID and sends no recording data', async () => {
    const requests = [];
    const app = await loadApp({
        fetch: async (url, options) => {
            requests.push({ url, options });
            if (requests.length === 1) throw new Error('response lost');
            return { ok: true, status: 200 };
        }
    });
    const importId = '550e8400-e29b-41d4-a716-446655440000';

    await app.reportSuccessfulAnalysis(importId);

    assert.equal(requests.length, 2);
    for (const request of requests) {
        assert.equal(request.url, '/api/analysis-complete');
        assert.equal(request.options.method, 'POST');
        assert.deepEqual(JSON.parse(request.options.body), { importId });
        assert.equal(request.options.keepalive, true);
    }
});
