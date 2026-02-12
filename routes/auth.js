const express = require('express');
const router = express.Router();
const patreon = require('../lib/patreon');
const { createToken, setTokenCookie, clearTokenCookie, verifyToken, getTokenFromRequest } = require('../lib/jwt');
const { hasTierAccess } = require('../lib/middleware');
const tierConfig = require('../config/tiers.json');

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
            tier: tier, // null if not a patron, 'basic' or 'premium' otherwise
        };

        const token = createToken(jwtPayload);
        setTokenCookie(res, token);

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
 * Used by the frontend to show locked/unlocked state.
 */
router.get('/user', (req, res) => {
    const token = getTokenFromRequest(req);

    if (!token) {
        return res.json({ authenticated: false, user: null, tools: buildToolAccessMap(null) });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.json({ authenticated: false, user: null, tools: buildToolAccessMap(null) });
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
        tools: buildToolAccessMap(decoded.tier),
    });
});

/**
 * Build a map of tool access for the frontend.
 * Returns { toolKey: { label, path, locked, minTier, minTierName } }
 */
function buildToolAccessMap(userTier) {
    const toolAccess = {};

    for (const [toolKey, toolDef] of Object.entries(tierConfig.tools)) {
        const locked = !hasTierAccess(userTier, toolDef.minTier);
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
