// State - now global
let bankState = {
    grid: {
        columns: 8,
        rows: 5,
    },
    maxSpaces: 800,
    bankValue: '0',
    title: 'The Bank of Gielinor',
    bankTabs: {
        count: 0,
        items: []
    },
    items: [
        { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Iron_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Steel_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Black_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Mithril_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Adamant_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Rune_axe.png', count: 1 },
        { iconUrl: 'https://oldschool.runescape.wiki/images/Dragon_axe.png', count: 1 }
    ],
};

function formatCount(count) {
    if (count >= 10000000) {
        return `<span style="color: #26e37d">${Math.floor(count / 1000000)}M</span>`;
    } else if (count >= 100000) {
        return `<span style="color: #ffffff">${Math.floor(count / 1000)}K</span>`;
    }
    return count;
}

function generateBank(stateToRender = null) {
    const currentState = stateToRender || bankState;

    // Get elements needed for generation - they might not exist if called by puppeteer
    const gridColumnsInput = document.getElementById('grid-columns');
    const gridRowsInput = document.getElementById('grid-rows');
    const maxSpacesInput = document.getElementById('max-spaces');
    const bankValueInput = document.getElementById('bank-value');
    const bankTitleInput = document.getElementById('bank-title-text');
    const bankPanel = document.querySelector('.bank-panel');
    const bankBackground = document.querySelector('.bank-background');
    const bankGrid = document.querySelector('.bank-grid');
    const bankTabsContainer = document.querySelector('.bank-tabs');
    const bankSpaceUsed = document.getElementById('bank-space-used');
    const bankSpaceMax = document.getElementById('bank-space-max');
    const bankValueDisplay = document.getElementById('bank-value-display');
    const bankTitleDisplay = document.querySelector('.bank-title > span:first-child');

    // Update state from inputs if they exist and we are not rendering a specific state
    if (!stateToRender && gridColumnsInput) {
        currentState.grid.columns = parseInt(gridColumnsInput.value, 10);
        currentState.grid.rows = parseInt(gridRowsInput.value, 10);
        currentState.maxSpaces = parseInt(maxSpacesInput.value, 10);
        currentState.bankValue = bankValueInput.value;
        currentState.title = bankTitleInput.value;
    }

    // Clear existing content
    if (bankTabsContainer) bankTabsContainer.innerHTML = '';
    if (bankGrid) bankGrid.innerHTML = '';

    // Render Tabs
    if (bankTabsContainer) {
        const tabCount = currentState.bankTabs.count;
        const tabItems = currentState.bankTabs.items;

        if (tabCount === 0) {
            const emptyTab = document.createElement('div');
            emptyTab.className = 'bank-tab';
            emptyTab.innerHTML = `<img src="emptytab.png" alt="Empty Tab">`;
            bankTabsContainer.appendChild(emptyTab);
        } else {
            for (let i = 0; i < tabCount; i++) {
                const tab = document.createElement('div');
                tab.className = 'bank-tab';
                const item = tabItems[i];
                if (item && item.iconUrl) {
                    tab.innerHTML = `<img src="itemtab.png" class="tab-background"><img src="${item.iconUrl}" class="tab-item">`;
                } else {
                    tab.innerHTML = `<img src="itemtab.png" class="tab-background">`;
                }
                bankTabsContainer.appendChild(tab);
            }
            if (tabCount < 9) {
                const emptyTab = document.createElement('div');
                emptyTab.className = 'bank-tab';
                emptyTab.innerHTML = `<img src="emptytab.png" alt="Empty Tab">`;
                bankTabsContainer.appendChild(emptyTab);
            }
        }
    }

    // Render Items
    if (bankGrid) {
        bankGrid.style.gridTemplateColumns = `repeat(${currentState.grid.columns}, 1fr)`;
        bankGrid.style.gridTemplateRows = `repeat(${currentState.grid.rows}, 1fr)`;

        const baseColumns = 8;
        const scaleFactor = (baseColumns / currentState.grid.columns) * 2;

        // Apply scale factor to tab items as well
        const tabItems = bankTabsContainer.querySelectorAll('.tab-item');
        tabItems.forEach(item => {
            item.style.transform = `scale(${scaleFactor})`;
        });

        currentState.items.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'bank-item';

            const iconEl = document.createElement('img');
            iconEl.src = item.iconUrl;
            iconEl.className = 'item-icon';
            iconEl.style.transform = `scale(${scaleFactor})`;
            
            itemEl.appendChild(iconEl);

            if (item.count > 1) {
                const countEl = document.createElement('div');
                countEl.className = 'item-count';
                countEl.innerHTML = formatCount(item.count);
                
                const baseFontSize = 36;
                countEl.style.fontSize = `${baseFontSize * (scaleFactor / 2)}px`;
                countEl.style.top = `${1 * (scaleFactor / 2)}px`;
                countEl.style.left = `${5 * (scaleFactor / 2)}px`;

                itemEl.appendChild(countEl);
            }

            bankGrid.appendChild(itemEl);
        });
    }

    // Update Bank Space Counter
    if (bankSpaceUsed) bankSpaceUsed.textContent = currentState.items.length;
    if (bankSpaceMax) bankSpaceMax.textContent = currentState.maxSpaces;

    // Update Bank Value Display
    if (bankValueDisplay) {
        if (currentState.bankValue && currentState.bankValue !== '0') {
            if (currentState.bankValue === 'Lots!') {
                bankValueDisplay.textContent = `(${currentState.bankValue})`;
            } else {
                bankValueDisplay.textContent = `(${currentState.bankValue.toUpperCase()})`;
            }
        } else {
            bankValueDisplay.textContent = '';
        }
    }

    // Update Bank Title Display
    if (bankTitleDisplay) {
        bankTitleDisplay.textContent = currentState.title;
    }
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
    // Get all elements by ID
    const gridColumnsInput = document.getElementById('grid-columns');
    const gridRowsInput = document.getElementById('grid-rows');
    const maxSpacesInput = document.getElementById('max-spaces');
    const bankValueInput = document.getElementById('bank-value');
    const bankTitleInput = document.getElementById('bank-title-text');
    const saveImageBtn = document.getElementById('save-image-btn');
    const bankTabsCountInput = document.getElementById('bank-tabs-count');
    const bankTabsItemsContainer = document.getElementById('bank-tabs-items');
    const itemIconUrlInput = document.getElementById('item-icon-url');
    const itemCountInput = document.getElementById('item-count');
    const addItemBtn = document.getElementById('add-item-btn');
    const itemListContainer = document.getElementById('item-list');
    const bankPanel = document.querySelector('.bank-panel');
    const bankBackground = document.querySelector('.bank-background');
    const generateBtn = document.getElementById('generate-btn');
    const debug1Btn = document.getElementById('debug-1');
    const debug2Btn = document.getElementById('debug-2');
    const debug3Btn = document.getElementById('debug-3');
    const debugLayoutBtn = document.getElementById('debug-layout');
    const debugRichBtn = document.getElementById('debug-rich');
    const raidItemsBtn = document.getElementById('raid-items-btn');

    // Set panel size based on background image
    const img = new Image();
    img.src = bankBackground.src;
    img.onload = () => {
        bankPanel.style.width = `${img.naturalWidth}px`;
        bankPanel.style.height = `${img.naturalHeight}px`;
    };

    // Event Listeners
    gridColumnsInput.addEventListener('input', () => generateBank());
    gridRowsInput.addEventListener('input', () => generateBank());
    maxSpacesInput.addEventListener('input', () => generateBank());
    bankValueInput.addEventListener('input', () => generateBank());
    bankTitleInput.addEventListener('input', () => generateBank());
    bankTabsCountInput.addEventListener('input', () => {
        bankState.bankTabs.count = parseInt(bankTabsCountInput.value, 10);
        renderAdminLists();
        generateBank();
    });

    saveImageBtn.addEventListener('click', async () => {
        generateBank(); // Make sure the bank is up-to-date

        const bankPanel = document.querySelector('.bank-panel');
        
        saveImageBtn.disabled = true;
        saveImageBtn.textContent = 'Please wait...';

        try {
            await inlineBackgroundImages(bankPanel);
            const dataUrl = await domtoimage.toPng(bankPanel, {
                cacheBust: true,
                style: {
                    'image-rendering': 'pixelated',
                }
            });
            const link = document.createElement('a');
            link.download = 'bank-panel.png';
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


    addItemBtn.addEventListener('click', () => {
        const iconUrl = itemIconUrlInput.value;
        const count = parseInt(itemCountInput.value, 10);
        if (iconUrl && count > 0) {
            bankState.items.push({ iconUrl, count });
            itemIconUrlInput.value = '';
            itemCountInput.value = 1;
            renderAdminLists();
            generateBank();
        }
    });

    function renderAdminLists() {
        bankTabsItemsContainer.innerHTML = '';
        for (let i = 0; i < bankState.bankTabs.count; i++) {
            const itemControl = document.createElement('div');
            itemControl.className = 'control-group';

            const label = document.createElement('label');
            label.textContent = `Tab ${i + 1} Item URL:`;

            const input = document.createElement('input');
            input.type = 'text';
            input.placeholder = 'Enter image URL';
            input.value = bankState.bankTabs.items[i] ? bankState.bankTabs.items[i].iconUrl : '';
            input.addEventListener('input', (e) => {
                if (!bankState.bankTabs.items[i]) {
                    bankState.bankTabs.items[i] = {};
                }
                bankState.bankTabs.items[i].iconUrl = e.target.value;
                generateBank();
            });

            itemControl.appendChild(label);
            itemControl.appendChild(input);
            bankTabsItemsContainer.appendChild(itemControl);
        }

        itemListContainer.innerHTML = '';
        let draggedItemIndex = null;

        bankState.items.forEach((item, index) => {
            const itemElement = document.createElement('div');
            itemElement.classList.add('item-admin-entry');
            itemElement.setAttribute('draggable', 'true');
            itemElement.dataset.index = index;

            itemElement.addEventListener('dragstart', (e) => {
                draggedItemIndex = index;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => {
                    itemElement.classList.add('dragging');
                }, 0);
            });

            itemElement.addEventListener('dragend', () => {
                itemElement.classList.remove('dragging');
            });

            const img = document.createElement('img');
            img.src = item.iconUrl;
            img.width = 20;

            const countInput = document.createElement('input');
            countInput.type = 'number';
            countInput.value = item.count;
            countInput.addEventListener('input', (e) => {
                bankState.items[index].count = parseInt(e.target.value, 10);
                generateBank();
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                bankState.items.splice(index, 1);
                renderAdminLists();
                generateBank();
            });

            itemElement.appendChild(img);
            itemElement.appendChild(countInput);
            itemElement.appendChild(deleteBtn);
            itemListContainer.appendChild(itemElement);
        });

        itemListContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(itemListContainer, e.clientY);
            const dragging = document.querySelector('.dragging');
            if (afterElement == null) {
                itemListContainer.appendChild(dragging);
            } else {
                itemListContainer.insertBefore(dragging, afterElement);
            }
        });

        itemListContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(itemListContainer, e.clientY);
            const newIndex = afterElement ? parseInt(afterElement.dataset.index) : bankState.items.length;
            
            const draggedItem = bankState.items.splice(draggedItemIndex, 1)[0];
            
            let finalIndex;
            if (draggedItemIndex < newIndex) {
                finalIndex = newIndex - 1;
            } else {
                finalIndex = newIndex;
            }
            bankState.items.splice(finalIndex, 0, draggedItem);

            renderAdminLists();
            generateBank();
        });

        function getDragAfterElement(container, y) {
            const draggableElements = [...container.querySelectorAll('.item-admin-entry:not(.dragging)')];

            return draggableElements.reduce((closest, child) => {
                const box = child.getBoundingClientRect();
                const offset = y - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset: offset, element: child };
                } else {
                    return closest;
                }
            }, { offset: Number.NEGATIVE_INFINITY }).element;
        }
    }

    generateBtn.style.display = 'none';

    // Debug Controls
    debug1Btn.addEventListener('click', () => {
        gridColumnsInput.value = 8;
        gridRowsInput.value = 5;
        bankState.grid.columns = 8;
        bankState.grid.rows = 5;
        bankTitleInput.value = 'The Bank of Gielinor';
        bankState.title = 'The Bank of Gielinor';
        bankValueInput.value = '0';
        bankState.bankValue = '0';
        bankState.items = [
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 1 }
        ];
        renderAdminLists();
        generateBank();
    });

    debug2Btn.addEventListener('click', () => {
        gridColumnsInput.value = 1;
        gridRowsInput.value = 1;
        bankState.grid.columns = 1;
        bankState.grid.rows = 1;
        bankTitleInput.value = "I'm Hopping Mad";
        bankState.title = "I'm Hopping Mad";
        bankValueInput.value = '0';
        bankState.bankValue = '0';
        bankState.items = [
            { iconUrl: 'https://oldschool.runescape.wiki/images/Toad%27s_legs.png', count: 1 }
        ];
        renderAdminLists();
        generateBank();
    });

    debug3Btn.addEventListener('click', () => {
        gridColumnsInput.value = 8;
        gridRowsInput.value = 5;
        bankState.grid.columns = 8;
        bankState.grid.rows = 5;
        bankTitleInput.value = 'The Bank of Gielinor';
        bankState.title = 'The Bank of Gielinor';
        bankValueInput.value = '0';
        bankState.bankValue = '0';
        bankState.items = [
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 1 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 100 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 5000 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 12345 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 250000 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 1000000 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 10000000 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bronze_axe.png', count: 2147000000 },
        ];
        renderAdminLists();
        generateBank();
    });

    debugLayoutBtn.addEventListener('click', () => {
        gridColumnsInput.value = 8;
        gridRowsInput.value = 5;
        bankState.grid.columns = 8;
        bankState.grid.rows = 5;
        bankTitleInput.value = 'The Bank of Gielinor';
        bankState.title = 'The Bank of Gielinor';
        bankValueInput.value = '0';
        bankState.bankValue = '0';
        bankState.items = [
            { iconUrl: 'https://oldschool.runescape.wiki/images/Jug.png', count: 2400 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Yew_logs.png', count: 4891 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Knife.png', count: 25 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Tinderbox.png', count: 13 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Pot.png', count: 322 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bucket_of_slime.png', count: 42 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Yew_longbow_(u).png', count: 483 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Silver_sickle_(b).png', count: 2 },
        ];
        renderAdminLists();
        generateBank();
    });

    debugRichBtn.addEventListener('click', () => {
        gridColumnsInput.value = 8;
        gridRowsInput.value = 5;
        bankState.grid.columns = 8;
        bankState.grid.rows = 5;
        bankTitleInput.value = 'The Bank of Gielinor';
        bankState.title = 'The Bank of Gielinor';
        bankValueInput.value = 'Lots!';
        bankState.bankValue = 'Lots!';
        const getRandomCount = () => Math.floor(Math.random() * (50 - 30 + 1)) + 30;

        bankState.items = [
            { iconUrl: 'https://oldschool.runescape.wiki/images/Coins_10000.png', count: 2147000000 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/3rd_age_range_coif.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/3rd_age_range_top.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/3rd_age_range_legs.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/3rd_age_vambraces.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/3rd_age_full_helmet.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/3rd_age_platebody.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Armadyl_godsword.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bandos_godsword.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Saradomin_godsword.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Zamorak_godsword.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Scythe_of_vitur.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Pegasian_boots.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Elysian_spirit_shield.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Red_partyhat.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Yellow_partyhat.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Blue_partyhat.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Green_partyhat.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Purple_partyhat.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/White_partyhat.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Twisted_bow.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Gilded_scimitar.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Dragon_claws.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Bandos_tassets.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Zaryte_crossbow.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Tumeken%27s_shadow.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Torva_full_helm.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Torva_platebody.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Torva_platelegs.png', count: getRandomCount() },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Dragonstone.png', count: 42069 },
        ];
        renderAdminLists();
        generateBank();
    });

    raidItemsBtn.addEventListener('click', () => {
        gridColumnsInput.value = 3;
        gridRowsInput.value = 1;
        bankState.grid.columns = 3;
        bankState.grid.rows = 1;
        bankTitleInput.value = 'The Bank of Gielinor';
        bankState.title = 'The Bank of Gielinor';
        bankValueInput.value = 'Lots!';
        bankState.bankValue = 'Lots!';
        bankState.items = [
            { iconUrl: 'https://oldschool.runescape.wiki/images/Scythe_of_vitur.png', count: 1 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Tumeken%27s_shadow.png', count: 1 },
            { iconUrl: 'https://oldschool.runescape.wiki/images/Twisted_bow.png', count: 1 },
        ];
        renderAdminLists();
        generateBank();
    });

    // Initial Render
    renderAdminLists();
    generateBank();
});