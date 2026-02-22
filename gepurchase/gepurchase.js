async function inlineImgElements(element) {
    const imgs = element.querySelectorAll('img');
    const promises = [];

    imgs.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('data:')) {
            const promise = fetch(src)
                .then(res => res.blob())
                .then(blob => new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        img.src = reader.result;
                        resolve();
                    };
                    reader.readAsDataURL(blob);
                }))
                .catch(err => console.warn('Could not inline img src:', src, err));
            promises.push(promise);
        }
    });

    await Promise.all(promises);
}

async function inlineBackgroundImages(element) {
    const elements = element.querySelectorAll('*');
    const promises = [];

    elements.forEach(el => {
        const style = getComputedStyle(el);
        const bg = style.getPropertyValue('background-image');
        const match = /url\("(.*?)"\)/.exec(bg);
        if (match && match[1] && !match[1].startsWith('data:')) {
            const url = match[1];
            const promise = fetch(url)
                .then(res => res.blob())
                .then(blob => new Promise(resolve => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        el.style.backgroundImage = `url('${reader.result}')`;
                        resolve();
                    };
                    reader.readAsDataURL(blob);
                }))
                .catch(err => console.warn('Could not inline background image:', url, err));
            promises.push(promise);
        }
    });

    await Promise.all(promises);
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Control references ---
    const itemIconUrlInput = document.getElementById('item-icon-url');
    const showIconCheckbox = document.getElementById('show-icon');

    // text-3 = top "Buy/Sell" header
    const text3Input = document.getElementById('text-3');
    const text3ColorInput = document.getElementById('text-3-color');

    // text-1 = item name (middle, beside the icon)
    const text1Input = document.getElementById('text-1');
    const text1ColorInput = document.getElementById('text-1-color');

    // text-2 = bottom price/status
    const text2Input = document.getElementById('text-2');
    const text2ColorInput = document.getElementById('text-2-color');

    const fontSizeInput = document.getElementById('font-size');

    const saveImageBtn = document.getElementById('save-image-btn');

    // --- Panel element references ---
    const panel = document.getElementById('gepurchase-panel');
    const bgPanel = panel.querySelector('.ui-panel[data-panel-id="bg-main"]');
    const itemIcon = document.getElementById('panel-item-icon');
    const text3El = document.getElementById('panel-text-3');
    const text1El = document.getElementById('panel-text-1');
    const text2El = document.getElementById('panel-text-2');

    // --- Fixed scale ---
    const scale = 3;

    // --- Base dimensions from the provided HTML structure ---
    // The panel is 115x110 at 1x scale
    const BASE_WIDTH = 115;
    const BASE_HEIGHT = 110;

    // Base positions for the item icon (inside the recessed square on the left)
    const BASE_ICON_LEFT = 7;
    const BASE_ICON_TOP = 35;
    const BASE_ICON_WIDTH = 30;

    // Base positions for text elements (from the provided HTML)
    // text-3: top header "Buy" — centered horizontally around midpoint
    const BASE_TEXT_3_CENTER = 58;
    const BASE_TEXT_3_TOP = 4;
    // text-1: item name "Lobster" — positioned right of icon, vertically mid
    const BASE_TEXT_1 = { left: 46, top: 34 };
    // text-2: price "150 coins" — centered horizontally around midpoint
    const BASE_TEXT_2_CENTER = 58;
    const BASE_TEXT_2_TOP = 92;

    // --- Core render function ---
    function renderPanel() {
        const showIcon = showIconCheckbox.checked;
        const iconUrl = itemIconUrlInput.value.trim();
        const baseFontSize = parseInt(fontSizeInput.value, 10) || 16;

        const w = BASE_WIDTH * scale;
        const h = BASE_HEIGHT * scale;

        // Panel container
        panel.style.width = `${w}px`;
        panel.style.height = `${h}px`;

        // Background — always shown
        bgPanel.style.width = `${w}px`;
        bgPanel.style.height = `${h}px`;
        bgPanel.style.backgroundImage = "url('background.png')";
        bgPanel.style.display = 'block';

        // Item icon
        if (showIcon && iconUrl) {
            itemIcon.src = iconUrl;
            itemIcon.style.display = 'block';
            itemIcon.style.left = `${BASE_ICON_LEFT * scale}px`;
            itemIcon.style.top = `${BASE_ICON_TOP * scale}px`;
            itemIcon.style.width = `${BASE_ICON_WIDTH * scale}px`;
            itemIcon.style.height = 'auto';
            const iconShadowOffset = 1 * scale;
            itemIcon.style.filter = `drop-shadow(${iconShadowOffset}px ${iconShadowOffset}px 0 rgb(51, 51, 51, 1))`;
        } else {
            itemIcon.style.display = 'none';
        }

        // Scaled font sizes and shadow
        const scaledMidFontSize = baseFontSize * scale;
        const scaledFixedFontSize = 16 * scale;
        const shadowSize = 1 * scale;
        const textShadow = `${shadowSize}px ${shadowSize}px 0 #000`;

        // text-3: "Buy" header at top — uses RuneScape Bold 12 font, fixed size, centered
        text3El.textContent = text3Input.value;
        text3El.style.fontFamily = "'RuneScape Bold 12', sans-serif";
        text3El.style.fontSize = `${scaledFixedFontSize}px`;
        text3El.style.color = text3ColorInput.value;
        text3El.style.left = `${BASE_TEXT_3_CENTER * scale}px`;
        text3El.style.top = `${BASE_TEXT_3_TOP * scale}px`;
        text3El.style.transform = 'translateX(-50%)';
        text3El.style.textAlign = 'center';
        text3El.style.maxWidth = `${(BASE_WIDTH - 4) * scale}px`;
        text3El.style.textShadow = textShadow;
        text3El.style.display = text3Input.value.trim() ? 'block' : 'none';

        // text-1: item name beside icon — user-adjustable font size, supports \n
        text1El.textContent = '';
        const text1Lines = text1Input.value.split('\\n');
        text1Lines.forEach((line, i) => {
            if (i > 0) text1El.appendChild(document.createElement('br'));
            text1El.appendChild(document.createTextNode(line));
        });
        text1El.style.fontSize = `${scaledMidFontSize}px`;
        text1El.style.whiteSpace = 'nowrap';
        text1El.style.color = text1ColorInput.value;
        text1El.style.left = `${BASE_TEXT_1.left * scale}px`;
        text1El.style.top = `${BASE_TEXT_1.top * scale}px`;
        text1El.style.maxWidth = `${(BASE_WIDTH - BASE_TEXT_1.left - 2) * scale}px`;
        text1El.style.textShadow = textShadow;
        text1El.style.display = text1Input.value.trim() ? 'block' : 'none';

        // text-2: price at bottom — fixed size, centered around midpoint
        text2El.textContent = text2Input.value;
        text2El.style.fontSize = `${scaledFixedFontSize}px`;
        text2El.style.color = text2ColorInput.value;
        text2El.style.left = `${BASE_TEXT_2_CENTER * scale}px`;
        text2El.style.top = `${BASE_TEXT_2_TOP * scale}px`;
        text2El.style.transform = 'translateX(-50%)';
        text2El.style.textAlign = 'center';
        text2El.style.maxWidth = `${(BASE_WIDTH - 4) * scale}px`;
        text2El.style.textShadow = textShadow;
        text2El.style.display = text2Input.value.trim() ? 'block' : 'none';
    }

    // --- Initial render ---
    renderPanel();

    // --- Event listeners ---
    const allInputs = [
        itemIconUrlInput, showIconCheckbox,
        text3Input, text3ColorInput,
        text1Input, text1ColorInput,
        text2Input, text2ColorInput,
        fontSizeInput
    ];

    allInputs.forEach(input => {
        input.addEventListener('input', renderPanel);
        input.addEventListener('change', renderPanel);
    });

    // --- Save as image ---
    saveImageBtn.addEventListener('click', async () => {
        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            await inlineBackgroundImages(panel);
            await inlineImgElements(panel);

            await document.fonts.ready;
            await new Promise(r => requestAnimationFrame(r));

            const captureWidth = BASE_WIDTH * scale;
            const captureHeight = BASE_HEIGHT * scale;

            const dataUrl = await domtoimage.toPng(panel, {
                width: captureWidth,
                height: captureHeight,
                bgcolor: 'transparent',
                style: {
                    'background-color': 'transparent',
                    'image-rendering': 'pixelated',
                    'overflow': 'visible'
                }
            });

            const link = document.createElement('a');
            const itemName = text1Input.value.trim().replace(/\s+/g, '_') || 'ge-purchase';
            link.download = `ge-purchase-${itemName}-${scale}x.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error generating image. Check the console for details.');
        } finally {
            saveImageBtn.disabled = false;
            saveImageBtn.textContent = 'Save Panel as Image';
        }
    });
});
