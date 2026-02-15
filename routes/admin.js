const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/middleware');
const tierConfig = require('../config/tiers.json');
const {
    getAllUserConfigs,
    getAllOverrides,
    getOverride,
    setOverride,
    removeOverride,
    getUserConfig,
    setUserConfig,
    clearUserConfig,
    parseConfig,
    canChangeSelection,
    getTimeUntilChange,
    isInGracePeriod,
    getGraceTimeRemaining,
} = require('../lib/redis');

/**
 * Middleware: require the authenticated user is in the adminIds list.
 */
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Not authenticated.' });
    }
    const adminIds = tierConfig.adminIds || [];
    if (!adminIds.includes(req.user.patreonId)) {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
}

/**
 * GET /api/admin/users
 * List all user configs from Redis + their override status.
 */
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
    try {
        const [configs, overrides] = await Promise.all([
            getAllUserConfigs(),
            getAllOverrides(),
        ]);

        const users = configs.map(config => ({
            patreonId: config.patreonId,
            name: config.name || 'Unknown',
            tier: config.tier || null,
            selectedPanels: config.selectedPanels || [],
            configured: config.configured || false,
            lockedAt: config.lockedAt || null,
            firstLockedAt: config.firstLockedAt || null,
            canChange: canChangeSelection(config),
            timeUntilChange: getTimeUntilChange(config),
            inGrace: isInGracePeriod(config),
            graceTimeRemaining: getGraceTimeRemaining(config),
            override: overrides[config.patreonId] || null,
        }));

        // Sort by name
        users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        res.json({ users, overrides });
    } catch (err) {
        console.error('Admin: failed to list users:', err);
        res.status(500).json({ error: 'Failed to load users.' });
    }
});

/**
 * GET /api/admin/overrides
 * List all manual tier overrides.
 */
router.get('/overrides', requireAuth, requireAdmin, async (req, res) => {
    try {
        const overrides = await getAllOverrides();
        res.json({ overrides });
    } catch (err) {
        console.error('Admin: failed to list overrides:', err);
        res.status(500).json({ error: 'Failed to load overrides.' });
    }
});

/**
 * POST /api/admin/overrides
 * Set a manual tier override for a user.
 * Body: { patreonId, tier }
 */
router.post('/overrides', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { patreonId, tier } = req.body;

        if (!patreonId || !tier) {
            return res.status(400).json({ error: 'patreonId and tier are required.' });
        }

        if (!tierConfig.tierOrder.includes(tier)) {
            return res.status(400).json({ error: `Invalid tier: ${tier}. Must be one of: ${tierConfig.tierOrder.join(', ')}` });
        }

        await setOverride(patreonId, tier);

        // Also reset their panel config so they go through setup with the new tier
        const rawConfig = await getUserConfig(patreonId);
        const existingConfig = parseConfig(rawConfig);
        if (existingConfig) {
            await setUserConfig(patreonId, {
                ...existingConfig,
                tier: tier,
                selectedPanels: [],
                lockedAt: null,
                firstLockedAt: null,
                configured: false,
            });
        }

        res.json({ success: true, message: `Override set: user ${patreonId} → ${tier}` });
    } catch (err) {
        console.error('Admin: failed to set override:', err);
        res.status(500).json({ error: 'Failed to set override.' });
    }
});

/**
 * DELETE /api/admin/overrides/:patreonId
 * Remove a manual tier override for a user.
 */
router.delete('/overrides/:patreonId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { patreonId } = req.params;
        await removeOverride(patreonId);
        res.json({ success: true, message: `Override removed for user ${patreonId}` });
    } catch (err) {
        console.error('Admin: failed to remove override:', err);
        res.status(500).json({ error: 'Failed to remove override.' });
    }
});

/**
 * DELETE /api/admin/users/:patreonId
 * Clear a user's panel config entirely (force re-setup on next visit).
 */
router.delete('/users/:patreonId', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { patreonId } = req.params;
        await clearUserConfig(patreonId);
        res.json({ success: true, message: `Config cleared for user ${patreonId}` });
    } catch (err) {
        console.error('Admin: failed to clear user config:', err);
        res.status(500).json({ error: 'Failed to clear user config.' });
    }
});

module.exports = router;
