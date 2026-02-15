const express = require('express');
const router = express.Router();
const { requireAuth } = require('../lib/middleware');
const tierConfig = require('../config/tiers.json');
const {
    getUserConfig,
    setUserConfig,
    canChangeSelection,
    getTimeUntilChange,
    getTierAllowance,
    parseConfig,
} = require('../lib/redis');

/**
 * GET /api/panels/config
 * Returns the user's current panel configuration, lock status, and allowance.
 */
router.get('/config', requireAuth, async (req, res) => {
    try {
        const rawConfig = await getUserConfig(req.user.patreonId);
        const config = parseConfig(rawConfig);
        const allowance = getTierAllowance(req.user.tier);

        if (!config) {
            return res.json({
                configured: false,
                selectedPanels: [],
                canChange: true,
                timeUntilChange: 0,
                allowance,
                tier: req.user.tier,
            });
        }

        res.json({
            configured: config.configured || false,
            selectedPanels: config.selectedPanels || [],
            canChange: canChangeSelection(config),
            timeUntilChange: getTimeUntilChange(config),
            allowance,
            tier: config.tier || req.user.tier,
        });
    } catch (err) {
        console.error('Failed to get panel config:', err);
        res.status(500).json({ error: 'Failed to retrieve panel configuration.' });
    }
});

/**
 * POST /api/panels/select
 * Save the user's panel selection. Validates count against tier allowance.
 * Body: { panels: ["infobox", "bankview", ...] }
 */
router.post('/select', requireAuth, async (req, res) => {
    try {
        const { panels } = req.body;

        if (!req.user.tier) {
            return res.status(403).json({ error: 'You need an active subscription to select panels.' });
        }

        const allowance = getTierAllowance(req.user.tier);

        // Validate panels is an array
        if (!Array.isArray(panels)) {
            return res.status(400).json({ error: 'Panels must be an array.' });
        }

        // Validate panel count matches allowance
        if (panels.length !== allowance) {
            return res.status(400).json({
                error: `Your tier allows exactly ${allowance} panel${allowance !== 1 ? 's' : ''}. You selected ${panels.length}.`,
            });
        }

        // Validate all panel keys are valid
        const validToolKeys = Object.keys(tierConfig.tools);
        for (const panel of panels) {
            if (!validToolKeys.includes(panel)) {
                return res.status(400).json({ error: `Invalid panel key: ${panel}` });
            }
        }

        // Check for duplicates
        if (new Set(panels).size !== panels.length) {
            return res.status(400).json({ error: 'Duplicate panels are not allowed.' });
        }

        // Check if user can change (30-day lock)
        const rawConfig = await getUserConfig(req.user.patreonId);
        const existingConfig = parseConfig(rawConfig);

        if (existingConfig && existingConfig.configured && !canChangeSelection(existingConfig)) {
            const remaining = getTimeUntilChange(existingConfig);
            const days = Math.ceil(remaining / (24 * 60 * 60 * 1000));
            return res.status(403).json({
                error: `You can't change your panels yet. ${days} day${days !== 1 ? 's' : ''} remaining.`,
                timeUntilChange: remaining,
            });
        }

        // Save the selection (preserve name from existing config)
        const existingName = existingConfig ? existingConfig.name : req.user.name;
        await setUserConfig(req.user.patreonId, {
            name: existingName || req.user.name,
            tier: req.user.tier,
            selectedPanels: panels,
            lockedAt: Date.now(),
            configured: true,
        });

        res.json({
            success: true,
            selectedPanels: panels,
            message: 'Panels selected successfully! Your choice is locked in for 30 days.',
        });
    } catch (err) {
        console.error('Failed to save panel selection:', err);
        res.status(500).json({ error: 'Failed to save panel selection.' });
    }
});

/**
 * GET /api/panels/available
 * Returns all available panels with their labels (for the chooser UI).
 */
router.get('/available', requireAuth, (req, res) => {
    const panels = [];
    for (const [toolKey, toolDef] of Object.entries(tierConfig.tools)) {
        panels.push({
            key: toolKey,
            label: toolDef.label,
            path: toolDef.path,
        });
    }
    res.json({ panels });
});

module.exports = router;
