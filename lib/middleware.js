const { verifyToken, getTokenFromRequest } = require('./jwt');
const tierConfig = require('../config/tiers.json');
const { getUserConfig, parseConfig } = require('./redis');

/**
 * Check if the request is coming from localhost.
 * Used to bypass auth/tier checks during local development.
 */
function isLocalhost(req) {
    const host = req.hostname;
    return host === 'localhost' || host === '127.0.0.1';
}

/**
 * Middleware: attach user info from JWT to req.user (if present).
 * Does NOT block unauthenticated requests — use requireAuth for that.
 */
function attachUser(req, res, next) {
    const token = getTokenFromRequest(req);
    if (token) {
        const decoded = verifyToken(token);
        if (decoded) {
            req.user = decoded;
        }
    }
    next();
}

/**
 * Middleware: require a valid JWT. Sends 401 if not authenticated.
 */
function requireAuth(req, res, next) {
    // Bypass auth on localhost for local development
    if (isLocalhost(req)) {
        req.user = req.user || { patreonId: 'localhost', name: 'Local Dev', tier: 'full' };
        return next();
    }

    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).sendFile(require('path').join(__dirname, '..', 'public', '401.html'));
    }

    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).sendFile(require('path').join(__dirname, '..', 'public', '401.html'));
    }

    req.user = decoded;
    next();
}

/**
 * Check if a user's tier meets the minimum required tier.
 * Tier order is defined in tierConfig.tierOrder (lowest to highest).
 */
function hasTierAccess(userTier, requiredTier) {
    if (!userTier) return false;

    const order = tierConfig.tierOrder;
    const userIndex = order.indexOf(userTier);
    const requiredIndex = order.indexOf(requiredTier);

    // If either tier is unknown, deny access
    if (userIndex === -1 || requiredIndex === -1) return false;

    // User's tier index must be >= required tier index
    return userIndex >= requiredIndex;
}

/**
 * Middleware factory: require that the authenticated user has at least
 * the specified tier. Must be used AFTER requireAuth.
 */
function requireTier(minTier) {
    return (req, res, next) => {
        // Bypass tier check on localhost for local development
        if (isLocalhost(req)) {
            return next();
        }

        if (!req.user) {
            return res.status(401).sendFile(require('path').join(__dirname, '..', 'public', '401.html'));
        }

        if (!hasTierAccess(req.user.tier, minTier)) {
            return res.status(403).sendFile(require('path').join(__dirname, '..', 'public', '403.html'));
        }

        next();
    };
}

/**
 * Middleware factory: require that the authenticated user has selected
 * the given tool in their panel config. Must be used AFTER requireAuth.
 * If the user hasn't configured panels yet, redirect to /setup/.
 */
function requirePanelAccess(toolKey) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).sendFile(require('path').join(__dirname, '..', 'public', '401.html'));
        }

        // User must have an active tier
        if (!req.user.tier) {
            return res.status(403).sendFile(require('path').join(__dirname, '..', 'public', '403.html'));
        }

        try {
            // Full tier always gets access to every panel, even if their
            // Redis selection is stale (e.g. a new panel was added after
            // they last configured). This means full users never get locked
            // out when we ship a new tool.
            if (req.user.tier === 'full') {
                return next();
            }

            const rawConfig = await getUserConfig(req.user.patreonId);
            const config = parseConfig(rawConfig);

            // Not configured yet — redirect to setup
            if (!config || !config.configured) {
                return res.redirect('/setup/');
            }

            // Check if this tool is in their selected panels
            if (!config.selectedPanels || !config.selectedPanels.includes(toolKey)) {
                return res.status(403).sendFile(require('path').join(__dirname, '..', 'public', '403.html'));
            }

            next();
        } catch (err) {
            console.error('Panel access check failed:', err);
            return res.status(500).send('Internal error checking panel access.');
        }
    };
}

module.exports = {
    attachUser,
    requireAuth,
    requireTier,
    hasTierAccess,
    requirePanelAccess,
    isLocalhost,
};
