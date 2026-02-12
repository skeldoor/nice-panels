const { verifyToken, getTokenFromRequest } = require('./jwt');
const tierConfig = require('../config/tiers.json');

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
        if (!req.user) {
            return res.status(401).sendFile(require('path').join(__dirname, '..', 'public', '401.html'));
        }

        if (!hasTierAccess(req.user.tier, minTier)) {
            return res.status(403).sendFile(require('path').join(__dirname, '..', 'public', '403.html'));
        }

        next();
    };
}

module.exports = {
    attachUser,
    requireAuth,
    requireTier,
    hasTierAccess,
};
