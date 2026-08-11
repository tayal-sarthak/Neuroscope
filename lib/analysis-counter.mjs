import { createHmac } from 'node:crypto';

const LEGACY_BASELINE = 31_981;
const COUNTER_KEY = 'neuroscope:{analysis-counter}:count';
const IMPORT_KEY_PREFIX = 'neuroscope:{analysis-counter}:import:';
const RATE_KEY_PREFIX = 'neuroscope:{analysis-counter}:rate:';
const IMPORT_TTL_SECONDS = 24 * 60 * 60;
const RATE_WINDOW_SECONDS = 60 * 60;
const RATE_LIMIT_PER_WINDOW = 60;
const REDIS_TIMEOUT_MS = 5_000;

const READ_COUNTER_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1], 'NX')
return tonumber(redis.call('GET', KEYS[1]))
`;

const COUNT_IMPORT_SCRIPT = `
redis.call('SET', KEYS[1], ARGV[1], 'NX')
local current = tonumber(redis.call('GET', KEYS[1]))

if redis.call('EXISTS', KEYS[2]) == 1 then
  return {0, current, 0}
end

local requests = redis.call('INCR', KEYS[3])
if requests == 1 then
  redis.call('EXPIRE', KEYS[3], ARGV[3])
end

if requests > tonumber(ARGV[2]) then
  return {0, current, 1}
end

redis.call('SET', KEYS[2], '1', 'EX', ARGV[4])
local updated = redis.call('INCR', KEYS[1])
return {1, tonumber(updated), 0}
`;

function redisConfig() {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
        throw new Error('The analysis counter storage is not configured.');
    }

    return {
        url: url.replace(/\/$/, ''),
        token
    };
}
async function redisCommand(command) {
    const { url, token } = redisConfig();
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(command),
        cache: 'no-store',
        signal: AbortSignal.timeout(REDIS_TIMEOUT_MS)
    });

    let payload;
    try {
        payload = await response.json();
    } catch {
        throw new Error('The analysis counter storage returned an invalid response.');
    }

    if (!response.ok || payload?.error) {
        throw new Error('The analysis counter storage request failed.');
    }

    return payload.result;
}

function requireCount(value) {
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error('The analysis counter storage returned an invalid count.');
    }
    return count;
}

export function fingerprintClientAddress(address) {
    const { token } = redisConfig();
    return createHmac('sha256', token)
        .update(String(address || 'unknown'))
        .digest('hex');
}

export async function readAnalysisCount() {
    const result = await redisCommand([
        'EVAL',
        READ_COUNTER_SCRIPT,
        1,
        COUNTER_KEY,
        LEGACY_BASELINE
    ]);

    return requireCount(result);
}

export async function countAnalysisImport(importId, clientFingerprint) {
    const result = await redisCommand([
        'EVAL',
        COUNT_IMPORT_SCRIPT,
        3,
        COUNTER_KEY,
        `${IMPORT_KEY_PREFIX}${importId}`,
        `${RATE_KEY_PREFIX}${clientFingerprint}`,
        LEGACY_BASELINE,
        RATE_LIMIT_PER_WINDOW,
        RATE_WINDOW_SECONDS,
        IMPORT_TTL_SECONDS
    ]);

    if (!Array.isArray(result) || result.length !== 3) {
        throw new Error('The analysis counter storage returned an invalid result.');
    }

    return {
        counted: Number(result[0]) === 1,
        analyses: requireCount(result[1]),
        rateLimited: Number(result[2]) === 1
    };
}
