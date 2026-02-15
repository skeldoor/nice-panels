const { Redis } = require('@upstash/redis');

// Initialise the Redis client — supports both Upstash and legacy Vercel KV env var names
const redis = new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

// How many panels each tier is allowed to pick
const TIER_ALLOWANCES = {
    basic: 1,
    enhanced: 3,
    full: 6, // all panels
};

/**
 * Get a user's panel config from Redis.
 * Returns null if no config exists.
 */
async function getUserConfig(patreonId) {
    const data = await redis.get(`user:${patreonId}`);
    return data || null;
}

/**
 * Save a user's panel config to Redis.
 * Config shape: { tier, selectedPanels, lockedAt, configured }
 */
async function setUserConfig(patreonId, config) {
    await redis.set(`user:${patreonId}`, JSON.stringify(config));
}

/**
 * Delete a user's panel config from Redis (e.g. on cancellation).
 */
async function clearUserConfig(patreonId) {
    await redis.del(`user:${patreonId}`);
}

/**
 * Check whether the user can change their panel selection.
 * Returns true if 30 days have passed since lockedAt, or if they haven't locked yet.
 */
function canChangeSelection(config) {
    if (!config || !config.lockedAt) return true;
    return Date.now() - config.lockedAt >= THIRTY_DAYS_MS;
}

/**
 * Get the remaining time (in ms) until the user can change their selection.
 * Returns 0 if they can change now.
 */
function getTimeUntilChange(config) {
    if (!config || !config.lockedAt) return 0;
    const elapsed = Date.now() - config.lockedAt;
    return Math.max(0, THIRTY_DAYS_MS - elapsed);
}

/**
 * Get the number of panels a tier is allowed to choose.
 */
function getTierAllowance(tier) {
    return TIER_ALLOWANCES[tier] || 0;
}

/**
 * Parse stored config — handles both string and object forms from Redis.
 */
function parseConfig(data) {
    if (!data) return null;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch {
            return null;
        }
    }
    return data;
}

module.exports = {
    redis,
    getUserConfig,
    setUserConfig,
    clearUserConfig,
    canChangeSelection,
    getTimeUntilChange,
    getTierAllowance,
    parseConfig,
    TIER_ALLOWANCES,
    THIRTY_DAYS_MS,
};
