document.addEventListener('DOMContentLoaded', () => {
    const npcNameInput = document.getElementById('npcNameInput');
    const dialogTextInput = document.getElementById('dialogTextInput');
    const generateDialogButton = document.getElementById('generateDialog');
    const npcChathead = document.getElementById('npc-chathead');
    const npcNameDisplay = document.getElementById('npc-name');
    const dialogTextDisplay = document.getElementById('dialog-text');
    const continueText = document.getElementById('continue-text');

    const scaleInput = document.getElementById('scale');
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

    function updateDialogContent() {
        const npcName = npcNameInput.value.trim();
        const dialogText = dialogTextInput.value.trim();

        if (npcName) {
            const chatheadUrl = `https://oldschool.runescape.wiki/images/${encodeURIComponent(npcName.replace(/ /g, '_'))}_chathead.png`;
            npcChathead.src = chatheadUrl;
            npcChathead.alt = `${npcName} Chathead`;
            npcChathead.style.display = 'block';
            npcNameDisplay.textContent = npcName;
        } else {
            npcChathead.style.display = 'none';
            npcNameDisplay.textContent = '';
        }

        dialogTextDisplay.textContent = dialogText;
        continueText.style.display = 'block';
    }

    // Event Listeners
    generateDialogButton.addEventListener('click', updateDialogContent);
    npcNameInput.addEventListener('input', updateDialogContent);
    dialogTextInput.addEventListener('input', updateDialogContent);
    scaleInput.addEventListener('input', updatePanel);

    const saveButton = document.getElementById('saveButton');
    saveButton.addEventListener('click', () => {
        const panelToSave = document.getElementById('panel');
        const scale = parseFloat(scaleInput.value);

        // Temporarily reset scale for dom-to-image to capture at 1x, then scale up
        // Or, better, calculate the target width/height based on the current scale
        // and render at that size.
        const originalTransform = panelToSave.style.transform;
        const originalTransformOrigin = panelToSave.style.transformOrigin;

        // To capture the image at its scaled size, we need to apply the scale
        // directly to the width/height for dom-to-image, and remove the transform.
        // Get the natural dimensions (1x scale)
        const naturalWidth = 518;
        const naturalHeight = 141;

        // Calculate the scaled dimensions
        const targetWidth = naturalWidth * scale;
        const targetHeight = naturalHeight * scale;

        // Use a temporary div to render the scaled content without CSS transform
        // This is a workaround for dom-to-image not handling CSS transforms perfectly for output size
        const tempDiv = document.createElement('div');
        tempDiv.style.width = `${targetWidth}px`;
        tempDiv.style.height = `${targetHeight}px`;
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px'; // Move off-screen
        tempDiv.style.top = '-9999px';
        document.body.appendChild(tempDiv);

        // Clone the panel and append to tempDiv
        const panelClone = panelToSave.cloneNode(true);
        panelClone.style.transform = 'none'; // Remove transform from clone
        panelClone.style.width = `${targetWidth}px`; // Set clone to target dimensions
        panelClone.style.height = `${targetHeight}px`;
        panelClone.style.margin = '0'; // Remove margin to prevent extra space
        panelClone.style.position = 'static'; // Ensure it flows normally in tempDiv
        
        // Adjust content within the clone if necessary, to match the scaled appearance
        // This might involve re-calculating borderDepth and padding based on the new scale
        // For simplicity, we'll assume the internal elements scale correctly with the parent's width/height
        // or are handled by their own CSS rules.

        tempDiv.appendChild(panelClone);


        domtoimage.toPng(panelClone, {
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
            tempDiv.remove(); // Clean up the temporary div
        })
        .catch(function (error) {
            console.error('oops, something went wrong!', error);
            tempDiv.remove(); // Clean up the temporary div even on error
        });
    });

    // Initial update
    updatePanel();
});