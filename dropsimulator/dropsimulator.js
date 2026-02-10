// Loot Calculator - OSRS Expected Drop Calculator
// Fetches drop tables from the OSRS Wiki and calculates expected loot for a given kill count.
// Uses rendered HTML parsing so all wiki templates (HerbDropLines, GemDropTable, etc.) are expanded.

document.addEventListener('DOMContentLoaded', init);

// State
let dropTables = {};  // { "version_name": [{ name, quantity, rate, imageUrl }, ...] }
let monsterName = '';

function init() {
    document.getElementById('fetchBtn').addEventListener('click', fetchDrops);
    document.getElementById('monsterInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchDrops();
    });
    document.getElementById('dropVersion').addEventListener('change', updatePanel);
    document.getElementById('killCount').addEventListener('input', updatePanel);
    document.getElementById('scale').addEventListener('input', updatePanel);
    document.getElementById('panelWidth').addEventListener('input', updatePanel);
    document.getElementById('frameType').addEventListener('change', updatePanel);
    document.getElementById('saveButton').addEventListener('click', savePanelAsImage);

    updateFrameType();
    updatePanel();

    // Auto-fetch if monster input has a default value
    if (document.getElementById('monsterInput').value.trim()) {
        fetchDrops();
    }
}

// ──────────────────────────────────
// Input parsing
// ──────────────────────────────────

function parseMonsterInput(input) {
    input = input.trim();
    if (input.includes('oldschool.runescape.wiki/w/')) {
        const match = input.match(/oldschool\.runescape\.wiki\/w\/([^#?]+)/);
        if (match) {
            return decodeURIComponent(match[1]).replace(/_/g, ' ');
        }
    }
    return input;
}

// ──────────────────────────────────
// Wiki API fetch
// ──────────────────────────────────

async function fetchDrops() {
    const input = document.getElementById('monsterInput').value;
    const name = parseMonsterInput(input);

    if (!name) {
        showStatus('Please enter a monster name or wiki URL', 'error');
        return;
    }

    const fetchBtn = document.getElementById('fetchBtn');
    fetchBtn.disabled = true;
    showStatus('Fetching drop tables...', 'loading');

    try {
        const pageName = name.replace(/ /g, '_');

        // Fetch rendered HTML — all templates (HerbDropLines, GemDropTable, etc.) are expanded
        const apiUrl = `https://oldschool.runescape.wiki/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text|displaytitle&format=json&origin=*`;

        const response = await fetch(apiUrl);
        const data = await response.json();

        if (data.error) {
            showStatus(`Page "${name}" not found on the OSRS Wiki`, 'error');
            fetchBtn.disabled = false;
            return;
        }

        // Extract clean monster name from displaytitle (may contain HTML)
        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = data.parse.displaytitle || name;
        monsterName = titleDiv.textContent.trim();

        const html = data.parse.text['*'];
        dropTables = parseRenderedHtml(html);

        const versions = Object.keys(dropTables);
        if (versions.length === 0) {
            showStatus('No drop tables found on this page', 'error');
            fetchBtn.disabled = false;
            return;
        }

        // Populate version selector
        const select = document.getElementById('dropVersion');
        select.innerHTML = '';
        versions.forEach(v => {
            const option = document.createElement('option');
            option.value = v;
            option.textContent = v;
            select.appendChild(option);
        });

        showStatus('', '');
        updatePanel();

    } catch (error) {
        console.error('Fetch error:', error);
        showStatus('Error fetching data: ' + error.message, 'error');
    }

    fetchBtn.disabled = false;
}

function showStatus(message, type) {
    const status = document.getElementById('statusMessage');
    status.textContent = message;
    status.className = `status-message ${type}`;
}

// ──────────────────────────────────
// Rendered HTML parsing
// ──────────────────────────────────

function parseRenderedHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Group drop tables by their parent h2 section heading.
    // e.g. Black dragon has <h2>Drops</h2> and <h2>Wilderness Slayer Cave drops</h2>
    const elements = doc.querySelectorAll('h2, table.item-drops');

    const sections = new Map(); // heading → drops[], preserves insertion order
    let currentHeading = 'Drops';

    for (const el of elements) {
        if (el.tagName === 'H2') {
            // Get clean heading text (from .mw-headline span if present, to avoid [edit] link text)
            const headline = el.querySelector('.mw-headline');
            currentHeading = (headline ? headline.textContent : el.textContent).trim();
        } else if (el.classList.contains('item-drops')) {
            const drops = parseDropTable(el);
            if (drops.length > 0) {
                if (sections.has(currentHeading)) {
                    sections.get(currentHeading).push(...drops);
                } else {
                    sections.set(currentHeading, [...drops]);
                }
            }
        }
    }

    // Build the final tables object
    const tables = {};

    if (sections.size <= 1) {
        // Single section — label it "Regular"
        const drops = sections.size === 1 ? [...sections.values()][0] : [];
        if (drops.length > 0) {
            tables['Regular'] = drops;
        }
    } else {
        // Multiple sections — use heading text as version names
        for (const [heading, drops] of sections.entries()) {
            tables[heading] = drops;
        }
    }

    return tables;
}

function parseDropTable(table) {
    const drops = [];
    const rows = table.querySelectorAll('tr');

    for (const row of rows) {
        const cells = row.querySelectorAll('td');
        if (cells.length < 4) continue; // Skip header rows

        // Item name — from the cell with class "item-col"
        const itemCell = row.querySelector('td.item-col');
        if (!itemCell) continue;

        const nameLink = itemCell.querySelector('a');
        const name = nameLink
            ? nameLink.textContent.trim()
            : itemCell.textContent.trim();

        if (!name || name.toLowerCase() === 'nothing' || name.toLowerCase() === 'empty') continue;

        // Item image URL — from the inventory-image cell
        let imageUrl = '';
        const imgEl = row.querySelector('td.inventory-image img');
        if (imgEl) {
            const src = imgEl.getAttribute('src') || '';
            imageUrl = src.startsWith('http') ? src : `https://oldschool.runescape.wiki${src}`;
        }

        // Quantity — the cell right after item-col
        let quantityCell = itemCell.nextElementSibling;
        // If we accidentally landed on a special cell, fall back to 3rd td
        if (!quantityCell || quantityCell.classList.contains('ge-column') || quantityCell.classList.contains('alch-column')) {
            quantityCell = cells[2];
        }
        const quantityStr = quantityCell ? quantityCell.textContent.trim() : '1';
        const quantity = parseQuantity(quantityStr);

        // Rarity — look for span with data-drop-fraction, or parse text
        let rate = null;
        const fractionSpan = row.querySelector('span[data-drop-fraction]');
        if (fractionSpan) {
            rate = parseRarity(fractionSpan.getAttribute('data-drop-fraction'));
        }
        if (rate === null) {
            // Fall back to text in the rarity cell (handles "Always")
            const rarityCell = quantityCell ? quantityCell.nextElementSibling : cells[3];
            if (rarityCell) {
                rate = parseRarity(rarityCell.textContent.trim());
            }
        }

        if (rate === null || isNaN(quantity) || quantity <= 0) continue;

        drops.push({ name, quantity, rate, imageUrl });
    }

    return drops;
}

// ──────────────────────────────────
// Quantity & rarity parsing
// ──────────────────────────────────

function parseQuantity(str) {
    // Remove parenthetical notes like (noted), (unnoted)
    str = str.replace(/\(.*?\)/g, '').trim();
    // Normalize en-dashes / em-dashes to hyphens
    str = str.replace(/[\u2013\u2014\u2012]/g, '-');
    // Remove wiki markup like [[links]]
    str = str.replace(/\[{2,}[^\]]*\]{2,}/g, '').trim();

    if (str.includes('-')) {
        const parts = str.split('-').map(s => parseFloat(s.replace(/,/g, '').trim()));
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return (parts[0] + parts[1]) / 2;
        }
    }

    if (str.includes(';')) {
        const parts = str.split(';').map(s => parseFloat(s.replace(/,/g, '').trim())).filter(n => !isNaN(n));
        if (parts.length > 0) {
            return parts.reduce((a, b) => a + b, 0) / parts.length;
        }
    }

    const num = parseFloat(str.replace(/,/g, '').trim());
    return isNaN(num) ? 1 : num;
}

function parseRarity(str) {
    str = str.trim();

    if (str.toLowerCase() === 'always') return 1;

    // Handle fractions like "4/128", "1/11.1", "1/10,000"
    const fracMatch = str.match(/(\d[\d,]*(?:\.\d+)?)\s*\/\s*(\d[\d,]*(?:\.\d+)?)/);
    if (fracMatch) {
        const num = parseFloat(fracMatch[1].replace(/,/g, ''));
        const den = parseFloat(fracMatch[2].replace(/,/g, ''));
        if (den !== 0) return num / den;
    }

    return null;
}

// ──────────────────────────────────
// Expected value calculation
// ──────────────────────────────────

function calculateExpectedLoot(drops, kills) {
    const lootMap = new Map();

    drops.forEach((drop, index) => {
        const existing = lootMap.get(drop.name);
        if (existing) {
            existing.expectedPerKill += drop.quantity * drop.rate;
        } else {
            lootMap.set(drop.name, {
                name: drop.name,
                expectedPerKill: drop.quantity * drop.rate,
                imageUrl: drop.imageUrl,
                order: index
            });
        }
    });

    return Array.from(lootMap.values())
        .sort((a, b) => a.order - b.order)
        .map(item => ({
            name: item.name,
            expected: item.expectedPerKill * kills,
            imageUrl: item.imageUrl
        }));
}

// ──────────────────────────────────
// Display formatting
// ──────────────────────────────────

function formatQuantity(n) {
    if (n === 0) return '0';

    if (Number.isInteger(n) || n >= 100) {
        return Math.round(n).toLocaleString();
    }

    if (n >= 10) {
        return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }

    if (n >= 1) {
        return n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
    }

    if (n >= 0.01) {
        return n.toFixed(2);
    }

    if (n >= 0.001) {
        return n.toFixed(3);
    }

    return n.toFixed(4);
}

function getQuantityColor(n) {
    if (n >= 10000000) return '#00FF80'; // Green for 10M+
    if (n >= 100000) return '#FFFFFF';   // White for 100K+
    return '#FFFF00';                     // Yellow default
}

// ──────────────────────────────────
// Panel rendering
// ──────────────────────────────────

function updatePanel() {
    const panel = document.getElementById('panel');
    const content = document.getElementById('panelContent');
    const scale = parseInt(document.getElementById('scale').value) || 3;
    const kills = parseInt(document.getElementById('killCount').value) || 0;
    const version = document.getElementById('dropVersion').value;

    updateFrameType();

    const borderSize = 32;
    const naturalWidth = parseInt(document.getElementById('panelWidth').value) || 400;

    // If no drops loaded, show placeholder
    if (Object.keys(dropTables).length === 0 || !version || !dropTables[version]) {
        content.innerHTML = `
            <div class="shadow-overlay"></div>
            <div class="loot-header">
                <div class="monster-title">Loot Calculator</div>
                <div class="kill-subtitle">Enter a monster name to begin</div>
            </div>
        `;

        const naturalHeight = 200;
        applyPanelDimensions(panel, content, naturalWidth, naturalHeight, borderSize, scale);
        return;
    }

    // Calculate expected loot
    const drops = dropTables[version];
    const loot = calculateExpectedLoot(drops, kills);

    // Build panel HTML
    const versionLabel = (version === 'Drops' || version === 'Regular') ? 'Regular Drops' : version;

    let html = `
        <div class="shadow-overlay"></div>
        <div class="loot-header">
            <div class="monster-title">${escapeHtml(monsterName)}</div>
            <div class="version-subtitle">${escapeHtml(versionLabel)}</div>
            <div class="kill-subtitle">Expected Loot - ${kills.toLocaleString()} KC</div>
        </div>
        <div class="loot-divider"></div>
        <div class="loot-list">
    `;

    loot.forEach(item => {
        const imgUrl = item.imageUrl || '';
        const qty = formatQuantity(item.expected);
        const qtyColor = getQuantityColor(item.expected);

        html += `
            <div class="loot-row">
                <img class="loot-icon" src="${escapeHtml(imgUrl)}" crossorigin="anonymous" onerror="this.style.visibility='hidden'" alt="${escapeHtml(item.name)}">
                <span class="loot-name">${escapeHtml(item.name)}</span>
                <span class="loot-qty" style="color: ${qtyColor}">x ${qty}</span>
            </div>
        `;
    });

    html += '</div>';
    content.innerHTML = html;

    // Calculate dynamic height
    const headerHeight = 64;
    const dividerHeight = 6;
    const rowHeight = 24;
    const paddingY = 16;
    const contentHeight = paddingY + headerHeight + dividerHeight + (loot.length * rowHeight) + 4;
    const naturalHeight = contentHeight + borderSize * 2;

    applyPanelDimensions(panel, content, naturalWidth, naturalHeight, borderSize, scale);
}

function applyPanelDimensions(panel, content, naturalWidth, naturalHeight, borderSize, scale) {
    panel.style.width = naturalWidth + 'px';
    panel.style.height = naturalHeight + 'px';
    panel.style.transform = `scale(${scale})`;
    panel.style.transformOrigin = 'top left';
    panel.style.marginBottom = ((naturalHeight * scale) - naturalHeight) + 'px';
    panel.style.marginRight = ((naturalWidth * scale) - naturalWidth) + 'px';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ──────────────────────────────────
// Frame border handling
// ──────────────────────────────────

function updateFrameType() {
    const frameType = document.getElementById('frameType').value;
    const path = `/resources/frames/${frameType}`;

    const panel = document.getElementById('panel');
    panel.querySelector('.corner.tl').style.backgroundImage = `url('${path}/tl.png')`;
    panel.querySelector('.corner.tr').style.backgroundImage = `url('${path}/tr.png')`;
    panel.querySelector('.corner.bl').style.backgroundImage = `url('${path}/bl.png')`;
    panel.querySelector('.corner.br').style.backgroundImage = `url('${path}/br.png')`;
    panel.querySelector('.edge.top').style.backgroundImage = `url('${path}/t.png')`;
    panel.querySelector('.edge.bottom').style.backgroundImage = `url('${path}/b.png')`;
    panel.querySelector('.edge.left').style.backgroundImage = `url('${path}/l.png')`;
    panel.querySelector('.edge.right').style.backgroundImage = `url('${path}/r.png')`;

    const corners = panel.querySelectorAll('.corner');
    corners.forEach(c => {
        c.style.width = '32px';
        c.style.height = '32px';
    });

    const edgeTop = panel.querySelector('.edge.top');
    const edgeBottom = panel.querySelector('.edge.bottom');
    edgeTop.style.backgroundSize = 'auto 100%';
    edgeBottom.style.backgroundSize = 'auto 100%';

    const edgeLeft = panel.querySelector('.edge.left');
    const edgeRight = panel.querySelector('.edge.right');
    edgeLeft.style.backgroundSize = '100% auto';
    edgeRight.style.backgroundSize = '100% auto';
}

// ──────────────────────────────────
// Save panel as PNG
// ──────────────────────────────────

function savePanelAsImage() {
    const panel = document.getElementById('panel');
    const scale = parseInt(document.getElementById('scale').value) || 3;

    const naturalWidth = parseInt(panel.style.width);
    const naturalHeight = parseInt(panel.style.height);

    const targetWidth = naturalWidth * scale;
    const targetHeight = naturalHeight * scale;

    domtoimage.toPng(panel, {
        width: targetWidth,
        height: targetHeight,
        cacheBust: true,
        imagePlaceholder: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        style: {
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            width: naturalWidth + 'px',
            height: naturalHeight + 'px',
            margin: '0',
        }
    }).then(function (dataUrl) {
        const link = document.createElement('a');
        link.download = `${monsterName || 'loot'}-expected-loot.png`;
        link.href = dataUrl;
        link.click();
    }).catch(function (error) {
        console.error('Error saving image:', error);
        alert('Error saving image. You may need to try a different browser or disable ad blockers.');
    });
}
