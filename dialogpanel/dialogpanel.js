document.addEventListener('DOMContentLoaded', () => {
    const npcNameInput = document.getElementById('npcNameInput');
    const dialogTextInput = document.getElementById('dialogTextInput');
    const generateDialogButton = document.getElementById('generateDialog');
    const npcChathead = document.getElementById('npc-chathead');
    const npcNameDisplay = document.getElementById('npc-name');
    const dialogTextDisplay = document.getElementById('dialog-text');
    const continueText = document.getElementById('continue-text');

    const scaleInput = document.getElementById('scale');
    const frameTypeSelect = document.getElementById('frameType');
    const panel = document.getElementById('panel');
    const content = panel.querySelector('.content');

    function updatePanel() {
        const scale = parseInt(scaleInput.value);
        const baseSize = 32; // Base size for corners and edges
        const scaledSize = baseSize * scale;
        const borderDepth = 6 * scale; // This is an approximation from infobox.js

        // Update panel dimensions (these can be fixed or dynamic, for now fixed to fit content)
        // We'll let the content dictate the size, and the panel will wrap around it.
        // For a dialog box, we might want a fixed width and dynamic height.
        const panelWidth = 600; // Example fixed width
        panel.style.width = `${panelWidth * scale}px`;
        // Height will be determined by content, so we won't set a fixed height on panel initially.

        // Update content size and position
        content.style.top = `${borderDepth}px`;
        content.style.left = `${borderDepth}px`;
        content.style.right = `${borderDepth}px`;
        content.style.bottom = `${borderDepth}px`;
        content.style.padding = `${borderDepth}px`;
        content.style.backgroundColor = '#CBBA95'; // Default background color

        // Update corners
        const corners = panel.querySelectorAll('.corner');
        corners.forEach(corner => {
            corner.style.width = `${scaledSize}px`;
            corner.style.height = `${scaledSize}px`;
        });

        // Update horizontal edges (top and bottom)
        const topBottom = panel.querySelectorAll('.edge.top, .edge.bottom');
        topBottom.forEach(edge => {
            edge.style.left = `${scaledSize}px`;
            edge.style.right = `${scaledSize}px`;
            edge.style.height = `${scaledSize}px`;
            edge.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
        });

        // Update vertical edges (left and right)
        const leftRight = panel.querySelectorAll('.edge.left, .edge.right');
        leftRight.forEach(edge => {
            edge.style.top = `${scaledSize}px`;
            edge.style.bottom = `${scaledSize}px`;
            edge.style.left = `${scaledSize}px`; // Corrected for left edge
            edge.style.width = `${scaledSize}px`;
            edge.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
        });

        updateFrameType();
        updateDialogContent(); // Call this to update dialog specific content
    }

    function updateFrameType() {
        const frameType = frameTypeSelect.value;
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
    frameTypeSelect.addEventListener('change', updatePanel);

    // Initial update
    updatePanel();
});