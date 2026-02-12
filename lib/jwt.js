const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'skeldoor_auth';
const TOKEN_EXPIRY = '7d';

/**
 * Create a signed JWT containing user info and tier
 */
function createToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verify and decode a JWT token. Returns the decoded payload or null if invalid.
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        return null;
    }
}

/**
 * Set the auth JWT as an HTTP-only secure cookie on the response
 */
function setTokenCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax', // 'lax' allows the cookie to be sent on redirect from Patreon
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
        path: '/',
    });
}

/**
 * Clear the auth cookie
 */
function clearTokenCookie(res) {
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        sameSite: 'lax',
        path: '/',
    });
}

/**
 * Extract the JWT token from the request cookie
 */
function getTokenFromRequest(req) {
    return req.cookies?.[COOKIE_NAME] || null;
}

module.exports = {
    COOKIE_NAME,
    createToken,
    verifyToken,
    setTokenCookie,
    clearTokenCookie,
    getTokenFromRequest,
};
