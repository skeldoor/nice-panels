const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const tierConfig = require('./config/tiers.json');
const { attachUser, requireAuth, requirePanelAccess } = require('./lib/middleware');

const app = express();

// --- Core middleware ---
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(attachUser); // Attach user info from JWT cookie to req.user on every request

// --- Auth API routes ---
app.use('/api/auth', require('./routes/auth'));

// --- Panel config API routes ---
app.use('/api/panels', require('./routes/panels'));

// --- Admin API routes ---
app.use('/api/admin', require('./routes/admin'));

// --- Setup page route ---
app.get('/setup/', requireAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'setup', 'index.html'));
});
app.get('/setup/*', requireAuth, (req, res) => {
    const relativePath = req.path.replace('/setup/', '');
    const filePath = path.join(__dirname, 'setup', relativePath);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).send('Not found');
    });
});

// --- Admin dashboard route ---
app.get('/admin/', requireAuth, (req, res) => {
    const adminIds = tierConfig.adminIds || [];
    if (!req.user || !adminIds.includes(req.user.patreonId)) {
        return res.status(403).send('Admin access required.');
    }
    res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});
app.get('/admin/*', requireAuth, (req, res) => {
    const adminIds = tierConfig.adminIds || [];
    if (!req.user || !adminIds.includes(req.user.patreonId)) {
        return res.status(403).send('Admin access required.');
    }
    const relativePath = req.path.replace('/admin/', '');
    const filePath = path.join(__dirname, 'admin', relativePath);
    res.sendFile(filePath, (err) => {
        if (err) res.status(404).send('Not found');
    });
});

// --- Protected tool routes ---
// Each tool directory is now gated by panel selection from Redis config.
// Requests to these paths go through auth + panel access checks before serving files.
for (const [toolKey, toolDef] of Object.entries(tierConfig.tools)) {
    const toolDir = path.join(__dirname, toolKey);

    // Gate the tool's index page
    app.get(toolDef.path, requireAuth, requirePanelAccess(toolKey), (req, res) => {
        res.sendFile(path.join(toolDir, 'index.html'));
    });

    // Gate all sub-assets within the tool directory (JS, CSS, images)
    app.get(`${toolDef.path}*`, requireAuth, requirePanelAccess(toolKey), (req, res) => {
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
