
class PanelManager {
    constructor() {
        this.currentPanel = null;
        this.panelTypes = new Map();
        this.init();
    }

    init() {
        this.registerPanelTypes();
        this.setupUI();
        this.loadDefaultPanel();
    }

    registerPanelTypes() {
        // Register all available panel types
        this.panelTypes.set('dialog', new DialogPanel());
        this.panelTypes.set('itemframe', new ItemFramePanel());
        // Add more panel types here as you create them
    }

    setupUI() {
        // Create panel type selector dropdown
        const controlsDiv = document.querySelector('.panel-controls');
        const panelSelector = document.createElement('div');
        panelSelector.innerHTML = `
            <label>Panel Type: 
                <select id="panelTypeSelector">
                    <option value="dialog">Dialog Style</option>
                    <option value="itemframe">Item Frame Style</option>
                </select>
            </label>
            <br><br>
        `;
        controlsDiv.insertBefore(panelSelector, controlsDiv.firstChild);

        // Add event listener for panel type changes
        document.getElementById('panelTypeSelector').addEventListener('change', (e) => {
            this.switchPanelType(e.target.value);
        });
    }

    switchPanelType(panelType) {
        // Clean up current panel
        if (this.currentPanel) {
            this.currentPanel.cleanup();
        }

        // Load new panel type
        const PanelClass = this.panelTypes.get(panelType);
        if (PanelClass) {
            this.currentPanel = PanelClass;
            this.currentPanel.initialize();
        }
    }

    loadDefaultPanel() {
        this.switchPanelType('dialog');
    }
}

// Initialize the panel manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.panelManager = new PanelManager();
});