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

function generateItemIcon(itemIconUrl, itemCount, scale) {
    const itemSlot = document.querySelector('.item-slot');
    if (!itemSlot) return;

    itemSlot.innerHTML = ''; // Clear existing content

    if (itemIconUrl) {
        const itemEl = document.createElement('div');
        itemEl.className = 'bank-item'; // Re-using bank-item class for consistent styling

        const iconEl = document.createElement('img');
        iconEl.src = itemIconUrl;
        iconEl.className = 'item-icon';
        iconEl.style.transform = `scale(${scale})`; // Apply scale to icon
        
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
    const saveImageBtn = document.getElementById('save-image-btn');
    const itemPanel = document.querySelector('.item-panel');

    const renderItem = () => {
        const iconUrl = itemIconUrlInput.value;
        const count = parseInt(itemCountInput.value, 10);
        const scale = parseInt(itemScaleInput.value, 10);

        // Adjust itemPanel size based on scale
        const baseWidth = 36;
        const baseHeight = 32;
        itemPanel.style.width = `${baseWidth * scale}px`;
        itemPanel.style.height = `${baseHeight * scale}px`;

        generateItemIcon(iconUrl, count, scale);
    };

    // Initial render
    renderItem();

    // Event Listeners
    itemIconUrlInput.addEventListener('input', renderItem);
    itemCountInput.addEventListener('input', renderItem);
    itemScaleInput.addEventListener('input', renderItem);

    saveImageBtn.addEventListener('click', async () => {
        renderItem(); // Ensure up-to-date

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