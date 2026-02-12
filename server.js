const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const tierConfig = require('./config/tiers.json');
const { attachUser, requireAuth, requireTier } = require('./lib/middleware');

const app = express();

// --- Core middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(attachUser); // Attach user info from JWT cookie to req.user on every request

// --- Auth API routes ---
app.use('/api/auth', require('./routes/auth'));

// --- Protected tool routes ---
// Each tool directory is gated by its minTier from the config.
// Requests to these paths go through auth + tier checks before serving files.
for (const [toolKey, toolDef] of Object.entries(tierConfig.tools)) {
    const toolDir = path.join(__dirname, toolKey);

    // Gate the tool's index page
    app.get(toolDef.path, requireAuth, requireTier(toolDef.minTier), (req, res) => {
        res.sendFile(path.join(toolDir, 'index.html'));
    });

    // Gate all sub-assets within the tool directory (JS, CSS, images)
    app.get(`${toolDef.path}*`, requireAuth, requireTier(toolDef.minTier), (req, res) => {
        // Strip the leading tool path to get the relative file path
        const relativePath = req.path.replace(toolDef.path, '');
        const filePath = path.join(toolDir, relativePath);
        res.sendFile(filePath, (err) => {
            if (err) res.status(404).send('Not found');
        });
    });
}

// --- Static files (non-protected assets: fonts, resources, shared CSS/JS, etc.) ---
// These are served without auth so the homepage, styles, and shared scripts still work.
app.use(express.static(path.join(__dirname), {
    // Exclude tool directories from static serving (they're handled above)
    setHeaders: (res, filePath) => {},
}));

// --- Homepage ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

module.exports = app;

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
