const express = require('express');
const router = express.Router();
const patreon = require('../lib/patreon');
const { createToken, setTokenCookie, clearTokenCookie, verifyToken, getTokenFromRequest } = require('../lib/jwt');
const { hasTierAccess, isLocalhost } = require('../lib/middleware');
const tierConfig = require('../config/tiers.json');
const {
    getUserConfig,
    setUserConfig,
    clearUserConfig,
    canChangeSelection,
    getTimeUntilChange,
    getTierAllowance,
    isInGracePeriod,
    getGraceTimeRemaining,
    parseConfig,
} = require('../lib/redis');

/**
 * GET /api/auth/login
 * Redirects the user to Patreon's OAuth consent screen.
 */
router.get('/login', (req, res) => {
    const authUrl = patreon.getAuthUrl();
    res.redirect(authUrl);
});

/**
 * GET /api/auth/callback
 * Patreon redirects here after the user grants consent.
 * Exchanges the code for tokens, fetches tier info, creates a JWT cookie.
 * Also detects tier changes and resets panel config accordingly.
 */
router.get('/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).send('Missing authorization code from Patreon.');
    }

    try {
        // Exchange code for access token
        const tokenData = await patreon.exchangeCodeForTokens(code);
        const accessToken = tokenData.access_token;

        // Fetch user identity and tier from Patreon
        const { user, tier } = await patreon.getPatronInfo(accessToken);

        // Create JWT with user info and tier
        const jwtPayload = {
            patreonId: user.id,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            tier: tier, // null if not a patron, 'basic', 'enhanced', or 'full' otherwise
        };

        const token = createToken(jwtPayload);
        setTokenCookie(res, token);

        // --- Tier change detection ---
        try {
            const rawConfig = await getUserConfig(user.id);
            const existingConfig = parseConfig(rawConfig);

            if (!tier) {
                // User cancelled / no active subscription — revoke immediately
                await clearUserConfig(user.id);
            } else if (existingConfig && existingConfig.tier && existingConfig.tier !== tier) {
                // Tier changed (upgrade or downgrade) — reset config, force re-setup
                await setUserConfig(user.id, {
                    name: user.name,
                    tier: tier,
                    selectedPanels: [],
                    lockedAt: null,
                    configured: false,
                    lastSeenPatch: existingConfig.lastSeenPatch || null,
                });
            } else if (!existingConfig && tier) {
                // New user with a tier but no config yet — create placeholder
                await setUserConfig(user.id, {
                    name: user.name,
                    tier: tier,
                    selectedPanels: [],
                    lockedAt: null,
                    configured: false,
                });
            } else if (existingConfig && !existingConfig.tier && tier) {
                // Had no tier before, now has one — reset config but preserve lastSeenPatch
                await setUserConfig(user.id, {
                    name: user.name,
                    tier: tier,
                    selectedPanels: [],
                    lockedAt: null,
                    configured: false,
                    lastSeenPatch: existingConfig.lastSeenPatch || null,
                });
            } else if (existingConfig && tier) {
                // Tier unchanged — just update the name in case it changed on Patreon
                await setUserConfig(user.id, {
                    ...existingConfig,
                    name: user.name,
                });
            }
            // If tier is the same, leave config untouched
        } catch (redisErr) {
            // Don't block login if Redis fails — just log it
            console.error('Redis tier-change check failed:', redisErr);
        }

        // Redirect to homepage
        res.redirect('/');
    } catch (err) {
        console.error('Patreon OAuth callback error:', err.response?.data || err.message);
        res.status(500).send('Authentication failed. Please try again.');
    }
});

/**
 * GET /api/auth/logout
 * Clears the auth cookie and redirects to homepage.
 */
router.get('/logout', (req, res) => {
    clearTokenCookie(res);
    res.redirect('/');
});

/**
 * GET /api/auth/user
 * Returns the current user's info and tool access map.
 * Now includes panel config data for the frontend.
 */
router.get('/user', async (req, res) => {
    // On localhost, grant full access without requiring auth
    if (isLocalhost(req)) {
        const allPanels = Object.keys(tierConfig.tools);
        const localhostConfig = { configured: true, selectedPanels: allPanels, tier: 'full', lockedAt: null };
        return res.json({
            authenticated: true,
            user: {
                patreonId: 'localhost',
                name: 'Local Dev',
                imageUrl: null,
                tier: 'full',
                tierName: tierConfig.tiers['full']?.name || 'Full Access',
            },
            tools: buildToolAccessMap('full', localhostConfig),
            panelConfig: {
                configured: true,
                selectedPanels: allPanels,
                canChange: true,
                timeUntilChange: 0,
                allowance: getTierAllowance('full'),
                tier: 'full',
                inGrace: false,
                graceTimeRemaining: 0,
            },
        });
    }

    const token = getTokenFromRequest(req);

    if (!token) {
        return res.json({ authenticated: false, user: null, tools: buildToolAccessMap(null, null), panelConfig: null });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.json({ authenticated: false, user: null, tools: buildToolAccessMap(null, null), panelConfig: null });
    }

    // Migrate old tier names from stale JWTs (matches middleware logic)
    const LEGACY_TIER_MAP = { fan: 'basic', limited: 'enhanced', premium: 'full' };
    if (decoded.tier && !tierConfig.tierOrder.includes(decoded.tier)) {
        decoded.tier = LEGACY_TIER_MAP[decoded.tier] || null;
    }

    // Fetch panel config from Redis
    let panelConfig = null;
    try {
        const rawConfig = await getUserConfig(decoded.patreonId);
        panelConfig = parseConfig(rawConfig);
    } catch (err) {
        console.error('Failed to fetch panel config:', err);
    }

    res.json({
        authenticated: true,
        user: {
            patreonId: decoded.patreonId,
            name: decoded.name,
            imageUrl: decoded.imageUrl,
            tier: decoded.tier,
            tierName: decoded.tier ? tierConfig.tiers[decoded.tier]?.name : null,
        },
        tools: buildToolAccessMap(decoded.tier, panelConfig),
        panelConfig: panelConfig ? {
            configured: panelConfig.configured || false,
            selectedPanels: panelConfig.selectedPanels || [],
            canChange: canChangeSelection(panelConfig),
            timeUntilChange: getTimeUntilChange(panelConfig),
            allowance: getTierAllowance(decoded.tier),
            tier: panelConfig.tier || decoded.tier,
            inGrace: isInGracePeriod(panelConfig),
            graceTimeRemaining: getGraceTimeRemaining(panelConfig),
        } : {
            configured: false,
            selectedPanels: [],
            canChange: true,
            timeUntilChange: 0,
            allowance: getTierAllowance(decoded.tier),
            tier: decoded.tier,
            inGrace: false,
            graceTimeRemaining: 0,
        },
    });
});

/**
 * Build a map of tool access for the frontend.
 * Now uses panel config (selected panels) instead of tier-based minTier checks.
 */
function buildToolAccessMap(userTier, panelConfig) {
    const toolAccess = {};

    for (const [toolKey, toolDef] of Object.entries(tierConfig.tools)) {
        let locked;

        if (!userTier) {
            // Not authenticated or no tier
            locked = true;
        } else if (userTier === 'full') {
            // Full tier always has access to every panel
            locked = false;
        } else if (!panelConfig || !panelConfig.configured) {
            // Has a tier but hasn't configured panels yet — show all as locked
            locked = true;
        } else {
            // Check if this tool is in their selected panels
            locked = !panelConfig.selectedPanels || !panelConfig.selectedPanels.includes(toolKey);
        }

        toolAccess[toolKey] = {
            label: toolDef.label,
            path: toolDef.path,
            locked,
            minTier: toolDef.minTier,
            minTierName: tierConfig.tiers[toolDef.minTier]?.name || toolDef.minTier,
        };
    }

    return toolAccess;
}

module.exports = router;
