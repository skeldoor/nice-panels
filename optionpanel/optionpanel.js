// Option Panel Creator - Main JavaScript

// Color mapping for named colors
const colorMap = {
    'yellow': '#FFFF00',
    'white': '#FFFFFF',
    'blue': '#00ffff',
    'red': '#FF0000',
    'green': '#00FF00',
    'black': '#000000',
    'cyan': '#00FFFF',
    'magenta': '#FF00FF',
    'orange': '#FFA500',
    'purple': '#800080',
    'gray': '#808080',
    'grey': '#808080',
    'lime': '#00FF00',
    'navy': '#000080',
    'teal': '#008080',
    'maroon': '#800000',
    'olive': '#808000',
    'silver': '#C0C0C0',
    'aqua': '#00FFFF',
    'fuchsia': '#FF00FF'
};

// Store option lines data
let optionLines = [
    { text: 'Attack <col=yellow>Mind goblin</col>  <col=green>(level-69)</col>' },
    { text: 'Worship <col=#ff00ff>Zezima</col>  <col=red>(level-128)</col>' },
    { text: 'Walk here' },
    { text: 'Examine <col=blue>Skeldoor\'s sub button</col>' },
    { text: 'Cancel' }
];

let draggedIndex = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    renderOptionLinesControls();
    updatePanel();
    
    document.getElementById('addLineButton').addEventListener('click', addOptionLine);
    document.getElementById('saveButton').addEventListener('click', savePanelAsImage);
});

// Add new option line
function addOptionLine() {
    optionLines.push({ text: 'New Option' });
    renderOptionLinesControls();
    updatePanel();
}

// Remove option line
function removeOptionLine(index) {
    optionLines.splice(index, 1);
    renderOptionLinesControls();
    updatePanel();
}

// Update option line text
function updateOptionLineText(index, text) {
    optionLines[index].text = text;
    updatePanel();
}

// Render the controls for option lines
function renderOptionLinesControls() {
    const container = document.getElementById('optionLinesContainer');
    container.innerHTML = '';
    
    optionLines.forEach((line, index) => {
        const entry = document.createElement('div');
        entry.className = 'option-line-entry';
        entry.draggable = true;
        entry.dataset.index = index;
        
        entry.innerHTML = `
            <div class="drag-handle">⋮⋮</div>
            <div class="option-line-input-group">
                <textarea
                    placeholder="Enter option text (use &lt;col=COLOR&gt;text&lt;/col&gt; for colors)"
                    data-index="${index}"
                >${line.text}</textarea>
            </div>
            <div class="option-line-controls">
                <button class="remove-line-btn" data-index="${index}">Remove</button>
            </div>
        `;
        
        // Add event listeners
        const textarea = entry.querySelector('textarea');
        textarea.addEventListener('input', (e) => {
            updateOptionLineText(index, e.target.value);
        });
        
        const removeBtn = entry.querySelector('.remove-line-btn');
        removeBtn.addEventListener('click', () => removeOptionLine(index));
        
        // Drag and drop events
        entry.addEventListener('dragstart', handleDragStart);
        entry.addEventListener('dragover', handleDragOver);
        entry.addEventListener('drop', handleDrop);
        entry.addEventListener('dragend', handleDragEnd);
        entry.addEventListener('dragleave', handleDragLeave);
        
        container.appendChild(entry);
    });
}

// Drag and drop handlers
function handleDragStart(e) {
    draggedIndex = parseInt(e.currentTarget.dataset.index);
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const entry = e.currentTarget;
    if (entry.classList.contains('option-line-entry')) {
        entry.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    const targetIndex = parseInt(e.currentTarget.dataset.index);
    
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
        // Reorder the array
        const draggedItem = optionLines[draggedIndex];
        optionLines.splice(draggedIndex, 1);
        
        if (targetIndex > draggedIndex) {
            optionLines.splice(targetIndex - 1, 0, draggedItem);
        } else {
            optionLines.splice(targetIndex, 0, draggedItem);
        }
        
        renderOptionLinesControls();
        updatePanel();
    }
    
    e.currentTarget.classList.remove('drag-over');
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.option-line-entry').forEach(entry => {
        entry.classList.remove('drag-over');
    });
    draggedIndex = null;
}

// Parse color tags in text
function parseColorTags(text) {
    // Pattern to match <col=COLOR>text</col>
    const pattern = /<col=([^>]+)>([^<]*)<\/col>/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
        // Add text before the tag
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: text.substring(lastIndex, match.index),
                color: null
            });
        }
        
        // Add colored text
        const colorName = match[1].toLowerCase();
        const colorValue = colorMap[colorName] || colorName; // Try color map first, then treat as hex
        
        parts.push({
            type: 'colored',
            content: match[2],
            color: colorValue
        });
        
        lastIndex = pattern.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
        parts.push({
            type: 'text',
            content: text.substring(lastIndex),
            color: null
        });
    }
    
    // If no tags found, return the whole text as is
    if (parts.length === 0) {
        parts.push({
            type: 'text',
            content: text,
            color: null
        });
    }
    
    return parts;
}

// Render option line with color tags
function renderOptionLineWithColors(text, defaultColor) {
    const parts = parseColorTags(text);
    const container = document.createElement('div');
    container.className = 'option-line-text';
    
    parts.forEach(part => {
        if (part.type === 'colored') {
            const span = document.createElement('span');
            span.className = 'color-tag';
            span.textContent = part.content;
            span.style.color = part.color;
            container.appendChild(span);
        } else {
            const span = document.createElement('span');
            span.textContent = part.content;
            span.style.color = defaultColor;
            container.appendChild(span);
        }
    });
    
    return container;
}

// Update the panel display
function updatePanel() {
    const panel = document.getElementById('panel');
    const scale = parseInt(document.getElementById('scale').value);
    
    // Clear existing content
    panel.innerHTML = '';
    
    // Create header
    const header = document.createElement('div');
    header.className = 'option-panel-header';
    header.textContent = 'Choose Option';
    panel.appendChild(header);
    
    // Create lines container
    const container = document.createElement('div');
    container.className = 'option-lines-container';
    
    // Render each option line
    optionLines.forEach((line, index) => {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'option-line';
        lineDiv.style.color = '#FFFFFF';
        
        // Parse and render the text with color tags
        const renderedContent = renderOptionLineWithColors(line.text, '#FFFFFF');
        lineDiv.appendChild(renderedContent);
        
        container.appendChild(lineDiv);
    });
    
    panel.appendChild(container);
    
    // Auto-fit width based on content
    panel.style.width = 'auto';
    panel.style.height = 'auto';
    
    // Apply scale
    panel.style.transform = `scale(${scale})`;
    panel.style.transformOrigin = 'top center';
}

// Validation functions
function validateAndUpdateSize(value, minSize) {
    const numValue = parseInt(value) || minSize;
    return Math.max(numValue, minSize);
}

function updateMinimumSizes() {
    const scale = parseInt(document.getElementById('scale').value);
    const minSize = 64 * scale;
    
    const widthInput = document.getElementById('width');
    const heightInput = document.getElementById('height');
    
    widthInput.min = minSize;
    heightInput.min = minSize;
}

function validateInputSize(input) {
    const scale = parseInt(document.getElementById('scale').value);
    const minSize = 64 * scale;
    const validatedValue = validateAndUpdateSize(input.value, minSize);
    input.value = validatedValue;
}

// Inline background images for export
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

// Generate filename from first option
function generateFileName() {
    const firstLine = optionLines[0]?.text || 'option-panel';
    
    // Remove color tags for filename
    const cleanText = firstLine.replace(/<col=[^>]+>|<\/col>/g, '');
    
    let fileName = cleanText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    
    return (fileName || 'option-panel') + '.png';
}

// Save panel as image
async function savePanelAsImage() {
    const panel = document.getElementById('panel');
    const scale = parseInt(document.getElementById('scale').value);
    
    // Get the actual unscaled dimensions of the panel
    const unscaledRect = panel.getBoundingClientRect();
    const unscaledWidth = unscaledRect.width;
    const unscaledHeight = unscaledRect.height;
    
    // Create a temporary container positioned on screen but off-viewport
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = window.innerWidth + 'px';
    tempContainer.style.top = '0';
    tempContainer.style.width = unscaledWidth + 'px';
    tempContainer.style.height = unscaledHeight + 'px';
    tempContainer.style.overflow = 'hidden';
    tempContainer.style.backgroundColor = 'transparent';
    tempContainer.style.margin = '0';
    tempContainer.style.padding = '0';
    document.body.appendChild(tempContainer);
    
    // Clone the panel
    const clone = panel.cloneNode(true);
    clone.style.transform = `scale(${scale})`;
    clone.style.transformOrigin = 'top left';
    clone.style.margin = '0';
    clone.style.padding = '0';
    tempContainer.appendChild(clone);
    
    // Force layout
    tempContainer.offsetHeight;
    
    // Inline background images
    await inlineBackgroundImages(clone);
    
    // Wait for rendering
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Capture with dom-to-image using higher pixel ratio for crisper text
    // Use pixelRatio of scale to get proper resolution
    domtoimage.toPng(tempContainer, {
        cacheBust: true,
        pixelRatio: scale,
        style: {
            'image-rendering': 'crisp-edges'
        }
    }).then(function(dataUrl) {
        const link = document.createElement('a');
        link.download = generateFileName();
        link.href = dataUrl;
        link.click();
        document.body.removeChild(tempContainer);
    }).catch(function(error) {
        console.error('Error capturing panel:', error);
        document.body.removeChild(tempContainer);
    });
}

// Add pixelated rendering styles
const style = document.createElement('style');
style.textContent = `
    canvas {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        -ms-interpolation-mode: nearest-neighbor;
    }
`;
document.head.appendChild(style);
