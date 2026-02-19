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

/**
 * Capture a panel layer as an Image.
 * hideSelectors: array of CSS selectors to hide via visibility:hidden before capture.
 */
async function capturePanelLayer(logPanel, scale, hideSelectors) {
    const clone = logPanel.cloneNode(true);
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.transform = 'none';
    document.body.appendChild(clone);

    // Resolve translateX(-50%) into explicit left
    const panelWidth = clone.offsetWidth;
    clone.querySelectorAll('.collection-log-text').forEach(el => {
        const textWidth = el.offsetWidth;
        el.style.left = ((panelWidth - textWidth) / 2) + 'px';
        el.style.transform = 'none';
    });

    // Hide requested elements
    if (hideSelectors) {
        hideSelectors.forEach(sel => {
            clone.querySelectorAll(sel).forEach(el => {
                el.style.visibility = 'hidden';
            });
        });
    }

    await inlineBackgroundImages(clone);
    await inlineImgElements(clone);
    await document.fonts.ready;
    await new Promise(r => requestAnimationFrame(r));

    const naturalWidth = clone.offsetWidth;
    const naturalHeight = clone.offsetHeight;
    const targetWidth = naturalWidth * scale;
    const targetHeight = naturalHeight * scale;

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

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = dataUrl;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const textTopInput = document.getElementById('text-top');
    const textMidInput = document.getElementById('text-mid');
    const textBottomInput = document.getElementById('text-bottom');
    const colorTopInput = document.getElementById('color-top');
    const colorMidInput = document.getElementById('color-mid');
    const colorBottomInput = document.getElementById('color-bottom');
    const FIXED_SCALE = 3;
    const saveImageBtn = document.getElementById('save-image-btn');
    const saveGifBtn = document.getElementById('save-gif-btn');
    const logPanel = document.getElementById('collection-log-panel');
    const textTopEl = logPanel.querySelector('.collection-log-text-top');
    const textMidEl = logPanel.querySelector('.collection-log-text-mid');
    const textBottomEl = logPanel.querySelector('.collection-log-text-bottom');

    function renderPanel() {
        textTopEl.textContent = textTopInput.value;
        textMidEl.textContent = textMidInput.value;
        textBottomEl.textContent = textBottomInput.value;

        textTopEl.style.color = colorTopInput.value;
        textMidEl.style.color = colorMidInput.value;
        textBottomEl.style.color = colorBottomInput.value;

        logPanel.style.transform = `scale(${FIXED_SCALE})`;
        logPanel.style.transformOrigin = 'top center';
    }

    // Initial render
    renderPanel();

    // Event listeners
    textTopInput.addEventListener('input', renderPanel);
    textMidInput.addEventListener('input', renderPanel);
    textBottomInput.addEventListener('input', renderPanel);
    colorTopInput.addEventListener('input', renderPanel);
    colorMidInput.addEventListener('input', renderPanel);
    colorBottomInput.addEventListener('input', renderPanel);

    // Save as image (uses full panel capture)
    saveImageBtn.addEventListener('click', async () => {
        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            const scale = FIXED_SCALE;
            const img = await capturePanelLayer(logPanel, scale, null);

            const link = document.createElement('a');
            const safeText = (textMidInput.value || 'collection-log').replace(/[^a-zA-Z0-9-_]/g, '_');
            link.download = `collection-log-${safeText}-${scale}x.png`;
            link.href = img.src;
            link.click();
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error generating image. Check the console for details.');
        } finally {
            saveImageBtn.disabled = false;
            saveImageBtn.textContent = 'Save Panel as Image';
        }
    });

    // Save as animated GIF
    saveGifBtn.addEventListener('click', async () => {
        saveGifBtn.disabled = true;
        saveGifBtn.textContent = 'Capturing layers...';

        try {
            const scale = FIXED_SCALE;

            // Capture three separate layers:
            // 1. Background + edges only (scales with animation)
            const bgImg = await capturePanelLayer(logPanel, scale, [
                '.collection-log-text-top',
                '.collection-log-text-mid',
                '.collection-log-text-bottom'
            ]);
            // 2. Top text only (moves from center to final position)
            const topTextImg = await capturePanelLayer(logPanel, scale, [
                '.collection-log-bg',
                '.collection-log-edges',
                '.collection-log-text-mid',
                '.collection-log-text-bottom'
            ]);
            // 3. Middle + bottom text only (revealed in place, behind edges)
            const staticTextImg = await capturePanelLayer(logPanel, scale, [
                '.collection-log-bg',
                '.collection-log-edges',
                '.collection-log-text-top'
            ]);

            const imgW = bgImg.width;
            const imgH = bgImg.height;

            // Top text native Y position (10px in panel coords * scale)
            const topTextNativeY = 10 * scale;

            // Animation config at 50fps
            const FRAME_DELAY = 20;       // ms per frame (50fps)
            const X_SCALE_FRAMES = 50;    // frames for scaleX 0→1  (1s)
            const Y_SCALE_FRAMES = 50;    // frames for scaleY 0.01→1  (1s)
            const HOLD_FRAMES = 250;      // frames to hold  (5s)
            // open (1+1) + hold (5) + close (1+1) = 9s total
            const totalFrames = X_SCALE_FRAMES + Y_SCALE_FRAMES + HOLD_FRAMES + Y_SCALE_FRAMES + X_SCALE_FRAMES;

            saveGifBtn.textContent = 'Encoding GIF... please wait';

            // Use magenta as the transparency key (not present in the panel)
            const TRANSPARENT_COLOR = 0xFF00FF;

            const gif = new GIF({
                workers: 2,
                quality: 1,
                width: imgW,
                height: imgH,
                workerScript: 'gif.worker.js',
                transparent: TRANSPARENT_COLOR
            });

            const canvas = document.createElement('canvas');
            canvas.width = imgW;
            canvas.height = imgH;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = false;

            for (let i = 0; i < totalFrames; i++) {
                // Fill with the transparency key colour
                ctx.fillStyle = '#FF00FF';
                ctx.fillRect(0, 0, imgW, imgH);

                let sx, sy;

                const openEnd = X_SCALE_FRAMES + Y_SCALE_FRAMES;
                const holdEnd = openEnd + HOLD_FRAMES;
                const closeYEnd = holdEnd + Y_SCALE_FRAMES;

                if (i < X_SCALE_FRAMES) {
                    sx = (i + 1) / X_SCALE_FRAMES;
                    sy = 0.01;
                } else if (i < openEnd) {
                    sx = 1;
                    const yProgress = (i - X_SCALE_FRAMES + 1) / Y_SCALE_FRAMES;
                    sy = 0.01 + (1 - 0.01) * yProgress;
                } else if (i < holdEnd) {
                    sx = 1;
                    sy = 1;
                } else if (i < closeYEnd) {
                    sx = 1;
                    const yProgress = (i - holdEnd + 1) / Y_SCALE_FRAMES;
                    sy = 1 - (1 - 0.01) * yProgress;
                } else {
                    const xProgress = (i - closeYEnd + 1) / X_SCALE_FRAMES;
                    sx = 1 - xProgress;
                    sy = 0.01;
                }

                // Clip rect expands from center
                const originY = imgH * 0.5;
                const clipW = imgW * sx;
                const clipH = imgH * sy;
                const clipX = (imgW - clipW) / 2;
                const clipY = originY - (clipH * 0.5);

                // Calculate open/close progress for top text movement (0 = origin, 1 = final)
                let moveProgress;

                if (i < openEnd) {
                    // Opening: move from origin to final over both X and Y phases
                    moveProgress = (i + 1) / openEnd;
                } else if (i < holdEnd) {
                    // Hold: fully at final position
                    moveProgress = 1;
                } else if (i < totalFrames) {
                    // Closing: move from final back to origin
                    moveProgress = 1 - ((i - holdEnd + 1) / (totalFrames - holdEnd));
                } else {
                    moveProgress = 0;
                }

                // Top text Y: interpolate from origin to native position
                const topTextY = originY + (topTextNativeY - originY) * moveProgress;

                ctx.save();
                ctx.beginPath();
                ctx.rect(clipX, clipY, clipW, clipH);
                ctx.clip();

                // Layer 1: Background + edges — drawn SCALED
                const drawW = imgW * sx;
                const drawH = imgH * sy;
                const drawX = (imgW - drawW) / 2;
                const drawY = originY - (drawH * 0.5);
                ctx.drawImage(bgImg, drawX, drawY, drawW, drawH);

                // Layer 2: Middle + bottom text — clipped to inner area of edges border
                const borderInset = 10 * scale;
                const innerX = clipX + borderInset;
                const innerY = clipY + borderInset;
                const innerW = clipW - (borderInset * 2);
                const innerH = clipH - (borderInset * 2);

                if (innerW > 0 && innerH > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(innerX, innerY, innerW, innerH);
                    ctx.clip();
                    ctx.drawImage(staticTextImg, 0, 0, imgW, imgH);
                    ctx.restore();
                }

                // Layer 3: Top text — native size, offset Y to slide from origin to final position
                // Also inner-clipped so edges border covers it
                if (innerW > 0 && innerH > 0) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(innerX, innerY, innerW, innerH);
                    ctx.clip();
                    const topTextOffsetY = topTextY - topTextNativeY;
                    ctx.drawImage(topTextImg, 0, topTextOffsetY, imgW, imgH);
                    ctx.restore();
                }

                ctx.restore();

                gif.addFrame(ctx, { copy: true, delay: FRAME_DELAY });
            }

            gif.on('finished', (blob) => {
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                const safeText = (textMidInput.value || 'collection-log').replace(/[^a-zA-Z0-9-_]/g, '_');
                link.download = `collection-log-${safeText}.gif`;
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);

                saveGifBtn.disabled = false;
                saveGifBtn.textContent = 'Save Animation as GIF';
            });

            gif.render();

        } catch (error) {
            console.error('Error generating GIF:', error);
            alert('Error generating GIF. Check the console for details.');
            saveGifBtn.disabled = false;
            saveGifBtn.textContent = 'Save Animation as GIF';
        }
    });
});
