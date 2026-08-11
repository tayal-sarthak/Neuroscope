import { readAnalysisCount } from '../lib/analysis-counter.mjs';

function sendJson(response, statusCode, payload, headers = {}) {
    response.statusCode = statusCode;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    for (const [name, value] of Object.entries(headers)) response.setHeader(name, value);
    response.end(JSON.stringify(payload));
}
export default async function handler(request, response) {
    if (request.method !== 'GET') {
        sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
        return;
    }

    try {
        const analyses = await readAnalysisCount();
        sendJson(response, 200, { analyses });
    } catch (error) {
        console.error('Analysis counter read failed:', error?.message || error);
        sendJson(response, 503, { error: 'The analysis counter is temporarily unavailable.' });
    }
}
