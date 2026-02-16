const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../lib/middleware');
const { getLastSeenPatch, setLastSeenPatch } = require('../lib/redis');

const PATCHES_DIR = path.join(__dirname, '..', 'patches');

/**
 * Compare two semver version strings.
 * Returns positive if a > b, negative if a < b, 0 if equal.
 */
function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const na = pa[i] || 0;
        const nb = pb[i] || 0;
        if (na !== nb) return na - nb;
    }
    return 0;
}

/**
 * Get all patch versions sorted ascending, and read the latest file.
 */
function getLatestPatch() {
    if (!fs.existsSync(PATCHES_DIR)) return null;

    const files = fs.readdirSync(PATCHES_DIR)
        .filter(f => f.endsWith('.md'))
        .map(f => f.replace('.md', ''))
        .sort(compareVersions);

    if (files.length === 0) return null;

    const latestVersion = files[files.length - 1];
    const content = fs.readFileSync(path.join(PATCHES_DIR, `${latestVersion}.md`), 'utf-8');

    return { version: latestVersion, content };
}

/**
 * GET /api/patches/latest
 * Returns the latest patch notes + whether the user has already seen them.
 * Works for both authenticated and unauthenticated users.
 */
router.get('/latest', async (req, res) => {
    try {
        const patch = getLatestPatch();
        if (!patch) {
            return res.json({ available: false });
        }

        let seen = false;
        if (req.user && req.user.patreonId) {
            const lastSeen = await getLastSeenPatch(req.user.patreonId);
            seen = lastSeen ? compareVersions(lastSeen, patch.version) >= 0 : false;
        }

        res.json({
            available: true,
            version: patch.version,
            content: patch.content,
            seen,
        });
    } catch (err) {
        console.error('Patches: failed to get latest:', err);
        res.status(500).json({ error: 'Failed to load patch notes.' });
    }
});

/**
 * POST /api/patches/seen
 * Mark the latest patch as seen for the authenticated user.
 * Body: { version }
 */
router.post('/seen', requireAuth, async (req, res) => {
    try {
        const { version } = req.body;
        if (!version) {
            return res.status(400).json({ error: 'version is required.' });
        }

        await setLastSeenPatch(req.user.patreonId, version);
        res.json({ success: true });
    } catch (err) {
        console.error('Patches: failed to mark seen:', err);
        res.status(500).json({ error: 'Failed to mark patch as seen.' });
    }
});

/**
 * GET /api/patches/all
 * Returns all patch versions (for a future full changelog page).
 */
router.get('/all', (req, res) => {
    try {
        if (!fs.existsSync(PATCHES_DIR)) {
            return res.json({ patches: [] });
        }

        const files = fs.readdirSync(PATCHES_DIR)
            .filter(f => f.endsWith('.md'))
            .map(f => f.replace('.md', ''))
            .sort(compareVersions)
            .reverse(); // newest first

        const patches = files.map(version => {
            const content = fs.readFileSync(path.join(PATCHES_DIR, `${version}.md`), 'utf-8');
            return { version, content };
        });

        res.json({ patches });
    } catch (err) {
        console.error('Patches: failed to list all:', err);
        res.status(500).json({ error: 'Failed to load patch notes.' });
    }
});

module.exports = router;
