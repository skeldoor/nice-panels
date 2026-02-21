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

function updateTextShadow(textElement, shadowCheckboxId) {
    const hasShadow = document.getElementById(shadowCheckboxId).checked;
    const fontSize = parseInt(document.getElementById(shadowCheckboxId.replace('TextShadow', 'FontSize')).value);
    const fontFamily = textElement.style.fontFamily;

    if (hasShadow) {
        let baseOffset = 1.5;
        const shadowOffset = (fontSize / 24) * baseOffset;
        const offsetStr = shadowOffset.toFixed(1);
        textElement.style.textShadow = `${offsetStr}px ${offsetStr}px 0px #000000`;
    } else {
        textElement.style.textShadow = 'none';
    }
}

function updateImageLayout() {
    const content = document.querySelector('.content');
    const imageContainer = document.querySelector('.panel-image-container');
    const image = document.getElementById('panelImage');
    const holderImg = imageContainer.querySelector('.item-holder');
    const position = document.getElementById('imagePosition').value;
    const requestedSize = parseInt(document.getElementById('imageSize').value);
    const holderSize = parseInt(document.getElementById('holderSize').value);
    const scale = parseInt(document.getElementById('scale').value);
    const showHolder = document.getElementById('showHolder').checked;

    // Remove hidden class from image first
    image.classList.remove('hidden');
    imageContainer.classList.remove('hidden');

    // Toggle holder image and its drop-shadow
    if (holderImg) {
        holderImg.style.display = showHolder ? 'block' : 'none';
        holderImg.style.filter = showHolder ? 'drop-shadow(5px 5px 0px rgba(0, 0, 0, 1))' : 'none';
    }

    if (position === 'none' || !image.src || image.src === window.location.href) {
        imageContainer.classList.add('hidden');
        content.style.flexDirection = 'column';
        return;
    }

    // Set the container size based on holder size
    const scaledHolderSize = holderSize * scale;
    imageContainer.style.width = `${scaledHolderSize}px`;
    imageContainer.style.height = `${scaledHolderSize}px`;

    // Set the image size
    const scaledImageSize = requestedSize * scale;
    image.style.width = `${scaledImageSize}px`;
    image.style.height = `${scaledImageSize}px`;

    // Set flex direction based on position
    switch (position) {
        case 'left':
            content.style.flexDirection = 'row';
            break;
        case 'right':
            content.style.flexDirection = 'row-reverse';
            break;
        case 'top':
            content.style.flexDirection = 'column';
            break;
        case 'bottom':
            content.style.flexDirection = 'column-reverse';
            break;
        default:
            content.style.flexDirection = 'row';
    }
}

function handleImageUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.getElementById('panelImage');
            img.src = e.target.result;
            document.getElementById('imageUrl').value = ''; // Clear URL input
            document.getElementById('imagePosition').value = 'right'; // Set default position

            // Create temporary image to get original dimensions
            const tempImg = new Image();
            tempImg.src = e.target.result;
            tempImg.onload = function() {
                updatePanel();
            };
        };
        reader.readAsDataURL(file);
    }
}

// Make sure we're handling image loading properly
function handleImageUrl(event) {
    const url = event.target.value.trim();
    if (url) {
        const img = document.getElementById('panelImage');
        img.src = url;
        document.getElementById('imageUpload').value = ''; // Clear file input

        // Error handling
        img.onerror = function() {
            console.error('Error loading image from URL');
            img.classList.add('hidden');
            updatePanel();
        };

        // Wait for image to load before updating panel
        img.onload = function() {
            updatePanel();
        };
    }
}

// Add this to the updatePanel function
function updatePanel() {
    const width = parseInt(document.getElementById('width').value);
    const height = parseInt(document.getElementById('height').value);
    const bgColor = document.getElementById('bgColor').value;
    const scale = parseInt(document.getElementById('scale').value);

    const baseSize = 32;
    const scaledSize = baseSize * scale;
    const borderDepth = 6 * scale;

    const panel = document.getElementById('panel');
    panel.style.width = `${width}px`;
    panel.style.height = `${height}px`;

    // Update content size and position
    const content = panel.querySelector('.content');
    content.style.top = `${borderDepth}px`;
    content.style.left = `${borderDepth}px`;
    content.style.right = `${borderDepth}px`;
    content.style.bottom = `${borderDepth}px`;
    content.style.padding = `${borderDepth}px`;
    content.style.backgroundColor = bgColor;

    // Update text properties for both text elements
    const primaryText = document.getElementById('primaryText').value;
    const secondaryText = document.getElementById('secondaryText').value;

    const primaryElement = panel.querySelector('.panel-text.primary');
    const secondaryElement = panel.querySelector('.panel-text.secondary');

    // Update primary text
    primaryElement.textContent = primaryText;
    primaryElement.style.fontFamily = document.getElementById('primaryFontSelect').value;
    primaryElement.style.fontSize = `${document.getElementById('primaryFontSize').value}px`;
    primaryElement.style.color = document.getElementById('primaryFontColor').value;
    updateTextShadow(primaryElement, 'primaryTextShadow');

    // Update secondary text
    secondaryElement.textContent = secondaryText;
    secondaryElement.style.fontFamily = document.getElementById('secondaryFontSelect').value;
    secondaryElement.style.fontSize = `${document.getElementById('secondaryFontSize').value}px`;
    secondaryElement.style.color = document.getElementById('secondaryFontColor').value;
    updateTextShadow(secondaryElement, 'secondaryTextShadow');

    // Show/hide secondary text based on content
    const secondaryRow = panel.querySelector('.panel-text-row.secondary');
    secondaryRow.style.display = secondaryText ? 'flex' : 'none';
    
    // Add this line to update the text icons
    updateTextIcons();
    
    // Adjust flex direction based on whether both texts are present
    const textContainer = panel.querySelector('.text-container');
    textContainer.style.justifyContent = secondaryText ? 'space-between' : 'center';

    // Add this line before updating corners
    updateImageLayout();
    
    // Call updateFrameType first to ensure frame is properly set
    updateFrameType();
    
    // Update border color
    handleBorderColorPreset();

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
        edge.style.width = `${scaledSize}px`;
        edge.style.backgroundSize = `${scaledSize}px ${scaledSize}px`;
    });
    
    // Add this line near the end of updatePanel
    updateCheckMark();
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function handleBorderColorPreset() {
    const preset = document.getElementById('borderColorPreset').value;
    const customColorInput = document.getElementById('borderCustomColor');
    const panel = document.getElementById('panel');

    if (preset === 'custom') {
        customColorInput.style.display = 'inline-block';
        const rgb = hexToRgb(customColorInput.value);
        const elements = panel.querySelectorAll('.corner, .edge');
        elements.forEach(el => {
            el.style.filter = calculateColorFilter(rgb);
        });
        return;
    }

    customColorInput.style.display = 'none';

    // Reset all filters first
    const elements = panel.querySelectorAll('.corner, .edge');
    elements.forEach(el => {
        if (preset === 'normal') {
            el.style.filter = 'none';
        } else {
            const rgb = hexToRgb(preset);
            const filter = calculateColorFilter(rgb);
            el.style.filter = filter;
        }
    });
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s, l };
}

function calculateColorFilter(rgb) {
    // Start with a strong grayscale and sepia to remove original colors
    let filter = 'grayscale(100%) sepia(100%) ';

    // Preset colours use hand-tuned values
    if (rgb.r == 143 && rgb.g == 87 && rgb.b == 87) {
        // Agile Red tint
        filter += 'hue-rotate(-48deg) saturate(260%) brightness(92%)';
    } else if (rgb.r == 89 && rgb.g == 143 && rgb.b == 87) {
        // Agile Green tint
        filter += 'hue-rotate(85deg) saturate(300%) brightness(90%)';
    } else if (rgb.r == 0 && rgb.g == 255 && rgb.b == 1) {
        // Josh Isn't Green tint
        filter += 'hue-rotate(90deg) saturate(1250%) brightness(100%)';
    } else if (rgb.r == 0 && rgb.g == 255 && rgb.b == 0) {
        // Green preset
        filter += 'hue-rotate(40deg) saturate(500%) brightness(100%)';
    } else if (rgb.r == 255 && rgb.g == 0 && rgb.b == 0) {
        // Red preset
        filter += 'hue-rotate(-30deg) saturate(300%) brightness(100%)';
    } else {
        // Custom colour - use HSL conversion
        const sepiaBaseHue = 50;
        const target = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const hueRotate = target.h - sepiaBaseHue;
        const saturate = target.s / 0.6;
        const brightness = target.l / 0.5;
        filter += `hue-rotate(${hueRotate.toFixed(1)}deg) saturate(${(saturate * 100).toFixed(0)}%) brightness(${(brightness * 100).toFixed(0)}%)`;
    }

    return filter;
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


function generateFileName() {
    const primaryText = document.getElementById('primaryText').value || 'panel';
    const secondaryText = document.getElementById('secondaryText').value;

    // Combine texts with a hyphen if secondary text exists
    let fileName = secondaryText
        ? `${primaryText}-${secondaryText}`
        : primaryText;

    // Convert to lowercase and replace special characters and spaces
    fileName = fileName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')    // Replace special chars with hyphen
        .replace(/^-+|-+$/g, '')        // Remove leading/trailing hyphens
        .replace(/-{2,}/g, '-');        // Replace multiple hyphens with single one

    return fileName + '.png';
}


async function savePanelAsImage() {
    const node = document.getElementById('panel');
    const imagePositionSelect = document.getElementById('imagePosition');
    const isNoImage = imagePositionSelect.value === 'none';

    // Always clone the panel so we never mutate the visible DOM
    // (inlineBackgroundImages rewrites background-image URLs in-place)
    const clonedNode = node.cloneNode(true);
    clonedNode.style.position = 'absolute';
    clonedNode.style.left = '-9999px';
    clonedNode.style.top = '-9999px';
    // Force overflow hidden so the SVG foreignObject render boundary
    // matches the panel dimensions — without this, absolutely-positioned
    // children (corners, edges) can be clipped in the export
    clonedNode.style.overflow = 'hidden';
    document.body.appendChild(clonedNode);

    if (isNoImage) {
        const clonedImageContainer = clonedNode.querySelector('.panel-image-container');
        const clonedContent = clonedNode.querySelector('.content');

        if (clonedImageContainer) {
            clonedImageContainer.remove();
        }
        clonedContent.style.flexDirection = 'column';
    }

    const cleanup = () => {
        document.body.removeChild(clonedNode);
    };

    // Inline CSS background images on the clone (not the original panel)
    await inlineBackgroundImages(clonedNode);

    // Use getBoundingClientRect for accurate rendered dimensions —
    // offsetWidth/scrollWidth can disagree when children are absolutely
    // positioned, leading dom-to-image to clip the right/bottom edges
    const rect = clonedNode.getBoundingClientRect();
    const captureWidth = Math.ceil(rect.width);
    const captureHeight = Math.ceil(rect.height);

    domtoimage.toPng(clonedNode, {
        cacheBust: true,
        width: captureWidth,
        height: captureHeight,
        style: {
            'image-rendering': 'pixelated',
        }
    }).then(function(dataUrl) {
        const link = document.createElement('a');
        link.download = generateFileName();
        link.href = dataUrl;
        link.click();
    }).catch(function(error) {
        console.error('Error capturing panel:', error);
    }).finally(() => {
        cleanup();
    });
}

const itemHolderImg = new Image();
itemHolderImg.src = '../resources/itemholder.png';




// Add these styles dynamically to ensure they're applied
const style = document.createElement('style');
style.textContent = `
    canvas {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
        -ms-interpolation-mode: nearest-neighbor;
    }
`;
document.head.appendChild(style);

function handleBgColorPreset() {
    const preset = document.getElementById('bgColorPreset');
    const colorInput = document.getElementById('bgColor');
    
    if (preset.value === 'custom') {
        colorInput.style.display = 'inline-block';
        colorInput.click(); // Open the color picker
    } else {
        colorInput.style.display = 'none';
        colorInput.value = preset.value;
        updatePanel(); // Update the panel with the new color
    }
}

// Add event listeners once the document is loaded
document.addEventListener('DOMContentLoaded', () => {
    const inputs = document.querySelectorAll('input:not([type="file"]), select, textarea');

    inputs.forEach(input => {
        // Update on input/change for immediate feedback
        input.addEventListener('input', () => {
            if (input.id === 'imageUrl') {
                handleImageUrl({ target: input });
            } else {
                updatePanel();
            }
        });

        // Update on Enter key
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                updatePanel();
                input.blur();
            }
        });
    });

    // Special handler for file upload
    document.getElementById('imageUpload').addEventListener('change', handleImageUpload);

    // Load initial image from URL input
    const imageUrlInput = document.getElementById('imageUrl');
    if (imageUrlInput.value) {
        handleImageUrl({ target: imageUrlInput });
    }

    // Initial panel update
    updatePanel();

    // Add click handler for save button
    document.getElementById('saveButton').addEventListener('click', savePanelAsImage);

});

// Add this to your existing color input event listener setup
document.getElementById('bgColor').addEventListener('change', function() {
    if (this.value !== document.getElementById('bgColorPreset').value) {
        document.getElementById('bgColorPreset').value = 'custom';
    }
    updatePanel();
});

// Make sure the save button is hooked up
document.getElementById('saveButton').addEventListener('click', savePanelAsImage);

function updateCheckMark() {
    const panel = document.getElementById('panel');
    const checkType = document.getElementById('checkType').value;
    const imagePosition = document.getElementById('imagePosition').value;
    const scale = parseInt(document.getElementById('scale').value);
    const checkSize = parseInt(document.getElementById('checkSize').value);
    
    // Remove existing check mark if any
    const existingCheck = panel.querySelector('.check-mark');
    if (existingCheck) {
        existingCheck.remove();
    }
    
    if (checkType === 'none') {
        return;
    }
    
    // Create new check mark
    const checkMark = document.createElement('img');
    checkMark.className = 'check-mark';
    checkMark.src = `/resources/check-${checkType}.png`;
    
    // Position on opposite side of the image
    let position;
    switch (imagePosition) {
        case 'left':
            position = 'right';
            break;
        case 'right':
            position = 'left';
            break;
        case 'top':
            position = 'right'; // Default to right for top/bottom image
            break;
        case 'bottom':
            position = 'right'; // Default to right for top/bottom image
            break;
        default:
            position = 'left';
    }
    
    checkMark.classList.add(position);
    
    // Apply scaling
    const scaledSize = checkSize * scale;
    const scaledOffset = 12 * scale;
    checkMark.style.width = `${scaledSize}px`;
    checkMark.style.height = `${scaledSize}px`;
    checkMark.style.top = `${scaledOffset}px`;
    
    if (position === 'left') {
        checkMark.style.left = `${scaledOffset}px`;
    } else {
        checkMark.style.right = `${scaledOffset}px`;
    }
    
    panel.appendChild(checkMark);
}

function updateTextIcons() {
    // Primary text icon
    const primaryIcon = document.querySelector('.primary-icon');
    const primaryIconType = document.getElementById('primaryTextIcon').value;
    const primaryIconPosition = document.getElementById('primaryIconPosition').value;
    const primaryFontSize = parseInt(document.getElementById('primaryFontSize').value);
    const primaryTextRow = document.querySelector('.panel-text-row.primary');
    
    // Remove all position classes first
    primaryTextRow.classList.remove('primary-right', 'primary-top', 'primary-bottom');
    
    if (primaryIconType !== 'none') {
        primaryIcon.src = `/resources/text-icons/${primaryIconType}.png`;
        primaryIcon.style.height = `${primaryFontSize}px`; // Scale icon to match text size
        primaryIcon.style.display = 'block';
        
        // Set position based on selection
        switch (primaryIconPosition) {
            case 'right':
                primaryTextRow.classList.add('primary-right');
                break;
            case 'top':
                primaryTextRow.classList.add('primary-top');
                break;
            case 'bottom':
                primaryTextRow.classList.add('primary-bottom');
                break;
            // 'left' is the default, no class needed
        }
    } else {
        primaryIcon.style.display = 'none';
    }
    
    // Secondary text icon
    const secondaryIcon = document.querySelector('.secondary-icon');
    const secondaryIconType = document.getElementById('secondaryTextIcon').value;
    const secondaryIconPosition = document.getElementById('secondaryIconPosition').value;
    const secondaryFontSize = parseInt(document.getElementById('secondaryFontSize').value);
    const secondaryTextRow = document.querySelector('.panel-text-row.secondary');
    
    // Remove all position classes first
    secondaryTextRow.classList.remove('secondary-right', 'secondary-top', 'secondary-bottom');
    
    if (secondaryIconType !== 'none') {
        secondaryIcon.src = `/resources/text-icons/${secondaryIconType}.png`;
        secondaryIcon.style.height = `${secondaryFontSize}px`; // Scale icon to match text size
        secondaryIcon.style.display = 'block';
        
        // Set position based on selection
        switch (secondaryIconPosition) {
            case 'right':
                secondaryTextRow.classList.add('secondary-right');
                break;
            case 'top':
                secondaryTextRow.classList.add('secondary-top');
                break;
            case 'bottom':
                secondaryTextRow.classList.add('secondary-bottom');
                break;
            // 'left' is the default, no class needed
        }
    } else {
        secondaryIcon.style.display = 'none';
    }
}
// Add these to your existing event listeners
document.getElementById('primaryTextIcon').addEventListener('change', updatePanel);
document.getElementById('primaryIconPosition').addEventListener('change', updatePanel);
document.getElementById('secondaryTextIcon').addEventListener('change', updatePanel);
document.getElementById('secondaryIconPosition').addEventListener('change', updatePanel);
document.getElementById('frameType').addEventListener('change', function() {
    updateFrameType();
});


function updateFrameType() {
    const frameType = document.getElementById('frameType').value;
    const panel = document.getElementById('panel');
    
    // Define the path based on selected frame type
    let framePath = `/resources/frames/${frameType}/`;
    
    // Update corner background images
    const cornerTL = panel.querySelector('.corner.tl');
    const cornerTR = panel.querySelector('.corner.tr');
    const cornerBL = panel.querySelector('.corner.bl');
    const cornerBR = panel.querySelector('.corner.br');
    
    cornerTL.style.backgroundImage = `url('${framePath}tl.png')`;
    cornerTR.style.backgroundImage = `url('${framePath}tr.png')`;
    cornerBL.style.backgroundImage = `url('${framePath}bl.png')`;
    cornerBR.style.backgroundImage = `url('${framePath}br.png')`;
    
    // Update edge background images
    const edgeTop = panel.querySelector('.edge.top');
    const edgeBottom = panel.querySelector('.edge.bottom');
    const edgeLeft = panel.querySelector('.edge.left');
    const edgeRight = panel.querySelector('.edge.right');
    
    edgeTop.style.backgroundImage = `url('${framePath}t.png')`;
    edgeBottom.style.backgroundImage = `url('${framePath}b.png')`;
    edgeLeft.style.backgroundImage = `url('${framePath}l.png')`;
    edgeRight.style.backgroundImage = `url('${framePath}r.png')`;
    
    // DO NOT call updatePanel() here to avoid the infinite loop
}