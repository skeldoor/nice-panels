/**
 * Chunk Map — interactive OSRS chunk highlighter
 *
 * Map image: 9216 × 6528 px  (4 px / game-tile)
 * Chunk    : 48 × 48 tiles → 192 × 192 px on the image
 * Grid     : 48 columns × 34 rows
 *
 * All chunks start DARKENED (locked). Shift+click to unlock (reveal) them.
 * Ctrl+click to toggle a skull icon in the top-right of a chunk.
 * Default interaction is pan; scroll to zoom.
 */
(() => {
    'use strict';

    // ── constants ──────────────────────────────────────────────
    const MAP_W       = 9216;
    const MAP_H       = 6528;
    const CHUNK_PX    = 192;         // pixels per chunk on the source image (6× original 32)
    const COLS        = Math.floor(MAP_W / CHUNK_PX);  // 48
    const ROWS        = Math.floor(MAP_H / CHUNK_PX);  // 34
    const TOTAL       = COLS * ROWS;
    const SKULL_SIZE_DEFAULT = 50;   // skull icon draw size: 2× native 25px for crisp pixel scaling

    // ── DOM refs ───────────────────────────────────────────────
    const viewport    = document.getElementById('viewport');
    const canvasWrap  = document.getElementById('canvasWrap');
    const mapImg      = document.getElementById('mapImage');
    const overlay     = document.getElementById('chunkOverlay');
    const gridCanvas  = document.getElementById('gridOverlay');
    const skullCanvas = document.getElementById('skullOverlay');
    const tooltip     = document.getElementById('tooltip');
    const minimapEl   = document.getElementById('minimap');
    const minimapWrap = document.getElementById('minimapWrap');
    const minimapVP   = document.getElementById('minimapViewport');

    const darknessSelect = document.getElementById('darknessOpacity');
    const darknessColorInput = document.getElementById('darknessColor');
    const gridToggle  = document.getElementById('gridToggle');
    const gridColorInput = document.getElementById('gridColor');
    const gridOpacitySelect = document.getElementById('gridOpacity');
    const glowToggle  = document.getElementById('glowToggle');
    const glowColorInput = document.getElementById('glowColor');
    const glowSizeInput = document.getElementById('glowSize');
    const glowIntensityInput = document.getElementById('glowIntensity');
    const glowPowerInput = document.getElementById('glowPower');
    const glowBorderInput = document.getElementById('glowBorder');
    const glowCornersSelect = document.getElementById('glowCorners');
    const perspTilt   = document.getElementById('perspTilt');
    const perspTiltY  = document.getElementById('perspTiltY');
    const perspRotate = document.getElementById('perspRotate');
    const skullSizeSelect = document.getElementById('skullSize');
    const skullPosSelect  = document.getElementById('skullPosition');
    const clearBtn    = document.getElementById('clearBtn');
    const unlockAllBtn = document.getElementById('unlockAllBtn');
    const saveBtn     = document.getElementById('saveBtn');
    const saveOverlay = document.getElementById('saveOverlay');
    const exportFull  = document.getElementById('exportFull');
    const exportView  = document.getElementById('exportView');
    const cancelExport = document.getElementById('cancelExport');
    const chunkCounter = document.getElementById('chunkCounter');
    const animStyleSelect = document.getElementById('animStyle');

    const ctx         = overlay.getContext('2d');
    const gridCtx     = gridCanvas.getContext('2d');
    const skullCtx    = skullCanvas.getContext('2d');

    // ── preload marker icons ────────────────────────────────────
    const MARKER_TYPES = ['skull', 'redskull', 'lock']; // cycle order
    const markerImgs  = {};
    let markersReady  = 0;
    const totalMarkers = 3;
    function onMarkerLoad() { markersReady++; if (markersReady === totalMarkers) drawOverlay(); }

    const skullImg = new Image();
    skullImg.src   = '/chunkmap/Skull.png';
    skullImg.onload = onMarkerLoad;
    markerImgs.skull = skullImg;

    const redSkullImg = new Image();
    redSkullImg.src   = '/chunkmap/RedSkull.png';
    redSkullImg.onload = onMarkerLoad;
    markerImgs.redskull = redSkullImg;

    const lockImg = new Image();
    lockImg.src   = '/chunkmap/Lock.png';
    lockImg.onload = onMarkerLoad;
    markerImgs.lock = lockImg;

    // ── state ──────────────────────────────────────────────────
    // Set of unlocked chunk keys ("col,row"). Everything NOT in this set is darkened.
    const unlocked    = new Set();
    // Map of chunk keys → marker type ('skull' | 'redskull' | 'lock')
    const markers     = new Map();

    // Ordered queue of chunk keys for playback
    const chunkQueue  = [];
    let hoveredKey    = null;   // chunk key currently under the mouse
    let playbackTimer = null;   // interval ID during playback
    let playbackActive = false;  // true for entire duration of playback (stable flag)

    // Animation state: chunks currently animating their unlock reveal
    // Map of chunkKey → { start: timestamp, duration: ms }
    const animatingChunks = new Map();
    const ANIM_DURATION   = 400; // ms for the grow-in animation
    let animFrameId       = null;

    // ── offscreen glow cache ────────────────────────────────────
    // The expensive shadowBlur multi-pass bloom is rendered to an offscreen
    // canvas only when the settled set or glow settings change.  During
    // animation frames we just drawImage() the cached result — near zero cost.
    let _cachedSettledKey  = '';          // fingerprint for change detection
    let _cachedGlowCanvas  = null;       // OffscreenCanvas / regular canvas
    let _cachedGlowCtx     = null;
    let _cachedGlowSettingsKey = '';      // fingerprint of glow slider values

    function buildSettledKey(settledSet) {
        if (settledSet.size === 0) return '0';
        let h = settledSet.size;
        for (const k of settledSet) {
            const [c, r] = k.split(',');
            h = (h * 31 + (Number(c) * 100 + Number(r))) | 0;
        }
        return `${settledSet.size}:${h}`;
    }

    function buildGlowSettingsKey() {
        return [
            glowColorInput.value,
            glowSizeInput.value,
            glowIntensityInput.value,
            glowPowerInput.value,
            glowBorderInput.value,
            glowCornersSelect.value,
        ].join('|');
    }

    let _cachedGlowIsLowQ = false; // true if current cache was built at reduced quality

    // Glow fade-in state
    let _glowFadeStart = 0;        // performance.now() when fade began
    const GLOW_FADE_MS = 400;      // duration of the fade-in
    let _glowFadeActive = false;
    let _glowFadeFrameId = null;
    let _glowHidden = false;       // true while glow is suppressed (during playback)

    function rebuildGlowCache(settledSet, lowQuality) {
        // Create offscreen canvas on first use
        if (!_cachedGlowCanvas) {
            _cachedGlowCanvas = document.createElement('canvas');
            _cachedGlowCanvas.width  = MAP_W;
            _cachedGlowCanvas.height = MAP_H;
            _cachedGlowCtx = _cachedGlowCanvas.getContext('2d');
        }
        const gc = _cachedGlowCtx;
        gc.clearRect(0, 0, MAP_W, MAP_H);

        if (settledSet.size === 0) return;

        // ── Build edge segments and stroke helper ─────────────
        // Draw each boundary edge as an individual segment.
        // Previous polyline-chain approach dropped edges at junction
        // vertices where 3–4 edges met (e.g. diagonal unlocked chunks).
        const edges = [];
        for (const key of settledSet) {
            const [c, r] = key.split(',').map(Number);
            const x = c * CHUNK_PX, y = r * CHUNK_PX;
            if (r === 0 || !settledSet.has(chunkKey(c, r - 1)))
                edges.push(x, y, x + CHUNK_PX, y);
            if (r === ROWS - 1 || !settledSet.has(chunkKey(c, r + 1)))
                edges.push(x, y + CHUNK_PX, x + CHUNK_PX, y + CHUNK_PX);
            if (c === 0 || !settledSet.has(chunkKey(c - 1, r)))
                edges.push(x, y, x, y + CHUNK_PX);
            if (c === COLS - 1 || !settledSet.has(chunkKey(c + 1, r)))
                edges.push(x + CHUNK_PX, y, x + CHUNK_PX, y + CHUNK_PX);
        }

        function strokeEdges(target) {
            target.beginPath();
            for (let i = 0; i < edges.length; i += 4) {
                target.moveTo(edges[i], edges[i + 1]);
                target.lineTo(edges[i + 2], edges[i + 3]);
            }
            target.stroke();
        }

        // ── Read glow settings ────────────────────────────────
        const glowColor = glowColorInput.value;
        const { r: gr, g: gg, b: gb } = hexToRgb(glowColor);
        const roundCorners = glowCornersSelect.value === 'round';
        const spread    = parseFloat(glowSizeInput.value) / 100;
        const intensity = parseFloat(glowIntensityInput.value) / 100;
        const power     = parseInt(glowPowerInput.value, 10) || 3;
        const border    = parseFloat(glowBorderInput.value) / 100;
        const wr = Math.round(gr * 0.15 + 255 * 0.85);
        const wg = Math.round(gg * 0.15 + 255 * 0.85);
        const wb = Math.round(gb * 0.15 + 255 * 0.85);
        const borderW = Math.max(2, Math.round(14 * border));
        const maxBlur = Math.round(200 * spread);

        // ── Outer glow (clipped to locked chunks) ─────────────
        gc.save();
        gc.lineJoin = roundCorners ? 'round' : 'miter';
        if (!roundCorners) gc.miterLimit = 10;
        gc.lineCap  = roundCorners ? 'round' : 'butt';

        // Clip to locked chunks
        gc.beginPath();
        for (let ri = 0; ri < ROWS; ri++) {
            for (let ci = 0; ci < COLS; ci++) {
                if (!settledSet.has(chunkKey(ci, ri))) {
                    gc.rect(ci * CHUNK_PX, ri * CHUNK_PX, CHUNK_PX, CHUNK_PX);
                }
            }
        }
        gc.clip();

        // When animations are active, use reduced quality for speed.
        // Full quality rebuild happens once all animations complete.
        const lqPasses = lowQuality ? 2 : 6;
        const lqPower  = lowQuality ? 1 : power;
        _cachedGlowIsLowQ = !!lowQuality;

        // Bloom passes
        for (let i = lqPasses; i >= 1; i--) {
            const frac = i / lqPasses;
            const alpha = (0.7 * intensity * (1 - frac * 0.4));
            gc.shadowColor = `rgba(${gr},${gg},${gb},${alpha.toFixed(2)})`;
            gc.shadowBlur  = Math.round(maxBlur * frac);
            gc.lineWidth   = Math.max(2, Math.round(borderW * (1 - frac * 0.5)));
            gc.strokeStyle = `rgba(${gr},${gg},${gb},${(alpha * 0.4).toFixed(2)})`;
            for (let p = 0; p < lqPower; p++) strokeEdges(gc);
        }

        // Final crisp border
        gc.shadowColor = `rgba(${gr},${gg},${gb},${(0.9 * intensity).toFixed(2)})`;
        gc.shadowBlur  = Math.round(15 * spread);
        gc.lineWidth   = borderW;
        gc.strokeStyle = `rgba(${wr},${wg},${wb},${(0.95 * intensity).toFixed(2)})`;
        strokeEdges(gc);
        gc.restore();

        // ── Inner shadow (clipped to settled unlocked chunks) ─
        // Skip inner shadow entirely in low quality mode
        if (!lowQuality) {
            gc.save();
            gc.beginPath();
            for (const key of settledSet) {
                const [c, r] = key.split(',').map(Number);
                gc.rect(c * CHUNK_PX, r * CHUNK_PX, CHUNK_PX, CHUNK_PX);
            }
            gc.clip();

            gc.lineJoin = roundCorners ? 'round' : 'miter';
            if (!roundCorners) gc.miterLimit = 10;
            gc.lineCap  = roundCorners ? 'round' : 'butt';

            gc.shadowColor = `rgba(0,0,0,${(0.6 * intensity).toFixed(2)})`;
            gc.shadowBlur  = 25;
            gc.lineWidth   = 2;
            gc.strokeStyle = 'rgba(0,0,0,0.05)';
            strokeEdges(gc);
            strokeEdges(gc);

            gc.shadowColor = `rgba(${gr},${gg},${gb},${(0.3 * intensity).toFixed(2)})`;
            gc.shadowBlur  = 12;
            gc.lineWidth   = 1;
            gc.strokeStyle = `rgba(${gr},${gg},${gb},0.08)`;
            strokeEdges(gc);
            gc.restore();
        }
    }

    function invalidateGlowCache() {
        _cachedSettledKey = '';
        _cachedGlowSettingsKey = '';
    }

    function glowFadeLoop() {
        _glowFadeFrameId = null;
        const t = (performance.now() - _glowFadeStart) / GLOW_FADE_MS;
        if (t >= 1) {
            _glowFadeActive = false;
            drawOverlay();
            return;
        }
        drawOverlay();
        _glowFadeFrameId = requestAnimationFrame(glowFadeLoop);
    }

    function animLoop() {
        animFrameId = null;
        if (animatingChunks.size === 0) return;
        drawOverlay();
        if (animatingChunks.size > 0) {
            animFrameId = requestAnimationFrame(animLoop);
        }
    }

    function triggerUnlockAnim(key) {
        animatingChunks.set(key, { start: performance.now(), duration: ANIM_DURATION });
        if (!animFrameId) animFrameId = requestAnimationFrame(animLoop);
    }

    // Queue DOM refs
    const queueSidebar  = document.getElementById('queueSidebar');
    const queueToggleBtn = document.getElementById('queueToggleBtn');
    const queueList     = document.getElementById('queueList');
    const queuePlayBtn  = document.getElementById('queuePlayBtn');
    const queueResetBtn = document.getElementById('queueResetBtn');
    const queueClearBtn = document.getElementById('queueClearBtn');
    const queueLoopBtn  = document.getElementById('queueLoopBtn');
    const queueDelayInput = document.getElementById('queueDelay');
    const queueDelayLabel = document.getElementById('queueDelayLabel');
    let queueLoop       = false;

    let zoom          = 0.12;
    let panX          = 0;
    let panY          = 0;

    let dragging      = false;
    let dragStartX    = 0;
    let dragStartY    = 0;
    let panStartX     = 0;
    let panStartY     = 0;
    let painting      = false;   // true while shift+mouse is held
    let paintMode     = 'unlock'; // 'unlock' or 'lock' — determined on first click

    // ── helpers ────────────────────────────────────────────────
    function darknessOpacity() { return parseFloat(darknessSelect.value); }

    function hexToRgb(hex) {
        const n = parseInt(hex.replace('#', ''), 16);
        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
    }

    function chunkKey(col, row) { return `${col},${row}`; }

    // Seeded pseudo-random for deterministic pixelate order per chunk
    function seededShuffle(arr, seed) {
        let s = seed;
        function rng() { s = (s * 16807 + 0) % 2147483647; return (s - 1) / 2147483646; }
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }
    // Pre-build shuffled block indices for pixelate (4×4 = 16 blocks per chunk)
    const PIXEL_BLOCKS = 16; // 4×4 grid
    const PIXEL_COLS = 4;
    const PIXEL_ROWS = 4;
    const _pixelOrders = new Map(); // chunkKey → shuffled array of block indices
    function getPixelOrder(key) {
        if (_pixelOrders.has(key)) return _pixelOrders.get(key);
        const [c, r] = key.split(',').map(Number);
        const seed = c * 1000 + r + 42;
        const indices = Array.from({ length: PIXEL_BLOCKS }, (_, i) => i);
        seededShuffle(indices, seed);
        _pixelOrders.set(key, indices);
        return indices;
    }

    /** Convert page-space x/y → chunk col/row on the map image.
     *  When perspective is active we do a proper ray-plane intersection:
     *  the transformed map lives on z=0, so we shoot a ray from the
     *  CSS perspective camera through the screen point and find where
     *  it hits z=0, then invert the element transform to get image coords.
     */
    function pageToChunk(pageX, pageY) {
        const rect = viewport.getBoundingClientRect();
        const vx   = pageX - rect.left;
        const vy   = pageY - rect.top;

        const tiltX = parseFloat(perspTilt.value);
        const tiltY = parseFloat(perspTiltY.value);
        const rot   = parseFloat(perspRotate.value);

        let imgX, imgY;

        if (tiltX !== 0 || tiltY !== 0 || rot !== 0) {
            // Build the same transform matrix the browser applies.
            // The CSS perspective camera sits at (cx, cy, depth) looking
            // toward (cx, cy, 0).  The element transform chain is applied
            // in the local coordinate system of canvasWrap.
            const vpRect = viewport.getBoundingClientRect();
            const cx = vpRect.width / 2;
            const cy = vpRect.height / 2;
            const depth = 1800;

            // Rebuild the element transform as a DOMMatrix
            const m = new DOMMatrix()
                .translate(cx, cy, 0)
                .rotateAxisAngle(1, 0, 0, tiltX)
                .rotateAxisAngle(0, 1, 0, tiltY)
                .rotateAxisAngle(0, 0, 1, rot)
                .translate(-cx, -cy, 0)
                .translate(panX, panY, 0)
                .scale(zoom, zoom, 1);

            // Camera is at (cx, cy, depth) in viewport space.
            // Screen point (vx, vy) is on the z=0 projection plane.
            // Ray: origin = (cx, cy, depth), direction = (vx - cx, vy - cy, -depth)
            // We need to find t where the ray hits the transformed z=0 plane.

            // Transform the four corners of a z=0 plane through m to get
            // the plane normal, then intersect.  But it's simpler to invert:
            // map the ray into the element's local space via m.inverse().
            const mInv = m.inverse();

            // Transform ray origin and a point along the ray into local space
            const o = mInv.transformPoint(new DOMPoint(cx, cy, depth));
            const p = mInv.transformPoint(new DOMPoint(vx, vy, 0));

            // Ray in local space: origin o, direction (p - o)
            // We want z = 0:  o.z + t * (p.z - o.z) = 0  →  t = -o.z / (p.z - o.z)
            const dz = p.z - o.z;
            if (Math.abs(dz) < 1e-6) return null; // ray parallel to plane
            const t = -o.z / dz;
            imgX = o.x + t * (p.x - o.x);
            imgY = o.y + t * (p.y - o.y);
        } else {
            imgX = (vx - panX) / zoom;
            imgY = (vy - panY) / zoom;
        }

        const col  = Math.floor(imgX / CHUNK_PX);
        const row  = Math.floor(imgY / CHUNK_PX);
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
        return { col, row };
    }

    // ── rendering ──────────────────────────────────────────────
    function applyTransform() {
        const tiltX = parseFloat(perspTilt.value);
        const tiltY = parseFloat(perspTiltY.value);
        const rot   = parseFloat(perspRotate.value);
        const vpRect = viewport.getBoundingClientRect();
        const cx = vpRect.width / 2;
        const cy = vpRect.height / 2;

        // Fixed perspective depth — removed depth slider
        const depth = 1800;

        viewport.style.perspective = `${depth}px`;
        viewport.style.perspectiveOrigin = `${cx}px ${cy}px`;
        canvasWrap.style.transformOrigin = '0 0';
        canvasWrap.style.transform = [
            // 3. shift the rotated result back so the centre lands at screen centre
            `translate(${cx}px, ${cy}px)`,
            // 2. rotate in 3D around the origin (which is now the visible map centre)
            `rotateX(${tiltX}deg)`,
            `rotateY(${tiltY}deg)`,
            `rotateZ(${rot}deg)`,
            // 1. shift so the visible map centre sits at 0,0
            `translate(${-cx}px, ${-cy}px)`,
            // 0. normal pan + zoom
            `translate(${panX}px, ${panY}px)`,
            `scale(${zoom})`,
        ].join(' ');
        canvasWrap.style.transformStyle = 'preserve-3d';
    }

    function drawOverlay() {
        const opacity = darknessOpacity();
        ctx.clearRect(0, 0, MAP_W, MAP_H);

        // Draw darkness over every LOCKED chunk (with optional colour tint)
        // Animating chunks use the selected animation style to reveal
        const { r: dr, g: dg, b: db } = hexToRgb(darknessColorInput.value);
        const now = performance.now();
        const animStyle = animStyleSelect.value; // 'grow' | 'fade' | 'wipe' | 'spiral'
        ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${opacity})`;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const key = chunkKey(c, r);
                if (!unlocked.has(key)) {
                    ctx.fillRect(c * CHUNK_PX, r * CHUNK_PX, CHUNK_PX, CHUNK_PX);
                } else if (animatingChunks.has(key)) {
                    const anim = animatingChunks.get(key);
                    const progress = Math.min(1, (now - anim.start) / anim.duration);
                    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                    const chunkX = c * CHUNK_PX;
                    const chunkY = r * CHUNK_PX;

                    if (ease < 1) {
                        if (animStyle === 'grow') {
                            // Grow from center: darkness shrinks from edges
                            const cx = chunkX + CHUNK_PX / 2;
                            const cy = chunkY + CHUNK_PX / 2;
                            const halfW = (CHUNK_PX / 2) * ease;
                            const halfH = (CHUNK_PX / 2) * ease;
                            ctx.fillRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            ctx.clearRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
                        } else if (animStyle === 'fade') {
                            // Fade: darkness opacity decreases
                            const fadeAlpha = opacity * (1 - ease);
                            ctx.save();
                            ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${fadeAlpha.toFixed(3)})`;
                            ctx.fillRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            ctx.restore();
                            // Restore original fillStyle for subsequent locked chunks
                            ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${opacity})`;
                        } else if (animStyle === 'wipe') {
                            // Wipe down: darkness sweeps away top to bottom
                            const revealH = CHUNK_PX * ease;
                            // Top portion is clear (revealed), bottom is still dark
                            ctx.fillRect(chunkX, chunkY + revealH, CHUNK_PX, CHUNK_PX - revealH);
                        } else if (animStyle === 'radar') {
                            // Radar sweep: rotating wedge reveals chunk
                            // Uses linear progress (not ease-out) for steady rotation
                            const cx = chunkX + CHUNK_PX / 2;
                            const cy = chunkY + CHUNK_PX / 2;
                            const maxR = Math.sqrt(2) * CHUNK_PX / 2 + 2;
                            const sweepAngle = Math.PI * 2 * progress;
                            ctx.fillRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(cx, cy);
                            const startA = -Math.PI / 2;
                            const arcSteps = Math.max(16, Math.floor(sweepAngle * 10));
                            for (let s = 0; s <= arcSteps; s++) {
                                const a = startA + sweepAngle * (s / arcSteps);
                                ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
                            }
                            ctx.closePath();
                            ctx.clip();
                            ctx.clearRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            ctx.restore();
                        } else if (animStyle === 'diamond') {
                            // Diamond iris: grows larger than chunk so sides clip into a border
                            const cx = chunkX + CHUNK_PX / 2;
                            const cy = chunkY + CHUNK_PX / 2;
                            // At ease=1, halfD=CHUNK_PX fully encloses the chunk
                            const halfD = CHUNK_PX * ease;
                            ctx.fillRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(cx, cy - halfD);
                            ctx.lineTo(cx + halfD, cy);
                            ctx.lineTo(cx, cy + halfD);
                            ctx.lineTo(cx - halfD, cy);
                            ctx.closePath();
                            ctx.clip();
                            ctx.clearRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            ctx.restore();
                        } else if (animStyle === 'pixelate') {
                            // Pixelate: random blocks reveal progressively
                            const order = getPixelOrder(key);
                            const blocksRevealed = Math.floor(ease * PIXEL_BLOCKS);
                            const blockW = CHUNK_PX / PIXEL_COLS;
                            const blockH = CHUNK_PX / PIXEL_ROWS;
                            // Fill entire chunk dark
                            ctx.fillRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                            // Clear revealed blocks
                            for (let b = 0; b < blocksRevealed; b++) {
                                const idx = order[b];
                                const bc = idx % PIXEL_COLS;
                                const br = Math.floor(idx / PIXEL_COLS);
                                ctx.clearRect(chunkX + bc * blockW, chunkY + br * blockH, blockW, blockH);
                            }
                            // Partially fade the next block
                            if (blocksRevealed < PIXEL_BLOCKS) {
                                const partialEase = (ease * PIXEL_BLOCKS) - blocksRevealed;
                                const idx = order[blocksRevealed];
                                const bc = idx % PIXEL_COLS;
                                const br = Math.floor(idx / PIXEL_COLS);
                                const bx = chunkX + bc * blockW;
                                const by = chunkY + br * blockH;
                                ctx.clearRect(bx, by, blockW, blockH);
                                ctx.save();
                                ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${(opacity * (1 - partialEase)).toFixed(3)})`;
                                ctx.fillRect(bx, by, blockW, blockH);
                                ctx.restore();
                                ctx.fillStyle = `rgba(${dr}, ${dg}, ${db}, ${opacity})`;
                            }
                        }
                    }
                    if (progress >= 1) animatingChunks.delete(key);
                }
            }
        }

        // Draw glow borders for animating chunks + settled chunks during playback
        if (glowToggle.value === 'on') {
            const glowColor = glowColorInput.value;
            const { r: agr, g: agg, b: agb } = hexToRgb(glowColor);
            const awr = Math.round(agr * 0.15 + 255 * 0.85);
            const awg = Math.round(agg * 0.15 + 255 * 0.85);
            const awb = Math.round(agb * 0.15 + 255 * 0.85);
            const intensity = parseFloat(glowIntensityInput.value) / 100;
            const borderVal = parseFloat(glowBorderInput.value) / 100;
            const borderW = Math.max(2, Math.round(14 * borderVal));
            const roundCorners = glowCornersSelect.value === 'round';
            const spread = parseFloat(glowSizeInput.value) / 100;

            // During fade-out, reduce per-chunk border alpha as settled glow fades in
            let borderAlphaMul = 1;
            if (_glowFadeActive) {
                const t = Math.min(1, (performance.now() - _glowFadeStart) / GLOW_FADE_MS);
                borderAlphaMul = 1 - t * (2 - t); // inverse of the ease-out fade-in
            }

            // Collect which chunks need a per-chunk border:
            //   - actively animating chunks (use their animation progress)
            //   - settled unlocked chunks during playback (draw at full, ease=1)
            const borderChunks = [];
            for (const [key, anim] of animatingChunks) {
                const progress = Math.min(1, (now - anim.start) / anim.duration);
                borderChunks.push({ key, progress, ease: 1 - Math.pow(1 - progress, 3) });
            }
            if (_glowHidden || _glowFadeActive) {
                for (const key of unlocked) {
                    if (!animatingChunks.has(key)) {
                        borderChunks.push({ key, progress: 1, ease: 1 });
                    }
                }
            }

            for (const { key, progress, ease } of borderChunks) {
                if (ease < 0.01) continue;
                const [col, row] = key.split(',').map(Number);
                const chunkX = col * CHUNK_PX;
                const chunkY = row * CHUNK_PX;
                const cx = chunkX + CHUNK_PX / 2;
                const cy = chunkY + CHUNK_PX / 2;
                // Settled chunks during fade use reducing alpha
                const isSettled = progress >= 1;
                const alpha = isSettled ? borderAlphaMul : 1;

                ctx.save();
                if (alpha < 1) ctx.globalAlpha = alpha;
                ctx.lineJoin = roundCorners ? 'round' : 'miter';
                ctx.lineCap  = roundCorners ? 'round' : 'butt';
                ctx.lineWidth = borderW;

                // Settled chunks always draw a simple full border
                if (isSettled) {
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread);
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity).toFixed(2)})`;
                    ctx.strokeRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                } else if (animStyle === 'grow') {
                    const halfW = (CHUNK_PX / 2) * ease;
                    const halfH = (CHUNK_PX / 2) * ease;
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity * ease).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread * ease);
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity).toFixed(2)})`;
                    ctx.strokeRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
                } else if (animStyle === 'fade') {
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity * ease).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread * ease);
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity * ease).toFixed(2)})`;
                    ctx.strokeRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                } else if (animStyle === 'wipe') {
                    const revealH = CHUNK_PX * ease;
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity * ease).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread * ease);
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity).toFixed(2)})`;
                    ctx.beginPath();
                    ctx.moveTo(chunkX, chunkY);
                    ctx.lineTo(chunkX + CHUNK_PX, chunkY);
                    ctx.lineTo(chunkX + CHUNK_PX, chunkY + revealH);
                    ctx.moveTo(chunkX, chunkY);
                    ctx.lineTo(chunkX, chunkY + revealH);
                    ctx.stroke();
                } else if (animStyle === 'radar') {
                    const maxR = Math.sqrt(2) * CHUNK_PX / 2 + 2;
                    const sweepAngle = Math.PI * 2 * progress;
                    const endA = -Math.PI / 2 + sweepAngle;
                    ctx.beginPath();
                    ctx.rect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                    ctx.clip();
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity * Math.min(1, progress * 2)).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread * Math.min(1, progress * 2));
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity).toFixed(2)})`;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy);
                    ctx.lineTo(cx + Math.cos(endA) * maxR, cy + Math.sin(endA) * maxR);
                    ctx.stroke();
                } else if (animStyle === 'diamond') {
                    const halfD = CHUNK_PX * ease;
                    ctx.beginPath();
                    ctx.rect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                    ctx.clip();
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity * ease).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread * ease);
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity).toFixed(2)})`;
                    ctx.beginPath();
                    ctx.moveTo(cx, cy - halfD);
                    ctx.lineTo(cx + halfD, cy);
                    ctx.lineTo(cx, cy + halfD);
                    ctx.lineTo(cx - halfD, cy);
                    ctx.closePath();
                    ctx.stroke();
                } else if (animStyle === 'pixelate') {
                    ctx.shadowColor = `rgba(${agr},${agg},${agb},${(0.8 * intensity * ease).toFixed(2)})`;
                    ctx.shadowBlur  = Math.round(60 * spread * ease);
                    ctx.strokeStyle = `rgba(${awr},${awg},${awb},${(0.9 * intensity * ease).toFixed(2)})`;
                    ctx.strokeRect(chunkX, chunkY, CHUNK_PX, CHUNK_PX);
                }
                ctx.restore();
            }
        }

        // ── Cached glow (outer bloom + inner shadow) ────────────
        // The expensive shadowBlur passes are rendered to an offscreen canvas
        // only when the settled set or glow settings actually change.
        // During animation frames we just composite the cached image.
        const settledUnlocked = new Set();
        for (const key of unlocked) {
            if (!animatingChunks.has(key)) settledUnlocked.add(key);
        }

        if (glowToggle.value === 'on' && settledUnlocked.size > 0 && !_glowHidden) {
            const settledKey = buildSettledKey(settledUnlocked);
            const glowSettingsKey = buildGlowSettingsKey();
            if (settledKey !== _cachedSettledKey || glowSettingsKey !== _cachedGlowSettingsKey) {
                _cachedSettledKey = settledKey;
                _cachedGlowSettingsKey = glowSettingsKey;
                rebuildGlowCache(settledUnlocked, false);
            }
            if (_glowFadeActive) {
                const t = Math.min(1, (performance.now() - _glowFadeStart) / GLOW_FADE_MS);
                const ease = t * (2 - t); // ease-out quadratic
                ctx.save();
                ctx.globalAlpha = ease;
                ctx.drawImage(_cachedGlowCanvas, 0, 0);
                ctx.restore();
            } else {
                ctx.drawImage(_cachedGlowCanvas, 0, 0);
            }
        }

        updateCounter();
        drawMinimap();
        drawSkulls();
    }

    function drawSkulls() {
        skullCtx.clearRect(0, 0, MAP_W, MAP_H);
        if (markersReady < totalMarkers) return;

        const skullSz = parseInt(skullSizeSelect.value, 10) || SKULL_SIZE_DEFAULT;
        const pos = skullPosSelect.value;
        const pad = 6;

        for (const [key, type] of markers) {
            const [c, r] = key.split(',').map(Number);
            const chunkX = c * CHUNK_PX;
            const chunkY = r * CHUNK_PX;
            const img = markerImgs[type];
            if (!img) continue;

            // Anchor point (centre of icon) based on position setting
            let anchorX, anchorY;
            switch (pos) {
                case 'top-left':
                    anchorX = chunkX + SKULL_SIZE_DEFAULT / 2 + pad;
                    anchorY = chunkY + SKULL_SIZE_DEFAULT / 2 + pad;
                    break;
                case 'top-right':
                    anchorX = chunkX + CHUNK_PX - SKULL_SIZE_DEFAULT / 2 - pad;
                    anchorY = chunkY + SKULL_SIZE_DEFAULT / 2 + pad;
                    break;
                case 'bottom-left':
                    anchorX = chunkX + SKULL_SIZE_DEFAULT / 2 + pad;
                    anchorY = chunkY + CHUNK_PX - SKULL_SIZE_DEFAULT / 2 - pad;
                    break;
                case 'bottom-right':
                    anchorX = chunkX + CHUNK_PX - SKULL_SIZE_DEFAULT / 2 - pad;
                    anchorY = chunkY + CHUNK_PX - SKULL_SIZE_DEFAULT / 2 - pad;
                    break;
                case 'center':
                    anchorX = chunkX + CHUNK_PX / 2;
                    anchorY = chunkY + CHUNK_PX / 2;
                    break;
                default:
                    anchorX = chunkX + CHUNK_PX - SKULL_SIZE_DEFAULT / 2 - pad;
                    anchorY = chunkY + SKULL_SIZE_DEFAULT / 2 + pad;
            }
            // Scale to fit within skullSz box while preserving aspect ratio
            const natW = img.naturalWidth || img.width;
            const natH = img.naturalHeight || img.height;
            const scale = Math.min(skullSz / natW, skullSz / natH);
            const drawW = Math.round(natW * scale);
            const drawH = Math.round(natH * scale);
            const x = anchorX - drawW / 2;
            const y = anchorY - drawH / 2;

            // Blurred drop shadow
            skullCtx.save();
            skullCtx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            skullCtx.shadowBlur  = 10;
            skullCtx.shadowOffsetX = 3;
            skullCtx.shadowOffsetY = 3;
            skullCtx.imageSmoothingEnabled = false;
            skullCtx.drawImage(img, x, y, drawW, drawH);
            skullCtx.restore();

            // Crisp icon on top (no shadow, no smoothing)
            skullCtx.save();
            skullCtx.imageSmoothingEnabled = false;
            skullCtx.drawImage(img, x, y, drawW, drawH);
            skullCtx.restore();
        }
    }

    function drawGrid() {
        gridCtx.clearRect(0, 0, MAP_W, MAP_H);
        if (gridToggle.value !== 'on') return;

        const { r, g, b } = hexToRgb(gridColorInput.value);
        const opacity = parseFloat(gridOpacitySelect.value);
        gridCtx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
        gridCtx.lineWidth = 1;
        gridCtx.beginPath();
        for (let x = 0; x <= MAP_W; x += CHUNK_PX) {
            gridCtx.moveTo(x + 0.5, 0);
            gridCtx.lineTo(x + 0.5, MAP_H);
        }
        for (let y = 0; y <= MAP_H; y += CHUNK_PX) {
            gridCtx.moveTo(0, y + 0.5);
            gridCtx.lineTo(MAP_W, y + 0.5);
        }
        gridCtx.stroke();
    }

    function updateCounter() {
        chunkCounter.textContent = `${unlocked.size} / ${TOTAL} chunks unlocked`;
    }

    // ── minimap ────────────────────────────────────────────────
    function drawMinimap() {
        const mmCtx = minimapEl.getContext('2d');
        const mmW   = minimapEl.width;
        const mmH   = minimapEl.height;
        mmCtx.clearRect(0, 0, mmW, mmH);
        mmCtx.drawImage(mapImg, 0, 0, mmW, mmH);

        // darken locked chunks on minimap
        const sx = mmW / MAP_W;
        const sy = mmH / MAP_H;
        const opacity = darknessOpacity();
        const { r: mdr, g: mdg, b: mdb } = hexToRgb(darknessColorInput.value);
        mmCtx.fillStyle = `rgba(${mdr}, ${mdg}, ${mdb}, ${opacity})`;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (!unlocked.has(chunkKey(c, r))) {
                    mmCtx.fillRect(c * CHUNK_PX * sx, r * CHUNK_PX * sy, CHUNK_PX * sx, CHUNK_PX * sy);
                }
            }
        }

        // draw marker dots on minimap
        const markerColors = { skull: '#ffffff', redskull: '#ff4444', lock: '#ffaa00' };
        for (const [key, type] of markers) {
            const [c, r] = key.split(',').map(Number);
            const cx = (c + 0.75) * CHUNK_PX * sx;
            const cy = (r + 0.25) * CHUNK_PX * sy;
            mmCtx.fillStyle = markerColors[type] || '#ff4444';
            mmCtx.beginPath();
            mmCtx.arc(cx, cy, 2, 0, Math.PI * 2);
            mmCtx.fill();
        }

        // viewport indicator
        const vpRect = viewport.getBoundingClientRect();
        const vw = vpRect.width;
        const vh = vpRect.height;
        const left   = (-panX / zoom) * sx;
        const top    = (-panY / zoom) * sy;
        const width  = (vw / zoom) * sx;
        const height = (vh / zoom) * sy;
        minimapVP.style.left   = `${left}px`;
        minimapVP.style.top    = `${top}px`;
        minimapVP.style.width  = `${width}px`;
        minimapVP.style.height = `${height}px`;
    }

    // ── toggle a chunk unlock ──────────────────────────────────
    function toggleChunk(pageX, pageY) {
        const c = pageToChunk(pageX, pageY);
        if (!c) return;
        const key = chunkKey(c.col, c.row);

        if (paintMode === 'unlock') {
            if (!unlocked.has(key)) {
                unlocked.add(key);
                triggerUnlockAnim(key);
            }
        } else {
            unlocked.delete(key);
            animatingChunks.delete(key);
            drawOverlay();
        }
    }

    // ── toggle skull on a chunk ────────────────────────────────
    function toggleMarker(pageX, pageY) {
        const c = pageToChunk(pageX, pageY);
        if (!c) return;
        const key = chunkKey(c.col, c.row);

        const current = markers.get(key);
        if (!current) {
            // No marker → first in cycle
            markers.set(key, MARKER_TYPES[0]);
        } else {
            const idx = MARKER_TYPES.indexOf(current);
            if (idx < MARKER_TYPES.length - 1) {
                // Advance to next marker
                markers.set(key, MARKER_TYPES[idx + 1]);
            } else {
                // Last marker → remove
                markers.delete(key);
            }
        }
        drawSkulls();
        saveState();
    }

    // ── zoom ───────────────────────────────────────────────────
    function handleWheel(e) {
        e.preventDefault();
        const rect  = viewport.getBoundingClientRect();
        const mx    = e.clientX - rect.left;
        const my    = e.clientY - rect.top;
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.min(4, Math.max(0.04, zoom * factor));

        panX = mx - (mx - panX) * (newZoom / zoom);
        panY = my - (my - panY) * (newZoom / zoom);
        zoom = newZoom;

        applyTransform();
        drawMinimap();
        saveState();
    }

    // ── pan / draw events ──────────────────────────────────────
    function onPointerDown(e) {
        if (e.button !== 0) return;

        // Ctrl+click (or Cmd+click on Mac) → toggle skull
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleMarker(e.clientX, e.clientY);
            return;
        }

        if (e.shiftKey) {
            // Shift+click → unlock/lock chunks
            painting = true;
            viewport.classList.add('drawing');

            // Determine paint mode from first chunk clicked:
            // if it's locked → unlock mode; if already unlocked → lock mode
            const c = pageToChunk(e.clientX, e.clientY);
            if (c) {
                const key = chunkKey(c.col, c.row);
                paintMode = unlocked.has(key) ? 'lock' : 'unlock';
            } else {
                paintMode = 'unlock';
            }

            toggleChunk(e.clientX, e.clientY);
        } else {
            // Default: pan
            dragging   = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            panStartX  = panX;
            panStartY  = panY;
            viewport.classList.remove('drawing');
        }
    }

    function onPointerMove(e) {
        // tooltip
        const c = pageToChunk(e.clientX, e.clientY);
        if (c) {
            const key = chunkKey(c.col, c.row);
            hoveredKey = key;
            const lockStatus = unlocked.has(key) ? 'Unlocked' : 'Locked';
            const markerType = markers.get(key);
            const markerLabel = markerType ? ` [${markerType === 'redskull' ? 'Red Skull' : markerType.charAt(0).toUpperCase() + markerType.slice(1)}]` : '';
            const queueIdx = chunkQueue.indexOf(key);
            const queueLabel = queueIdx >= 0 ? ` #${queueIdx + 1}` : '';
            tooltip.style.display = 'block';
            tooltip.style.left    = `${e.clientX + 14}px`;
            tooltip.style.top     = `${e.clientY + 14}px`;
            tooltip.textContent   = `Chunk (${c.col}, ${c.row}) — ${lockStatus}${markerLabel}${queueLabel}`;
        } else {
            hoveredKey = null;
            tooltip.style.display = 'none';
        }

        if (dragging) {
            panX = panStartX + (e.clientX - dragStartX);
            panY = panStartY + (e.clientY - dragStartY);
            applyTransform();
            drawMinimap();
        }

        if (painting) {
            toggleChunk(e.clientX, e.clientY);
        }
    }

    function onPointerUp() {
        if (dragging) saveState();   // persist view after every pan
        dragging = false;
        painting = false;
        viewport.classList.remove('drawing');
    }

    // ── keyboard shortcuts ─────────────────────────────────────
    function onKeyDown(e) {
        if (e.key === 'g') {
            gridToggle.value = gridToggle.value === 'on' ? 'off' : 'on';
            drawGrid();
        }

        // 1: add hovered chunk to queue
        if (hoveredKey && e.key === '1' && !playbackTimer) {
            // Don't add duplicates
            if (!chunkQueue.includes(hoveredKey)) {
                chunkQueue.push(hoveredKey);
                renderQueue();
                saveState();
            }
        }

        // Delete/Backspace: remove hovered chunk from queue
        if (hoveredKey && (e.key === 'Delete' || e.key === 'Backspace') && !playbackTimer) {
            const idx = chunkQueue.indexOf(hoveredKey);
            if (idx >= 0) {
                chunkQueue.splice(idx, 1);
                renderQueue();
                saveState();
            }
        }
    }

    // ── queue sidebar ─────────────────────────────────────────
    function renderQueue() {
        queueList.innerHTML = '';
        for (let i = 0; i < chunkQueue.length; i++) {
            const key = chunkQueue[i];
            const [c, r] = key.split(',');
            const li = document.createElement('li');
            li.dataset.idx = i;

            const label = document.createElement('span');
            label.textContent = `(${c}, ${r})`;
            li.appendChild(label);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'queue-remove';
            removeBtn.textContent = '×';
            removeBtn.addEventListener('click', () => {
                if (playbackTimer) return;
                chunkQueue.splice(i, 1);
                renderQueue();
                saveState();
            });
            li.appendChild(removeBtn);

            queueList.appendChild(li);
        }
    }

    function startPlayback() {
        if (chunkQueue.length === 0) return;
        if (playbackTimer) { stopPlayback(); return; }

        // Lock all chunks first
        unlocked.clear();
        drawOverlay();

        playbackActive = true;
        _glowHidden = true;
        _glowFadeActive = false;
        if (_glowFadeFrameId) { cancelAnimationFrame(_glowFadeFrameId); _glowFadeFrameId = null; }
        queuePlayBtn.textContent = '⏹ Stop';
        queuePlayBtn.classList.add('active');

        let step = 0;
        const delay = parseInt(queueDelayInput.value, 10) || 500;

        function tick() {
            if (step >= chunkQueue.length) {
                if (queueLoop) {
                    // Re-lock everything and restart
                    step = 0;
                    unlocked.clear();
                    drawOverlay();
                } else {
                    stopPlayback();
                    return;
                }
            }
            // Highlight current item in sidebar
            const items = queueList.querySelectorAll('li');
            items.forEach((li, i) => li.classList.toggle('active', i === step));

            // Unlock this chunk with animation
            const chunkKey = chunkQueue[step];
            unlocked.add(chunkKey);
            triggerUnlockAnim(chunkKey);
            saveState();
            step++;
            playbackTimer = setTimeout(tick, delay);
        }

        tick();
    }

    function stopPlayback() {
        if (playbackTimer) { clearTimeout(playbackTimer); playbackTimer = null; }
        playbackActive = false;
        queuePlayBtn.textContent = '▶ Play';
        queuePlayBtn.classList.remove('active');
        // Start the glow fade-in (from hidden → visible)
        if (_glowHidden) {
            invalidateGlowCache();
            _glowFadeStart = performance.now();
            _glowFadeActive = true;
            _glowHidden = false;
            if (!_glowFadeFrameId) _glowFadeFrameId = requestAnimationFrame(glowFadeLoop);
        }
    }

    // ── export ─────────────────────────────────────────────────
    function doExport(fullMap) {
        const expCanvas = document.createElement('canvas');

        if (fullMap) {
            expCanvas.width  = MAP_W;
            expCanvas.height = MAP_H;
            const ectx = expCanvas.getContext('2d');
            ectx.drawImage(mapImg, 0, 0);
            ectx.drawImage(overlay, 0, 0);
        } else {
            const vpRect = viewport.getBoundingClientRect();
            const vw = vpRect.width;
            const vh = vpRect.height;
            expCanvas.width  = vw;
            expCanvas.height = vh;
            const ectx = expCanvas.getContext('2d');

            ectx.save();
            ectx.translate(panX, panY);
            ectx.scale(zoom, zoom);
            ectx.drawImage(mapImg, 0, 0);
            ectx.drawImage(overlay, 0, 0);
            ectx.restore();
        }

        expCanvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href     = url;
            a.download = 'chunkmap_export.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');

        saveOverlay.classList.remove('open');
    }

    // ── local-storage persistence ──────────────────────────────
    const STORAGE_KEY = 'skelspanels_chunkmap';

    function saveState() {
        try {
            const data = {
                unlocked: [...unlocked],
                markers: Object.fromEntries(markers),
                queue: [...chunkQueue],
                view: { panX, panY, zoom },
                settings: {
                    darknessOpacity: darknessSelect.value,
                    darknessColor: darknessColorInput.value,
                    gridToggle: gridToggle.value,
                    gridColor: gridColorInput.value,
                    gridOpacity: gridOpacitySelect.value,
                    glowToggle: glowToggle.value,
                    glowColor: glowColorInput.value,
                    glowSize: glowSizeInput.value,
                    glowIntensity: glowIntensityInput.value,
                    glowPower: glowPowerInput.value,
                    glowBorder: glowBorderInput.value,
                    glowCorners: glowCornersSelect.value,
                    perspTilt: perspTilt.value,
                    perspTiltY: perspTiltY.value,
                    perspRotate: perspRotate.value,
                    skullSize: skullSizeSelect.value,
                    skullPosition: skullPosSelect.value,
                    animStyle: animStyleSelect.value,
                    queueDelay: queueDelayInput.value,
                },
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (_) {}
    }

    let savedView = null;  // loaded before init sets defaults

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);

            // Support both old format (plain array) and new format (object)
            if (Array.isArray(data)) {
                for (const key of data) unlocked.add(key);
            } else {
                if (data.unlocked) for (const key of data.unlocked) unlocked.add(key);
                // Load markers (new format: object) or migrate old skulls (array)
                if (data.markers) {
                    for (const [key, type] of Object.entries(data.markers)) markers.set(key, type);
                } else if (data.skulls) {
                    for (const key of data.skulls) markers.set(key, 'skull');
                }
                if (data.view)     savedView = data.view;
                if (data.queue) { chunkQueue.length = 0; chunkQueue.push(...data.queue); }

                // Restore all toolbar settings
                if (data.settings) {
                    const s = data.settings;
                    if (s.darknessOpacity) darknessSelect.value = s.darknessOpacity;
                    if (s.darknessColor)   darknessColorInput.value = s.darknessColor;
                    if (s.gridToggle)      gridToggle.value = s.gridToggle;
                    if (s.gridColor)       gridColorInput.value = s.gridColor;
                    if (s.gridOpacity)     gridOpacitySelect.value = s.gridOpacity;
                    if (s.glowToggle)      glowToggle.value = s.glowToggle;
                    if (s.glowColor)       glowColorInput.value = s.glowColor;
                    if (s.glowSize)        glowSizeInput.value = s.glowSize;
                    if (s.glowIntensity)   glowIntensityInput.value = s.glowIntensity;
                    if (s.glowPower)       glowPowerInput.value = s.glowPower;
                    if (s.glowBorder)      glowBorderInput.value = s.glowBorder;
                    if (s.glowCorners)     glowCornersSelect.value = s.glowCorners;
                    if (s.perspTilt)       perspTilt.value = s.perspTilt;
                    if (s.perspTiltY)      perspTiltY.value = s.perspTiltY;
                    if (s.perspRotate)     perspRotate.value = s.perspRotate;
                    if (s.skullSize)       skullSizeSelect.value = s.skullSize;
                    if (s.skullPosition)   skullPosSelect.value = s.skullPosition;
                    if (s.animStyle)       animStyleSelect.value = s.animStyle;
                    if (s.queueDelay) {
                        queueDelayInput.value = s.queueDelay;
                        queueDelayLabel.textContent = `${s.queueDelay}ms`;
                    }
                }
            }
        } catch (_) {}
    }

    // auto-save every 2 s + on page leave
    setInterval(saveState, 2000);
    window.addEventListener('beforeunload', saveState);

    // ── init ───────────────────────────────────────────────────
    function init() {
        overlay.width     = MAP_W;
        overlay.height    = MAP_H;
        gridCanvas.width  = MAP_W;
        gridCanvas.height = MAP_H;
        skullCanvas.width  = MAP_W;
        skullCanvas.height = MAP_H;

        // minimap proportional sizing
        const mmW = 200;
        const mmH = Math.round(mmW * (MAP_H / MAP_W));
        minimapEl.width  = mmW;
        minimapEl.height = mmH;

        loadState();

        // Restore saved view or centre the map in the viewport
        if (savedView && savedView.zoom) {
            panX = savedView.panX;
            panY = savedView.panY;
            zoom = savedView.zoom;
        } else {
            const vpRect = viewport.getBoundingClientRect();
            zoom = Math.min(vpRect.width / MAP_W, vpRect.height / MAP_H) * 0.95;
            panX = (vpRect.width  - MAP_W  * zoom) / 2;
            panY = (vpRect.height - MAP_H * zoom) / 2;
        }

        applyTransform();
        drawOverlay();
        drawGrid();

        // events
        viewport.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        viewport.addEventListener('wheel', handleWheel, { passive: false });
        window.addEventListener('keydown', onKeyDown);

        // prevent default context menu on ctrl+click (some browsers)
        viewport.addEventListener('contextmenu', (e) => e.preventDefault());

        gridToggle.addEventListener('change', () => { drawGrid(); saveState(); });
        gridColorInput.addEventListener('input', () => { drawGrid(); saveState(); });
        gridOpacitySelect.addEventListener('change', () => { drawGrid(); saveState(); });
        darknessSelect.addEventListener('change', () => { drawOverlay(); saveState(); });
        darknessColorInput.addEventListener('input', () => { drawOverlay(); drawMinimap(); saveState(); });
        glowToggle.addEventListener('change', () => { drawOverlay(); saveState(); });
        glowColorInput.addEventListener('input', () => { drawOverlay(); saveState(); });
        glowSizeInput.addEventListener('input', () => { drawOverlay(); saveState(); });
        glowIntensityInput.addEventListener('input', () => { drawOverlay(); saveState(); });
        glowPowerInput.addEventListener('input', () => { drawOverlay(); saveState(); });
        glowBorderInput.addEventListener('input', () => { drawOverlay(); saveState(); });
        glowCornersSelect.addEventListener('change', () => { drawOverlay(); saveState(); });
        skullSizeSelect.addEventListener('change', () => { drawOverlay(); saveState(); });
        skullPosSelect.addEventListener('change', () => { drawSkulls(); saveState(); });
        animStyleSelect.addEventListener('change', () => { saveState(); });

        // Perspective controls
        const perspControls = [perspTilt, perspTiltY, perspRotate];
        for (const el of perspControls) {
            el.addEventListener('input', () => { applyTransform(); saveState(); });
        }

        clearBtn.addEventListener('click', () => {
            if (!confirm('Lock all chunks? This will re-darken everything.')) return;
            unlocked.clear();
            drawOverlay();
            saveState();
        });

        unlockAllBtn.addEventListener('click', () => {
            for (let r = 0; r < ROWS; r++) {
                for (let c = 0; c < COLS; c++) {
                    unlocked.add(chunkKey(c, r));
                }
            }
            drawOverlay();
            saveState();
        });

        saveBtn.addEventListener('click', () => saveOverlay.classList.add('open'));
        cancelExport.addEventListener('click', () => saveOverlay.classList.remove('open'));
        exportFull.addEventListener('click', () => doExport(true));
        exportView.addEventListener('click', () => doExport(false));

        // touch: two-finger pan handled natively; single long-press could toggle
        viewport.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                onPointerDown({ button: 0, clientX: t.clientX, clientY: t.clientY, shiftKey: false, ctrlKey: false, metaKey: false });
            }
        }, { passive: false });
        viewport.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const t = e.touches[0];
                onPointerMove({ clientX: t.clientX, clientY: t.clientY });
            }
        }, { passive: false });
        viewport.addEventListener('touchend', onPointerUp);

        // Queue sidebar
        // Prevent sidebar interactions from dragging the map
        queueSidebar.addEventListener('pointerdown', (e) => e.stopPropagation());
        queueSidebar.addEventListener('wheel', (e) => e.stopPropagation(), { passive: false });

        queueToggleBtn.addEventListener('click', () => {
            queueSidebar.classList.toggle('collapsed');
        });
        queuePlayBtn.addEventListener('click', startPlayback);
        queueLoopBtn.addEventListener('click', () => {
            queueLoop = !queueLoop;
            queueLoopBtn.classList.toggle('active', queueLoop);
        });
        queueResetBtn.addEventListener('click', () => {
            if (playbackTimer) stopPlayback();
            // Re-lock all queued chunks so they're ready to animate from scratch
            for (const key of chunkQueue) {
                unlocked.delete(key);
                animatingChunks.delete(key);
            }
            drawOverlay();
            saveState();
        });
        queueClearBtn.addEventListener('click', () => {
            if (playbackTimer) stopPlayback();
            chunkQueue.length = 0;
            renderQueue();
            saveState();
        });
        queueDelayInput.addEventListener('input', () => {
            queueDelayLabel.textContent = `${queueDelayInput.value}ms`;
        });

        renderQueue();
    }

    // wait for the map image to load
    if (mapImg.complete) {
        init();
    } else {
        mapImg.addEventListener('load', init);
    }
})();
