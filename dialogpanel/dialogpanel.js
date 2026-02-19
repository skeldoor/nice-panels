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
    const npcNameInput = document.getElementById('npcNameInput');
    const dialogTextInput = document.getElementById('dialogTextInput');
    const npcChathead = document.getElementById('npc-chathead');
    const npcNameDisplay = document.getElementById('npc-name');
    const dialogTextDisplay = document.getElementById('dialog-text');
    const continueText = document.getElementById('continue-text');

    const scaleInput = document.getElementById('scale');
    const chatheadXInput = document.getElementById('chatheadX');
    const chatheadYInput = document.getElementById('chatheadY');
    const chatheadScaleInput = document.getElementById('chatheadScale');
    const panel = document.getElementById('panel');
    const content = panel.querySelector('.content');

    // Store base object-position and transform values
    let baseObjectPositionX = 50; // Default center
    let baseObjectPositionY = 50; // Default center
    let baseTransformScale = 0.95; // Default slight shrinkage

    function updatePanel() {
        const scale = parseFloat(scaleInput.value); // Use parseFloat for scale
        const baseSize = 32; // Base size for corners and edges
        const borderDepth = 6; // This is an approximation from infobox.js (not scaled by JS anymore)

        const naturalWidth = 518;
        const naturalHeight = 141;

        // Set the base dimensions of the panel (1x scale)
        panel.style.width = `${naturalWidth}px`;
        panel.style.height = `${naturalHeight}px`;

        // Apply overall scaling using CSS transform
        panel.style.transform = `scale(${scale})`;
        panel.style.transformOrigin = 'top center'; // Scale from top center to stay centered

        // Update content size and position (these are now relative to the unscaled panel)
        content.style.top = `${borderDepth}px`;
        content.style.left = `${borderDepth}px`;
        content.style.right = `${borderDepth}px`;
        content.style.bottom = `${borderDepth}px`;
        content.style.padding = `${borderDepth}px`;
        content.style.backgroundColor = '#CBBA95'; // Default background color

        // Update corners (these are now based on baseSize, not scaledSize)
        const corners = panel.querySelectorAll('.corner');
        corners.forEach(corner => {
            corner.style.width = `${baseSize}px`;
            corner.style.height = `${baseSize}px`;
        });

        // Update horizontal edges (top and bottom)
        const topBottom = panel.querySelectorAll('.edge.top, .edge.bottom');
        topBottom.forEach(edge => {
            edge.style.left = `${baseSize}px`;
            edge.style.right = `${baseSize}px`;
            edge.style.height = `${baseSize}px`;
            edge.style.backgroundSize = `${baseSize}px ${baseSize}px`;
        });

        // Update vertical edges (left and right)
        const leftRight = panel.querySelectorAll('.edge.left, .edge.right');
        leftRight.forEach(edge => {
            edge.style.top = `${baseSize}px`;
            edge.style.bottom = `${baseSize}px`;
            edge.style.width = `${baseSize}px`;
            edge.style.backgroundSize = `${baseSize}px ${baseSize}px`;
            if (edge.classList.contains('left')) {
                edge.style.left = `${0}px`; // Left edge starts at 0
            } else if (edge.classList.contains('right')) {
                edge.style.right = `${0}px`; // Right edge starts at 0
            }
        });

        updateFrameType();
        updateDialogContent(); // Call this to update dialog specific content
    }

    function updateFrameType() {
        const frameType = 'frame1'; // Always use frame1
        let framePath = `../../resources/frames/${frameType}/`; // Path relative to dialogpanel/

        const cornerTL = panel.querySelector('.corner.tl');
        const cornerTR = panel.querySelector('.corner.tr');
        const cornerBL = panel.querySelector('.corner.bl');
        const cornerBR = panel.querySelector('.corner.br');

        cornerTL.style.backgroundImage = `url('${framePath}tl.png')`;
        cornerTR.style.backgroundImage = `url('${framePath}tr.png')`;
        cornerBL.style.backgroundImage = `url('${framePath}bl.png')`;
        cornerBR.style.backgroundImage = `url('${framePath}br.png')`;

        const edgeTop = panel.querySelector('.edge.top');
        const edgeBottom = panel.querySelector('.edge.bottom');
        const edgeLeft = panel.querySelector('.edge.left');
        const edgeRight = panel.querySelector('.edge.right');

        edgeTop.style.backgroundImage = `url('${framePath}t.png')`;
        edgeBottom.style.backgroundImage = `url('${framePath}b.png')`;
        edgeLeft.style.backgroundImage = `url('${framePath}l.png')`;
        edgeRight.style.backgroundImage = `url('${framePath}r.png')`;
    }

    function generateCapitalizationVariations(name) {
        const variations = new Set();
        variations.add(name); // Add the name exactly as typed by the user first

        const words = name.split(' ');

        // Generate variations by lowercasing the first letter of subsequent words (after the first space)
        if (words.length > 1) {
            const firstWord = words[0];
            // For subsequent words, lowercase only the first letter, keep rest as is
            const restOfWordsLowercasedFirstLetter = words.slice(1).map(word => {
                // If a word contains a hyphen, treat it as a single unit for initial casing
                if (word.includes('-')) {
                    return word; // Preserve original casing for hyphenated words
                }
                return word.charAt(0).toLowerCase() + word.slice(1);
            });
            variations.add([firstWord, ...restOfWordsLowercasedFirstLetter].join(' '));
        }

        // Generate variations by lowercasing all subsequent words entirely
        if (words.length > 1) {
            const firstWord = words[0];
            const restOfWordsFullyLowercased = words.slice(1).map(word => word.toLowerCase());
            variations.add([firstWord, ...restOfWordsFullyLowercased].join(' '));
        }
        
        // Generate variations where the first word is also lowercased (except first letter)
        // This covers "The baby mole" from "The Baby Mole"
        if (words.length > 0) {
            const firstWordLower = words[0].charAt(0).toLowerCase() + words[0].slice(1);
            const restOfWords = words.slice(1).map(word => word.toLowerCase());
            variations.add([firstWordLower, ...restOfWords].join(' '));
        }

        return Array.from(variations);
    }

    function updateDialogContent() {
        const npcName = npcNameInput.value.trim();
        const dialogText = dialogTextInput.value.trim();

        if (npcName) {
            npcNameDisplay.textContent = npcName;
            npcChathead.style.display = 'block'; // Show chathead while trying to load

            const variations = generateCapitalizationVariations(npcName);
            let imageLoaded = false;

            const tryLoadImage = (index) => {
                if (index >= variations.length) {
                    // All variations tried, hide chathead
                    npcChathead.style.display = 'none';
                    npcChathead.src = ''; // Clear src
                    npcChathead.style.width = 'auto';
                    npcChathead.style.height = 'auto';
                    npcChathead.style.objectPosition = '50% 50%';
                    npcChathead.style.transform = 'none';
                    return;
                }

                const currentNpcName = variations[index];
                const chatheadUrl = `https://oldschool.runescape.wiki/images/${encodeURIComponent(currentNpcName.replace(/ /g, '_'))}_chathead.png`;

                // Use a new Image object for loading to reliably trigger onload/onerror
                const tempImg = new Image();
                tempImg.onload = () => {
                    if (imageLoaded) return; // Prevent multiple loads if a previous one was slow

                    imageLoaded = true;
                    npcChathead.src = chatheadUrl; // Set the actual chathead src
                    npcChathead.alt = `${currentNpcName} Chathead`;
                    npcChathead.style.display = 'block'; // Ensure it's visible

                    // Apply initial sizing and positioning based on natural dimensions
                    let objectPositionOffset;
                    const naturalHeight = tempImg.naturalHeight; // Use tempImg's naturalHeight
                    const naturalWidth = tempImg.naturalWidth; // Use tempImg's naturalWidth

                    // Linear interpolation for object-position
                    const heightMin = 90;
                    const offsetMin = -15;
                    const heightMax = 130;
                    const offsetMax = -20;

                    if (naturalHeight <= heightMin) {
                        objectPositionOffset = offsetMin;
                    } else if (naturalHeight >= heightMax) {
                        objectPositionOffset = offsetMax;
                    } else {
                        objectPositionOffset = offsetMin + (naturalHeight - heightMin) * (offsetMax - offsetMin) / (heightMax - heightMin);
                    }

                    if (naturalWidth > naturalHeight) {
                        npcChathead.style.width = '130px';
                        npcChathead.style.height = 'auto';
                        baseObjectPositionX = 50;
                        baseObjectPositionY = 0;
                    } else { // Taller or square images
                        if (naturalHeight <= 90) { // Smallish square/tall, e.g., 85x89
                            npcChathead.style.height = '110px';
                            npcChathead.style.width = 'auto';
                            baseObjectPositionX = 50;
                            baseObjectPositionY = 0;
                        } else { // Taller, >90px
                            npcChathead.style.height = '130px';
                            npcChathead.style.width = 'auto';
                            baseObjectPositionX = 50;
                            baseObjectPositionY = objectPositionOffset;
                        }
                    }
                    baseTransformScale = 0.95; // Set base scale
                    applyChatheadTweaks(); // Apply tweakers after initial sizing/positioning
                };

                tempImg.onerror = () => {
                    if (imageLoaded) return; // If another image already loaded, ignore this error
                    tryLoadImage(index + 1); // Try the next variation
                };

                tempImg.src = chatheadUrl;
            };

            // Start trying from the first variation
            tryLoadImage(0);

        } else {
            npcChathead.style.display = 'none';
            npcNameDisplay.textContent = '';
            npcChathead.src = ''; // Clear src
            npcChathead.style.width = 'auto'; // Reset styles when no chathead
            npcChathead.style.height = 'auto';
            npcChathead.style.objectPosition = '50% 50%'; // Reset object-position
            npcChathead.style.transform = 'none'; // Reset transform
        }

        dialogTextDisplay.textContent = dialogText;
        continueText.style.display = 'block';

        // Calculate margin-bottom based on number of lines
        const numberOfLines = dialogText.split('\n').length;
        const baseMarginBottom = 18; // Base margin for 1 line
        const calculatedMarginBottom = baseMarginBottom / numberOfLines;
        
        npcNameDisplay.style.marginBottom = `${calculatedMarginBottom}px`;
        dialogTextDisplay.style.marginBottom = `${calculatedMarginBottom}px`;
    }

    function applyChatheadTweaks() {
        const chatheadX = parseFloat(chatheadXInput.value);
        const chatheadY = parseFloat(chatheadYInput.value);
        const chatheadScale = parseFloat(chatheadScaleInput.value);

        // If image is not loaded yet, return. Tweaks will be applied on image.onload
        if (!npcChathead.complete || npcChathead.naturalWidth === 0) {
            return;
        }
        
        // Recalculate base sizing and positioning based on npcChathead's current dimensions
        let objectPositionOffset;
        const naturalHeight = npcChathead.naturalHeight;
        const naturalWidth = npcChathead.naturalWidth;

        const heightMin = 90;
        const offsetMin = -15;
        const heightMax = 130;
        const offsetMax = -20;

        if (naturalHeight <= heightMin) {
            objectPositionOffset = offsetMin;
        } else if (naturalHeight >= heightMax) {
            objectPositionOffset = offsetMax;
        } else {
            objectPositionOffset = offsetMin + (naturalHeight - heightMin) * (offsetMax - offsetMin) / (heightMax - heightMin);
        }

        if (naturalWidth > naturalHeight) {
            npcChathead.style.width = '130px';
            npcChathead.style.height = 'auto';
            baseObjectPositionX = 50;
            baseObjectPositionY = 0;
        } else { // Taller or square images
            if (naturalHeight <= 90) { // Smallish square/tall, e.g., 85x89
                npcChathead.style.height = '110px';
                npcChathead.style.width = 'auto';
                baseObjectPositionX = 50;
                baseObjectPositionY = 0;
            } else { // Taller, >90px
                npcChathead.style.height = '130px';
                npcChathead.style.width = 'auto';
                baseObjectPositionX = 50;
                baseObjectPositionY = objectPositionOffset;
            }
        }
        baseTransformScale = 0.95; // Set base scale

        // Apply user tweaks as offsets/multipliers to these base values
        npcChathead.style.objectPosition = `calc(${baseObjectPositionX}% + ${chatheadX}px) calc(${baseObjectPositionY}px + ${chatheadY}px)`;
        npcChathead.style.transform = `scale(${baseTransformScale * chatheadScale})`;
    }

    // Event Listeners
    npcNameInput.addEventListener('input', updateDialogContent);
    dialogTextInput.addEventListener('input', updateDialogContent);
    scaleInput.addEventListener('input', updatePanel);
    chatheadXInput.addEventListener('input', applyChatheadTweaks);
    chatheadYInput.addEventListener('input', applyChatheadTweaks);
    chatheadScaleInput.addEventListener('input', applyChatheadTweaks);


    const saveButton = document.getElementById('saveButton');
    saveButton.addEventListener('click', async () => {
        updateDialogContent(); // Ensure latest content and styles are applied

        const panelToSave = document.getElementById('panel');
        const scale = parseFloat(scaleInput.value);

        // Wait for the chathead image to load if it's not already complete
        await new Promise(resolve => {
            if (npcChathead.complete && npcChathead.naturalWidth > 0) {
                resolve();
            } else {
                npcChathead.onload = () => resolve();
                npcChathead.onerror = () => resolve();
            }
        });

        try {
            // Clone the panel so we don't modify the live DOM
            const clone = panelToSave.cloneNode(true);
            clone.style.position = 'absolute';
            clone.style.left = '-9999px';
            clone.style.top = '0px';
            clone.style.transform = 'none';
            clone.style.transformOrigin = 'top left';
            clone.style.width = panelToSave.style.width;
            clone.style.height = panelToSave.style.height;
            document.body.appendChild(clone);

            // Ensure the shadow-overlay doesn't take flex space in the clone
            // (dom-to-image can mishandle position:absolute inside flex containers)
            const cloneShadow = clone.querySelector('.shadow-overlay');
            if (cloneShadow) {
                cloneShadow.style.position = 'absolute';
                cloneShadow.style.top = '0';
                cloneShadow.style.left = '0';
                cloneShadow.style.right = '0';
                cloneShadow.style.bottom = '0';
                cloneShadow.style.width = '100%';
                cloneShadow.style.height = '100%';
            }

            await inlineBackgroundImages(clone);
            await inlineImgElements(clone);
            await document.fonts.ready;
            await new Promise(r => requestAnimationFrame(r));

            const captureWidth = clone.offsetWidth;
            const captureHeight = clone.offsetHeight;

            // Capture at 1x natural size
            const dataUrl = await domtoimage.toPng(clone, {
                width: captureWidth,
                height: captureHeight,
                style: {
                    'image-rendering': 'pixelated'
                }
            });

            document.body.removeChild(clone);

            // Scale up via canvas for crisp pixel scaling
            const targetWidth = captureWidth * scale;
            const targetHeight = captureHeight * scale;

            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                const link = document.createElement('a');
                const npcName = npcNameInput.value.trim();
                const dialogText = dialogTextInput.value.trim();
                const filename = `${npcName}_${dialogText.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_')}.png`;
                link.download = filename;
                link.href = canvas.toDataURL('image/png');
                link.click();
            };
            img.src = dataUrl;
        } catch (error) {
            console.error('Error saving dialog panel:', error);
        }
    });

    // Initial update
    updatePanel();
});