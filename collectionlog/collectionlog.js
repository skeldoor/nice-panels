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
    const textTopInput = document.getElementById('text-top');
    const textMidInput = document.getElementById('text-mid');
    const textBottomInput = document.getElementById('text-bottom');
    const colorTopInput = document.getElementById('color-top');
    const colorMidInput = document.getElementById('color-mid');
    const colorBottomInput = document.getElementById('color-bottom');
    const FIXED_SCALE = 3;
    const saveImageBtn = document.getElementById('save-image-btn');
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

    // Save as image
    saveImageBtn.addEventListener('click', async () => {
        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            const scale = FIXED_SCALE;

            // Clone panel for export at 1x, then scale via dom-to-image
            const clone = logPanel.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.transform = 'none';
            document.body.appendChild(clone);

            try {
                // Resolve translateX(-50%) into explicit left for clean export
                const panelWidth = clone.offsetWidth;
                clone.querySelectorAll('.collection-log-text').forEach(el => {
                    const textWidth = el.offsetWidth;
                    el.style.left = ((panelWidth - textWidth) / 2) + 'px';
                    el.style.transform = 'none';
                });

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

                const link = document.createElement('a');
                const safeText = (textMidInput.value || 'collection-log').replace(/[^a-zA-Z0-9-_]/g, '_');
                link.download = `collection-log-${safeText}-${scale}x.png`;
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
