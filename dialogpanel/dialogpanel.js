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
        panel.style.transformOrigin = 'top left'; // Ensure scaling originates from top-left

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
        const words = name.split(' ');
        const variations = new Set(); // Use a Set to store unique variations

        // Always include the original name
        variations.add(words.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' '));

        // Generate variations by lowercasing subsequent words
        for (let i = 1; i < words.length; i++) {
            const tempWords = [...words];
            tempWords[i] = tempWords[i].charAt(0).toLowerCase() + tempWords[i].slice(1).toLowerCase();
            variations.add(tempWords.map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word).join(' '));
        }
        
        // Add a fully lowercased version (except first word)
        const lowercasedWords = words.map((word, index) => index === 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word.toLowerCase());
        variations.add(lowercasedWords.join(' '));

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

                const img = new Image();
                img.onload = () => {
                    if (imageLoaded) return; // Prevent multiple loads if a previous one was slow

                    imageLoaded = true;
                    npcChathead.src = chatheadUrl;
                    npcChathead.alt = `${currentNpcName} Chathead`;

                    let objectPositionOffset;
                    const naturalHeight = img.naturalHeight;

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

                    // Initial Sizing (before custom scale) and object-position
                    if (img.naturalWidth > naturalHeight) {
                        npcChathead.style.width = '130px';
                        npcChathead.style.height = 'auto';
                        // For wider images, object-position Y is 0
                        npcChathead.style.objectPosition = '50% 0px';
                    } else { // Taller or square images
                        if (naturalHeight <= 90) { // Smallish square/tall, e.g., 85x89
                            npcChathead.style.height = '110px';
                            npcChathead.style.width = 'auto';
                            npcChathead.style.objectPosition = '50% 0px';
                        } else { // Taller, >90px
                            npcChathead.style.height = '130px';
                            npcChathead.style.width = 'auto';
                            // Linear interpolation for object-position (vertical)
                            const heightMin = 90;
                            const offsetMin = -15;
                            const heightMax = 130;
                            const offsetMax = -20;

                            let objectPositionOffset;
                            if (naturalHeight <= heightMin) {
                                objectPositionOffset = offsetMin;
                            } else if (naturalHeight >= heightMax) {
                                objectPositionOffset = offsetMax;
                            } else {
                                objectPositionOffset = offsetMin + (naturalHeight - heightMin) * (offsetMax - offsetMin) / (heightMax - heightMin);
                            }
                            npcChathead.style.objectPosition = `50% ${objectPositionOffset}px`;
                        }
                    }
                    applyChatheadTweaks(); // Apply tweakers after initial sizing/positioning
                };

                img.onerror = () => {
                    if (imageLoaded) return; // If another image already loaded, ignore this error
                    tryLoadImage(index + 1); // Try the next variation
                };

                img.src = chatheadUrl;
            };

            tryLoadImage(0); // Start trying from the first variation

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
    }

    function applyChatheadTweaks() {
        const chatheadX = parseFloat(chatheadXInput.value);
        const chatheadY = parseFloat(chatheadYInput.value);
        const chatheadScale = parseFloat(chatheadScaleInput.value);

        // Get current object-position to apply X/Y tweakers
        const currentObjectPosition = npcChathead.style.objectPosition || '50% 50%';
        const currentX = parseFloat(currentObjectPosition.split(' ')[0].replace('calc(50% + ', '').replace('px)', '')) || 0;
        const currentY = parseFloat(currentObjectPosition.split(' ')[1].replace('px', '')) || 0;

        // Apply tweakers
        npcChathead.style.objectPosition = `calc(50% + ${currentX + chatheadX}px) ${currentY + chatheadY}px`;
        npcChathead.style.transform = `scale(${chatheadScale})`;
    }

    // Event Listeners
    npcNameInput.addEventListener('input', updateDialogContent);
    dialogTextInput.addEventListener('input', updateDialogContent);
    scaleInput.addEventListener('input', updatePanel);
    chatheadXInput.addEventListener('input', () => applyChatheadTweaks(npcChathead.naturalWidth, npcChathead.naturalHeight));
    chatheadYInput.addEventListener('input', () => applyChatheadTweaks(npcChathead.naturalWidth, npcChathead.naturalHeight));
    chatheadScaleInput.addEventListener('input', () => applyChatheadTweaks(npcChathead.naturalWidth, npcChathead.naturalHeight));


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
                npcChathead.onerror = () => resolve(); // Resolve even on error to not block save
            }
        });

        // Temporarily reset scale for dom-to-image to capture at 1x, then scale up
        const originalTransform = panelToSave.style.transform;
        const originalTransformOrigin = panelToSave.style.transformOrigin;

        // Get the natural dimensions (1x scale)
        const naturalWidth = 518;
        const naturalHeight = 141;

        // Calculate the scaled dimensions
        const targetWidth = naturalWidth * scale;
        const targetHeight = naturalHeight * scale;

        // Apply scale directly to the panel for dom-to-image capture
        panelToSave.style.transform = 'scale(1)'; // Reset transform for capture
        panelToSave.style.width = `${targetWidth}px`;
        panelToSave.style.height = `${targetHeight}px`;
        panelToSave.style.transformOrigin = 'top left';

        domtoimage.toPng(panelToSave, {
            width: targetWidth,
            height: targetHeight,
            style: {
                'transform': 'scale(1)', // Ensure dom-to-image renders at 1x of its given dimensions
                'transform-origin': 'top left'
            }
        })
        .then(function (dataUrl) {
            const link = document.createElement('a');
            link.download = 'dialog-panel.png';
            link.href = dataUrl;
            link.click();
        })
        .catch(function (error) {
            console.error('oops, something went wrong!', error);
        })
        .finally(() => {
            // Restore original styles
            panelToSave.style.transform = originalTransform;
            panelToSave.style.width = `${naturalWidth}px`; // Restore original 1x width
            panelToSave.style.height = `${naturalHeight}px`; // Restore original 1x height
            panelToSave.style.transformOrigin = originalTransformOrigin;
        });
    });

    // Initial update
    updatePanel();
});