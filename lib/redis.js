const { Redis } = require('@upstash/redis');

// Initialise the Redis client — supports both Upstash and legacy Vercel KV env var names
const redis = new Redis({
    url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const GRACE_PERIOD_MS = 12 * 60 * 60 * 1000; // 12 hours

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
 * Check whether the user is still within the 12-hour grace period
 * after their first ever selection (firstLockedAt marks the very first pick).
 */
function isInGracePeriod(config) {
    if (!config || !config.firstLockedAt) return false;
    // Grace only applies if they haven't been through a full lock cycle yet
    // i.e. lockedAt === firstLockedAt (they've only ever picked once)
    if (config.lockedAt !== config.firstLockedAt) return false;
    return Date.now() - config.firstLockedAt < GRACE_PERIOD_MS;
}

/**
 * Get the remaining grace period time in ms. Returns 0 if not in grace.
 */
function getGraceTimeRemaining(config) {
    if (!isInGracePeriod(config)) return 0;
    return Math.max(0, GRACE_PERIOD_MS - (Date.now() - config.firstLockedAt));
}

/**
 * Check whether the user can change their panel selection.
 * Returns true if: no lock yet, in grace period, or 30 days have passed.
 */
function canChangeSelection(config) {
    if (!config || !config.lockedAt) return true;
    if (isInGracePeriod(config)) return true;
    return Date.now() - config.lockedAt >= THIRTY_DAYS_MS;
}

/**
 * Get the remaining time (in ms) until the user can change their selection.
 * Returns 0 if they can change now (including during grace).
 */
function getTimeUntilChange(config) {
    if (!config || !config.lockedAt) return 0;
    if (isInGracePeriod(config)) return 0;
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

// ========================================================
// Admin override helpers
// Stored as a single Redis hash: admin:overrides
// Each field is a patreonId, value is the tier string (basic/enhanced/full)
// ========================================================

/**
 * Get the manual tier override for a user, if any.
 * Returns the tier string or null.
 */
async function getOverride(patreonId) {
    const tier = await redis.hget('admin:overrides', patreonId);
    return tier || null;
}

/**
 * Set a manual tier override for a user.
 */
async function setOverride(patreonId, tier) {
    await redis.hset('admin:overrides', { [patreonId]: tier });
}

/**
 * Remove a manual tier override for a user.
 */
async function removeOverride(patreonId) {
    await redis.hdel('admin:overrides', patreonId);
}

/**
 * Get all manual tier overrides. Returns { patreonId: tier, ... }
 */
async function getAllOverrides() {
    const data = await redis.hgetall('admin:overrides');
    return data || {};
}

/**
 * Get all user configs from Redis (keys matching user:*).
 * Returns an array of { patreonId, ...config }.
 */
async function getAllUserConfigs() {
    const keys = [];
    let cursor = 0;
    // Scan for all user:* keys
    do {
        const result = await redis.scan(cursor, { match: 'user:*', count: 100 });
        cursor = result[0];
        keys.push(...result[1]);
    } while (cursor !== 0 && cursor !== '0');

    const configs = [];
    for (const key of keys) {
        const raw = await redis.get(key);
        const config = parseConfig(raw);
        if (config) {
            const patreonId = key.replace('user:', '');
            configs.push({ patreonId, ...config });
        }
    }
    return configs;
}

// ========================================================
// Patch notes tracking
// Stored per-user in their config object as `lastSeenPatch`
// ========================================================

/**
 * Get the last patch version the user has seen.
 */
async function getLastSeenPatch(patreonId) {
    const raw = await getUserConfig(patreonId);
    const config = parseConfig(raw);
    return config ? config.lastSeenPatch || null : null;
}

/**
 * Set the last patch version the user has seen.
 * Merges into the existing user config so we don't clobber panel data.
 */
async function setLastSeenPatch(patreonId, version) {
    const raw = await getUserConfig(patreonId);
    const config = parseConfig(raw) || {};
    config.lastSeenPatch = version;
    await setUserConfig(patreonId, config);
}

module.exports = {
    redis,
    getUserConfig,
    setUserConfig,
    clearUserConfig,
    canChangeSelection,
    getTimeUntilChange,
    getTierAllowance,
    isInGracePeriod,
    getGraceTimeRemaining,
    parseConfig,
    getOverride,
    setOverride,
    removeOverride,
    getAllOverrides,
    getAllUserConfigs,
    getLastSeenPatch,
    setLastSeenPatch,
    TIER_ALLOWANCES,
    THIRTY_DAYS_MS,
    GRACE_PERIOD_MS,
};
