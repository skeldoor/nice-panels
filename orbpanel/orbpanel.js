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

// Map orb types to their asset filenames
const ORB_CONFIG = {
    health:     { orb: 'healthorb.png',    icon: 'healthicon.png',    iconScale: 100 },
    prayeron:   { orb: 'prayerorbon.png',  icon: 'prayericonon.png',  iconScale: 100 },
    prayeroff:  { orb: 'prayerorboff.png', icon: 'prayericonoff.png', iconScale: 100 },
    runon:      { orb: 'runorbon.png',     icon: 'runiconon.png',     iconScale: 100 },
    runoff:     { orb: 'runorboff.png',    icon: 'runiconoff.png',    iconScale: 100 },
    poison:     { orb: 'poisonorb.png',    icon: 'healthicon.png',    iconScale: 100 },
    venom:      { orb: 'venomorb.png',     icon: 'healthicon.png',    iconScale: 100 },
    skull:      { orb: 'healthorb.png',    icon: 'skull.png',         iconScale: 75 }
};

/**
 * Compute a colour that smoothly transitions:
 *   0   → red   (255, 0, 0)
 *   50  → yellow (255, 255, 0)
 *   100 → green  (0, 255, 0)
 */
function valueToColor(value) {
    const v = Math.max(0, Math.min(100, value));
    let r, g;
    if (v <= 50) {
        // red → yellow
        r = 255;
        g = Math.round((v / 50) * 255);
    } else {
        // yellow → green
        r = Math.round(((100 - v) / 50) * 255);
        g = 255;
    }
    return `rgb(${r}, ${g}, 0)`;
}

/**
 * Colorise the runorboff.png (greyscale orb) with a given hex colour.
 * Loads the base image, draws it to a canvas, then multiplies each pixel
 * by the chosen colour so the shading is preserved.
 * Returns a data-URL for the tinted orb.
 */
function coloriseOrb(hexColor) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;

            // Parse hex colour
            const cr = parseInt(hexColor.slice(1, 3), 16) / 255;
            const cg = parseInt(hexColor.slice(3, 5), 16) / 255;
            const cb = parseInt(hexColor.slice(5, 7), 16) / 255;

            // Multiply blend: preserves shading of the greyscale orb
            for (let i = 0; i < data.length; i += 4) {
                data[i]     = Math.round(data[i]     * cr); // R
                data[i + 1] = Math.round(data[i + 1] * cg); // G
                data[i + 2] = Math.round(data[i + 2] * cb); // B
                // Alpha unchanged
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve('icons/runorboff.png');
        img.src = 'icons/runorboff.png';
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const orbSelect      = document.getElementById('orb-select');
    const valueInput     = document.getElementById('orb-value');
    const fillInput      = document.getElementById('orb-fill');
    const iconScaleInput = document.getElementById('icon-scale');
    const saveImageBtn   = document.getElementById('save-image-btn');
    const customIconUrl  = document.getElementById('custom-icon-url');
    const orbColorInput  = document.getElementById('orb-color');
    const customControls = document.querySelectorAll('.custom-only');

    const orbPanel     = document.getElementById('orb-panel');
    const orbCircle    = orbPanel.querySelector('.orb-circle');
    const orbCircleContainer = orbPanel.querySelector('.orb-circle-container');
    const orbIconImg   = orbPanel.querySelector('.orb-icon img');
    const orbValueEl   = orbPanel.querySelector('.orb-value');

    const FIXED_SCALE = 5;

    // Cache for the last colorised orb to avoid re-rendering every frame
    let lastOrbColor = null;
    let lastOrbDataUrl = null;

    function toggleCustomControls() {
        const isCustom = orbSelect.value === 'custom';
        customControls.forEach(el => {
            el.style.display = isCustom ? 'flex' : 'none';
        });
    }

    async function renderPanel() {
        const type  = orbSelect.value;
        const value = parseInt(valueInput.value, 10) || 0;
        const fill  = parseInt(fillInput.value, 10) || 0;
        const iconScale = Math.max(1, Math.min(200, parseInt(iconScaleInput.value, 10) || 100));

        if (type === 'custom') {
            // Custom orb: colorised runorboff + user-provided icon URL
            const color = orbColorInput.value;
            if (color !== lastOrbColor) {
                lastOrbDataUrl = await coloriseOrb(color);
                lastOrbColor = color;
            }
            orbCircle.src = lastOrbDataUrl;
            orbIconImg.src = customIconUrl.value || 'icons/healthicon.png';
        } else {
            const cfg = ORB_CONFIG[type];
            orbCircle.src   = 'icons/' + cfg.orb;
            orbIconImg.src  = 'icons/' + cfg.icon;
        }

        // Apply icon scale
        const scaleFactor = iconScale / 100;
        orbIconImg.style.transform = `scale(${scaleFactor})`;

        // Update value text and colour
        orbValueEl.textContent = Math.max(0, Math.min(100, value));
        orbValueEl.style.color = valueToColor(value);

        // Fill: clip the orb from the top.
        // fill=100 → fully visible (clip top = 0)
        // fill=0   → fully hidden  (clip top = 26px, the orb height)
        const clampedFill = Math.max(0, Math.min(100, fill));
        const clipTop = Math.round(26 * (1 - clampedFill / 100));
        orbCircleContainer.style.clipPath = `inset(${clipTop}px 0 0 0)`;

        // Apply preview scale
        orbPanel.style.transform = `scale(${FIXED_SCALE})`;
        orbPanel.style.transformOrigin = 'top center';
    }

    // Initial render
    toggleCustomControls();
    renderPanel();

    // Event listeners
    orbSelect.addEventListener('change', () => {
        toggleCustomControls();
        lastOrbColor = null; // reset cache on type change
        // Set icon scale to the config default for this type
        const type = orbSelect.value;
        if (type === 'custom') {
            iconScaleInput.value = 60;
        } else if (ORB_CONFIG[type]) {
            iconScaleInput.value = ORB_CONFIG[type].iconScale;
        }
        renderPanel();
    });
    valueInput.addEventListener('input', renderPanel);
    fillInput.addEventListener('input', renderPanel);
    iconScaleInput.addEventListener('input', renderPanel);
    customIconUrl.addEventListener('input', renderPanel);
    orbColorInput.addEventListener('input', () => {
        lastOrbColor = null; // invalidate cache so it re-colorises
        renderPanel();
    });

    // Save as image
    saveImageBtn.addEventListener('click', async () => {
        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            const scale = FIXED_SCALE;
            const type  = orbSelect.value;
            const value = valueInput.value;

            // Clone panel for export at 1x, then scale via dom-to-image
            const clone = orbPanel.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.transform = 'none';
            document.body.appendChild(clone);

            try {
                await inlineBackgroundImages(clone);
                await inlineImgElements(clone);

                await document.fonts.ready;
                await new Promise(r => requestAnimationFrame(r));

                const naturalWidth  = clone.offsetWidth;
                const naturalHeight = clone.offsetHeight;
                const targetWidth   = naturalWidth  * scale;
                const targetHeight  = naturalHeight * scale;

                const dataUrl = await domtoimage.toPng(clone, {
                    cacheBust: true,
                    width: targetWidth,
                    height: targetHeight,
                    style: {
                        'transform': `scale(${scale})`,
                        'transform-origin': 'top left',
                        'image-rendering': 'pixelated'
                    }
                });

                document.body.removeChild(clone);

                const link = document.createElement('a');
                link.download = `${type}-orb-${value}-${scale}x.png`;
                link.href = dataUrl;
                link.click();
            } catch (error) {
                console.error('Error capturing panel:', error);
                if (clone.parentNode) document.body.removeChild(clone);
            }
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error generating image. Check the console for details.');
        } finally {
            saveImageBtn.disabled = false;
            saveImageBtn.textContent = 'Save Panel as Image';
        }
    });
});
