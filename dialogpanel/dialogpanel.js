document.addEventListener('DOMContentLoaded', () => {
    const npcNameInput = document.getElementById('npcNameInput');
    const dialogTextInput = document.getElementById('dialogTextInput');
    const generateDialogButton = document.getElementById('generateDialog');
    const npcChathead = document.getElementById('npc-chathead');
    const npcNameDisplay = document.getElementById('npc-name');
    const dialogTextDisplay = document.getElementById('dialog-text');
    const continueText = document.getElementById('continue-text');

    generateDialogButton.addEventListener('click', () => {
        const npcName = npcNameInput.value.trim();
        const dialogText = dialogTextInput.value.trim();

        if (npcName) {
            // Generate chathead URL
            // Assuming the wiki chathead URL format is consistent
            const chatheadUrl = `https://oldschool.runescape.wiki/images/${encodeURIComponent(npcName.replace(/ /g, '_'))}_chathead.png`;
            npcChathead.src = chatheadUrl;
            npcChathead.alt = `${npcName} Chathead`;
            npcChathead.style.display = 'block'; // Show chathead
            npcNameDisplay.textContent = npcName;
        } else {
            npcChathead.style.display = 'none'; // Hide chathead if no name
            npcNameDisplay.textContent = '';
        }

        dialogTextDisplay.textContent = dialogText;
        continueText.style.display = 'block'; // Always show continue text for now
    });
});