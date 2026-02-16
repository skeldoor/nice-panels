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
    const skillSelect = document.getElementById('skill-select');
    const topNumberInput = document.getElementById('top-number');
    const bottomNumberInput = document.getElementById('bottom-number');
    const FIXED_SCALE = 5;
    const saveImageBtn = document.getElementById('save-image-btn');
    const levelPanel = document.getElementById('level-panel');
    const skillIcon = levelPanel.querySelector('.level-skill-icon');
    const topNumberEl = levelPanel.querySelector('.level-top-number');
    const bottomNumberEl = levelPanel.querySelector('.level-bottom-number');

    function renderPanel() {
        const skill = skillSelect.value;
        const topNum = topNumberInput.value;
        const bottomNum = bottomNumberInput.value;
        const scale = FIXED_SCALE;

        // Update skill icon
        skillIcon.src = skill + '.png';
        skillIcon.alt = skill;

        // Update numbers
        topNumberEl.textContent = topNum;
        bottomNumberEl.textContent = bottomNum;

        // Apply scale
        levelPanel.style.transform = `scale(${scale})`;
        levelPanel.style.transformOrigin = 'top center';
    }

    // Initial render
    renderPanel();

    // Event listeners
    skillSelect.addEventListener('change', renderPanel);
    topNumberInput.addEventListener('input', renderPanel);
    bottomNumberInput.addEventListener('input', renderPanel);
    // Save as image
    saveImageBtn.addEventListener('click', async () => {
        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            const scale = FIXED_SCALE;
            const skill = skillSelect.value;
            const topNum = topNumberInput.value;
            const bottomNum = bottomNumberInput.value;

            // Clone panel for export at 1x, then scale via dom-to-image
            const clone = levelPanel.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.transform = 'none';
            document.body.appendChild(clone);

            try {
                // Resolve translateX(50%) into explicit positioning for clean export
                // (dom-to-image can misrender text-shadow when combined with transforms)
                clone.querySelectorAll('.level-top-number, .level-bottom-number').forEach(el => {
                    const width = el.offsetWidth;
                    const currentRight = parseFloat(getComputedStyle(el).right);
                    el.style.right = (currentRight - width / 2) + 'px';
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

                // Capture with CSS transform scaling (renders text at target size for crisp glyphs)
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
                link.download = `${skill}-${topNum}-${bottomNum}-${scale}x.png`;
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
