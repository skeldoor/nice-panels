function formatCount(count) {
    if (count >= 10000000) {
        return `<span style="color: #26e37d">${Math.floor(count / 1000000)}M</span>`;
    } else if (count >= 100000) {
        return `<span style="color: #ffffff">${Math.floor(count / 1000)}K</span>`;
    }
    return count;
}

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

function generateItemIcon(itemIconUrl, itemCount, scale, iconSizePercent) {
    const itemSlot = document.querySelector('.item-slot');
    if (!itemSlot) return;

    iconSizePercent = iconSizePercent || 100;

    const showShadowCheckbox = document.getElementById('show-shadow');
    const shadowStyleSelect = document.getElementById('shadow-style');
    const shadowColourInput = document.getElementById('shadow-colour');
    const showShadow = showShadowCheckbox ? showShadowCheckbox.checked : true;
    const shadowStyle = shadowStyleSelect ? shadowStyleSelect.value : 'ingame';

    itemSlot.innerHTML = ''; // Clear existing content

    if (itemIconUrl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bank-item'; // Re-using bank-item class for consistent styling

        const iconEl = document.createElement('img');
        iconEl.src = itemIconUrl;
        iconEl.className = 'item-icon';
        const iconScale = scale * (iconSizePercent / 100);
        iconEl.style.transform = `scale(${iconScale})`; // Apply scale + size adjustment to icon

        // Apply shadow style to icon
        if (showShadow) {
            if (shadowStyle === 'ingame') {
                iconEl.style.filter = `drop-shadow(1px 1px 0 rgb(51, 51, 51, 1))`;
            } else if (shadowStyle === 'solid-black') {
                iconEl.style.filter = `drop-shadow(1px 1px 0 rgb(0, 0, 0, 1))`;
            } else if (shadowStyle === 'custom') {
                const customColour = shadowColourInput ? shadowColourInput.value : '#000000';
                iconEl.style.filter = `drop-shadow(1px 1px 0 ${customColour})`;
            }
        } else {
            iconEl.style.filter = 'none';
        }

        itemEl.appendChild(iconEl);

        if (itemCount > 1) {
            const countEl = document.createElement('div');
            countEl.className = 'item-count';
            countEl.innerHTML = formatCount(itemCount);
            
            const baseFontSize = 31; // Base font size from bank.js
            const baseShadow = 1.5; // Base text-shadow distance (6px at scale 8, so 1.5 at scale 1)
            countEl.style.fontSize = `${baseFontSize * (scale / 2)}px`; // Scale font size
            countEl.style.top = `${-1 * (scale / 2)}px`; // Scale top position (base -1px)
            countEl.style.left = `${5 * (scale / 2)}px`; // Scale left position (base 5px)
            countEl.style.textShadow = `${baseShadow * (scale / 2)}px ${baseShadow * (scale / 2)}px 0 #000`; // Scale text-shadow

            itemEl.appendChild(countEl);
        }

        itemSlot.appendChild(itemEl);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const itemIconUrlInput = document.getElementById('item-icon-url');
    const itemCountInput = document.getElementById('item-count');
    const itemScaleInput = document.getElementById('item-scale');
    const showBackgroundCheckbox = document.getElementById('show-background');
    const showShadowCheckbox = document.getElementById('show-shadow');
    const shadowStyleSelect = document.getElementById('shadow-style');
    const shadowColourInput = document.getElementById('shadow-colour');
    const shadowStyleGroup = document.getElementById('shadow-style-group');
    const shadowColourGroup = document.getElementById('shadow-colour-group');
    const bgSizeInput = document.getElementById('bg-size');
    const iconSizeInput = document.getElementById('icon-size');
    const saveImageBtn = document.getElementById('save-image-btn');
    const itemPanel = document.querySelector('.item-panel');
    const itemSlotEl = document.querySelector('.item-slot');
    const itemHolderBg = document.querySelector('.item-creator-bg');

    function getShadowColour() {
        const style = shadowStyleSelect.value;
        if (style === 'ingame') return 'rgba(0, 0, 0, 1)';
        if (style === 'solid-black') return 'rgba(0, 0, 0, 1)';
        if (style === 'custom') return shadowColourInput.value;
        return 'rgba(0, 0, 0, 1)';
    }

    function updateShadowControls() {
        const showShadow = showShadowCheckbox.checked;
        shadowStyleGroup.style.display = showShadow ? 'flex' : 'none';
        shadowColourGroup.style.display = (showShadow && shadowStyleSelect.value === 'custom') ? 'flex' : 'none';
    }

    const renderItem = () => {
        const iconUrl = itemIconUrlInput.value;
        const count = parseInt(itemCountInput.value, 10);
        const scale = parseInt(itemScaleInput.value, 10);
        const showBg = showBackgroundCheckbox.checked;
        const showShadow = showShadowCheckbox.checked;
        const shadowStyle = shadowStyleSelect.value;
        const bgSize = parseInt(bgSizeInput.value, 10) || 36;
        const iconSizePercent = parseInt(iconSizeInput.value, 10) || 100;

        updateShadowControls();

        // Always use consistent square sizing so toggling background doesn't shift the icon
        const scaledBgSize = bgSize * scale;
        const shadowOffset = showShadow ? 1 * scale : 0; // 1px per scale, or 0 if shadow disabled
        itemPanel.style.width = `${scaledBgSize + shadowOffset}px`;
        itemPanel.style.height = `${scaledBgSize + shadowOffset}px`;
        itemPanel.style.overflow = 'visible';

        // Size the item slot to match the background area
        itemSlotEl.style.width = `${scaledBgSize}px`;
        itemSlotEl.style.height = `${scaledBgSize}px`;

        if (showBg) {
            // Size and style the background image
            itemHolderBg.style.width = `${scaledBgSize}px`;
            itemHolderBg.style.height = `${scaledBgSize}px`;

            if (showShadow) {
                const shadowColour = getShadowColour();
                if (shadowStyle === 'ingame') {
                    // In-game style: original semi-transparent dark shadow
                    itemHolderBg.style.filter = `drop-shadow(${shadowOffset}px ${shadowOffset}px 0px rgba(0, 0, 0, 1))`;
                } else {
                    // Solid black or custom colour
                    itemHolderBg.style.filter = `drop-shadow(${shadowOffset}px ${shadowOffset}px 0px ${shadowColour})`;
                }
            } else {
                itemHolderBg.style.filter = 'none';
            }
        }

        // Toggle background visibility
        itemHolderBg.style.display = showBg ? 'block' : 'none';

        generateItemIcon(iconUrl, count, scale, iconSizePercent);
    };

    // Initial render
    updateShadowControls();
    renderItem();

    // Event Listeners
    itemIconUrlInput.addEventListener('input', renderItem);
    itemCountInput.addEventListener('input', renderItem);
    itemScaleInput.addEventListener('input', renderItem);
    showBackgroundCheckbox.addEventListener('change', renderItem);
    showShadowCheckbox.addEventListener('change', renderItem);
    shadowStyleSelect.addEventListener('change', renderItem);
    shadowColourInput.addEventListener('input', renderItem);
    bgSizeInput.addEventListener('input', renderItem);
    iconSizeInput.addEventListener('input', renderItem);

    saveImageBtn.addEventListener('click', async () => {
        //renderItem(); // Ensure up-to-date

        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            await inlineBackgroundImages(itemPanel);
            await inlineImgElements(itemPanel);

            await document.fonts.ready;
            await new Promise(r => requestAnimationFrame(r));

            const captureWidth = itemPanel.offsetWidth;
            const captureHeight = itemPanel.offsetHeight;

            const dataUrl = await domtoimage.toPng(itemPanel, {
                width: captureWidth,
                height: captureHeight,
                bgcolor: 'transparent',
                style: {
                    'background-color': 'transparent',
                    'image-rendering': 'pixelated'
                }
            });

            // !important removed from background transparent above

            const link = document.createElement('a');
            
            const itemIconUrl = itemIconUrlInput.value;
            const itemCount = parseInt(itemCountInput.value, 10);
            const itemScale = parseInt(itemScaleInput.value, 10);

            // Extract item name from URL
            const urlParts = itemIconUrl.split('/');
            let itemName = urlParts[urlParts.length - 1];
            itemName = itemName.split('.')[0]; // Remove file extension
            //itemName = itemName.replace(/_/g, '-'); // Replace underscores with hyphens for cleaner filename

            let formattedCount = formatCount(itemCount);
            formattedCount = formattedCount.toString().replace(/<[^>]*>?/gm, ''); // Remove HTML tags from formatted count

            link.download = `${itemName}-${formattedCount}-${itemScale}x.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Error generating image:', error);
            alert('Error generating image. Check the console for details.');
        } finally {
            saveImageBtn.disabled = false;
            saveImageBtn.textContent = 'Save as Image';
        }
    });
});