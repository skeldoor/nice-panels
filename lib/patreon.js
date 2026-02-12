const axios = require('axios');
const tierConfig = require('../config/tiers.json');

const PATREON_AUTH_URL = 'https://www.patreon.com/oauth2/authorize';
const PATREON_TOKEN_URL = 'https://www.patreon.com/api/oauth2/token';
const PATREON_API_BASE = 'https://www.patreon.com/api/oauth2/v2';

/**
 * Generate the Patreon OAuth2 authorization URL
 */
function getAuthUrl(redirectUri) {
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.PATREON_CLIENT_ID,
        redirect_uri: redirectUri || process.env.PATREON_REDIRECT_URI,
        scope: 'identity identity.memberships',
    });
    return `${PATREON_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens
 */
async function exchangeCodeForTokens(code) {
    const response = await axios.post(PATREON_TOKEN_URL, new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: process.env.PATREON_CLIENT_ID,
        client_secret: process.env.PATREON_CLIENT_SECRET,
        redirect_uri: process.env.PATREON_REDIRECT_URI,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data; // { access_token, refresh_token, expires_in, ... }
}

/**
 * Refresh an expired access token using a refresh token
 */
async function refreshAccessToken(refreshToken) {
    const response = await axios.post(PATREON_TOKEN_URL, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.PATREON_CLIENT_ID,
        client_secret: process.env.PATREON_CLIENT_SECRET,
    }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
}

/**
 * Fetch the current user's identity and membership info from Patreon API v2.
 * Returns { user, tier } where tier is the matched tier key from tiers.json or null.
 */
async function getPatronInfo(accessToken) {
    const response = await axios.get(`${PATREON_API_BASE}/identity`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
            'fields[user]': 'full_name,email,image_url',
            'fields[member]': 'patron_status',
            include: 'memberships,memberships.currently_entitled_tiers',
        },
    });

    const data = response.data;
    const user = {
        id: data.data.id,
        name: data.data.attributes.full_name,
        email: data.data.attributes.email,
        imageUrl: data.data.attributes.image_url,
    };

    // Extract entitled tier IDs from the included memberships
    const entitledTierIds = new Set();
    if (data.included) {
        for (const item of data.included) {
            if (item.type === 'member' && item.attributes.patron_status === 'active_patron') {
                const tierRels = item.relationships?.currently_entitled_tiers?.data || [];
                for (const tierRel of tierRels) {
                    entitledTierIds.add(tierRel.id);
                }
            }
        }
    }

    // Admin override — creators/admins get the highest tier automatically
    const adminIds = tierConfig.adminIds || [];
    if (adminIds.includes(user.id)) {
        const highestTier = tierConfig.tierOrder[tierConfig.tierOrder.length - 1];
        return { user, tier: highestTier };
    }

    // Manual overrides — hardcoded access grants (premium checked first)
    const manualPremium = tierConfig.manualPremium || [];
    if (manualPremium.includes(user.id)) {
        return { user, tier: 'premium' };
    }
    const manualLimited = tierConfig.manualLimited || [];
    if (manualLimited.includes(user.id)) {
        return { user, tier: 'limited' };
    }

    // Match against our tier config — pick the highest tier the user qualifies for
    let matchedTier = null;
    for (const tierKey of [...tierConfig.tierOrder].reverse()) {
        const tierDef = tierConfig.tiers[tierKey];
        if (entitledTierIds.has(tierDef.patreonTierId)) {
            matchedTier = tierKey;
            break;
        }
    }

    return { user, tier: matchedTier };
}

module.exports = {
    getAuthUrl,
    exchangeCodeForTokens,
    refreshAccessToken,
    getPatronInfo,
};
