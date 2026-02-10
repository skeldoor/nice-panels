function formatCount(count) {
    if (count >= 10000000) {
        return `<span style="color: #26e37d">${Math.floor(count / 1000000)}M</span>`;
    } else if (count >= 100000) {
        return `<span style="color: #ffffff">${Math.floor(count / 1000)}K</span>`;
    }
    return count;
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

    itemSlot.innerHTML = ''; // Clear existing content

    if (itemIconUrl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bank-item'; // Re-using bank-item class for consistent styling

        const iconEl = document.createElement('img');
        iconEl.src = itemIconUrl;
        iconEl.className = 'item-icon';
        const iconScale = scale * (iconSizePercent / 100);
        iconEl.style.transform = `scale(${iconScale})`; // Apply scale + size adjustment to icon

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
    const bgSizeInput = document.getElementById('bg-size');
    const iconSizeInput = document.getElementById('icon-size');
    const saveImageBtn = document.getElementById('save-image-btn');
    const itemPanel = document.querySelector('.item-panel');
    const itemSlotEl = document.querySelector('.item-slot');
    const itemHolderBg = document.querySelector('.item-creator-bg');

    const renderItem = () => {
        const iconUrl = itemIconUrlInput.value;
        const count = parseInt(itemCountInput.value, 10);
        const scale = parseInt(itemScaleInput.value, 10);
        const showBg = showBackgroundCheckbox.checked;
        const bgSize = parseInt(bgSizeInput.value, 10) || 36;
        const iconSizePercent = parseInt(iconSizeInput.value, 10) || 100;

        if (showBg) {
            // Square dimensions when background is shown (like infobox holder)
            const scaledBgSize = bgSize * scale;
            const shadowOffset = 5 * scale; // drop-shadow room on right and bottom
            itemPanel.style.width = `${scaledBgSize + shadowOffset}px`;
            itemPanel.style.height = `${scaledBgSize + shadowOffset}px`;
            itemPanel.style.overflow = 'visible';

            // Size the background image explicitly so shadow extends into the extra space
            itemHolderBg.style.width = `${scaledBgSize}px`;
            itemHolderBg.style.height = `${scaledBgSize}px`;
            itemHolderBg.style.filter = `drop-shadow(${shadowOffset}px ${shadowOffset}px 0px rgba(0, 0, 0, 1))`;

            // Size the item slot to match the background so icon centers on the holder
            itemSlotEl.style.width = `${scaledBgSize}px`;
            itemSlotEl.style.height = `${scaledBgSize}px`;
        } else {
            // Original item slot dimensions when no background
            const baseWidth = 36;
            const baseHeight = 32;
            itemPanel.style.width = `${baseWidth * scale}px`;
            itemPanel.style.height = `${baseHeight * scale}px`;
            itemPanel.style.overflow = 'hidden';

            // Reset item slot to fill the panel
            itemSlotEl.style.width = '100%';
            itemSlotEl.style.height = '100%';
        }

        // Toggle background visibility
        itemHolderBg.style.display = showBg ? 'block' : 'none';

        generateItemIcon(iconUrl, count, scale, iconSizePercent);
    };

    // Initial render
    renderItem();

    // Event Listeners
    itemIconUrlInput.addEventListener('input', renderItem);
    itemCountInput.addEventListener('input', renderItem);
    itemScaleInput.addEventListener('input', renderItem);
    showBackgroundCheckbox.addEventListener('change', renderItem);
    bgSizeInput.addEventListener('input', renderItem);
    iconSizeInput.addEventListener('input', renderItem);

    saveImageBtn.addEventListener('click', async () => {
        //renderItem(); // Ensure up-to-date

        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            await inlineBackgroundImages(itemPanel);

            await document.fonts.ready;
            await new Promise(r => requestAnimationFrame(r));

            const dataUrl = await domtoimage.toPng(itemPanel, {
                
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