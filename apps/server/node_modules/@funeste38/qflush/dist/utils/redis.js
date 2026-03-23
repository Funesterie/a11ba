"use strict";
// Small helper to create an optional Redis client.
// If QFLUSH_DISABLE_REDIS=1 or no URL is provided, returns null.
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisClient = createRedisClient;
function createRedisClient() {
    const DISABLED = process.env.QFLUSH_DISABLE_REDIS === '1' || String(process.env.QFLUSH_DISABLE_REDIS).toLowerCase() === 'true';
    const url = process.env.QFLUSH_REDIS_URL || process.env.REDIS_URL || '';
    if (DISABLED || !url)
        return null;
    // Require lazily to avoid forcing ioredis dependency when not used
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Redis = require('ioredis');
        const opts = {};
        return new Redis(url, opts);
    }
    catch (e) {
        return null;
    }
}
