import {
    countAnalysisImport,
    fingerprintClientAddress
} from '../lib/analysis-counter.mjs';

const IMPORT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 1_024;

function getHeader(request, name) {
    if (typeof request.headers?.get === 'function') return request.headers.get(name);
    const value = request.headers?.[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}
function sendJson(response, statusCode, payload, headers = {}) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    response.end(JSON.stringify(payload));
}

function isSameOriginRequest(request) {
    const fetchSite = getHeader(request, 'sec-fetch-site');
    if (fetchSite === 'cross-site') return false;

    const origin = getHeader(request, 'origin');
    if (!origin) return true;

    const host = getHeader(request, 'x-forwarded-host') || getHeader(request, 'host');
    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

async function readJsonBody(request) {
    if (request.body !== undefined && request.body !== null) {
        if (typeof request.body === 'object' && !Buffer.isBuffer(request.body)) return request.body;
        const text = Buffer.isBuffer(request.body) ? request.body.toString('utf8') : String(request.body);
        if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('Request body is too large.');
        return JSON.parse(text);
    }

    let text = '';
    for await (const chunk of request) {
        text += chunk;
        if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new Error('Request body is too large.');
    }
    return JSON.parse(text || '{}');
}

function getClientAddress(request, importId) {
    const forwarded = getHeader(request, 'x-vercel-forwarded-for')
        || getHeader(request, 'x-forwarded-for')
        || getHeader(request, 'x-real-ip');
    return forwarded ? String(forwarded).split(',')[0].trim() : `unavailable:${importId}`;
}

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
        return;
    }

    if (!isSameOriginRequest(request)) {
        sendJson(response, 403, { error: 'Cross-origin requests are not allowed.' });
        return;
    }

    try {
        const body = await readJsonBody(request);
        const importId = typeof body?.importId === 'string' ? body.importId : '';
        if (!IMPORT_ID_PATTERN.test(importId)) {
            sendJson(response, 400, { error: 'A valid import ID is required.' });
            return;
        }

        const clientFingerprint = fingerprintClientAddress(getClientAddress(request, importId));
        const result = await countAnalysisImport(importId, clientFingerprint);

        if (result.rateLimited) {
            sendJson(response, 429, {
                error: 'Too many completed imports were reported.',
                analyses: result.analyses
            }, { 'Retry-After': '3600' });
            return;
        }

        sendJson(response, 200, result);
    } catch (error) {
        console.error('Analysis counter increment failed:', error?.message || error);
        sendJson(response, 503, { error: 'The analysis counter is temporarily unavailable.' });
    }
}
