import assert from 'node:assert/strict';
import test from 'node:test';

import analysisCompleteHandler from '../api/analysis-complete.mjs';
import statsHandler from '../api/stats.mjs';
import {
    countAnalysisImport,
    readAnalysisCount
} from '../lib/analysis-counter.mjs';

process.env.UPSTASH_REDIS_REST_URL = 'https://counter.example.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

function upstashResponse(result, options = {}) {
    return {
        ok: options.ok ?? true,
        async json() {
            return options.payload ?? { result };
        }
    };
}

function mockResponse() {
    return {
        statusCode: 200,
        headers: new Map(),
        body: '',
        setHeader(name, value) {
            this.headers.set(name.toLowerCase(), String(value));
        },
        end(body = '') {
            this.body = String(body);
        },
        json() {
            return JSON.parse(this.body);
        }
    };
}

test('readAnalysisCount initializes and reads the legacy baseline', async context => {
    let command;
    context.mock.method(globalThis, 'fetch', async (_url, options) => {
        command = JSON.parse(options.body);
        return upstashResponse(31_981);
    });

    assert.equal(await readAnalysisCount(), 31_981);
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], 1);
    assert.equal(command.at(-1), 31_981);
});
test('countAnalysisImport maps the atomic Redis result', async context => {
    let command;
    context.mock.method(globalThis, 'fetch', async (_url, options) => {
        command = JSON.parse(options.body);
        return upstashResponse([1, 31_982, 0]);
    });

    const result = await countAnalysisImport(
        '550e8400-e29b-41d4-a716-446655440000',
        'opaque-client-fingerprint'
    );

    assert.deepEqual(result, {
        counted: true,
        analyses: 31_982,
        rateLimited: false
    });
    assert.equal(command[0], 'EVAL');
    assert.equal(command[2], 3);
    assert.match(command[4], /550e8400-e29b-41d4-a716-446655440000$/);
    assert.match(command[5], /opaque-client-fingerprint$/);
});

test('analysis endpoint rejects cross-origin browser requests before storage', async context => {
    const fetchMock = context.mock.method(globalThis, 'fetch', async () => upstashResponse([1, 31_982, 0]));
    const response = mockResponse();

    await analysisCompleteHandler({
        method: 'POST',
        headers: {
            origin: 'https://attacker.example',
            host: 'neuroscope.tech',
            'sec-fetch-site': 'cross-site'
        },
        body: { importId: '550e8400-e29b-41d4-a716-446655440000' }
    }, response);

    assert.equal(response.statusCode, 403);
    assert.equal(fetchMock.mock.callCount(), 0);
});

test('analysis endpoint accepts a valid same-origin completion', async context => {
    context.mock.method(globalThis, 'fetch', async () => upstashResponse([1, 31_982, 0]));
    const response = mockResponse();

    await analysisCompleteHandler({
        method: 'POST',
        headers: {
            origin: 'https://neuroscope.tech',
            host: 'neuroscope.tech',
            'x-vercel-forwarded-for': '192.0.2.10'
        },
        body: { importId: '550e8400-e29b-41d4-a716-446655440000' }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
        counted: true,
        analyses: 31_982,
        rateLimited: false
    });
    assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('stats endpoint exposes only the current total', async context => {
    context.mock.method(globalThis, 'fetch', async () => upstashResponse(32_147));
    const response = mockResponse();

    await statsHandler({ method: 'GET', headers: {} }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { analyses: 32_147 });
});
