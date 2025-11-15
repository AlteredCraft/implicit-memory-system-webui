/**
 * Main application logic for Memory System v2 Web UI
 */

// Global state
const AppState = {
    sessionActive: false,
    apiKey: localStorage.getItem('anthropic_api_key') || '',
    model: localStorage.getItem('anthropic_model') || 'claude-sonnet-4-5-20250929',
    systemPromptFile: localStorage.getItem('system_prompt_file') || '',
    availablePrompts: []
};

// API base URL
const API_BASE = window.location.origin;

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('Initializing Memory System v2 Web UI...');

    // Load available prompts
    await loadAvailablePrompts();

    // Check if we have saved settings
    if (AppState.apiKey && AppState.systemPromptFile) {
        // Auto-initialize session
        await initializeSession();
    } else {
        // Show settings modal on first load
        const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
        settingsModal.show();
    }

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    refreshMemoryFiles();
    refreshSessions();
}

/**
 * Load available system prompts
 */
async function loadAvailablePrompts() {
    try {
        const response = await fetch(`${API_BASE}/api/prompts`);
        const data = await response.json();
        AppState.availablePrompts = data.prompts;

        // Populate prompt select
        const promptSelect = document.getElementById('promptSelect');
        promptSelect.innerHTML = '';

        data.prompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.path;
            option.textContent = prompt.name;
            if (prompt.path === AppState.systemPromptFile) {
                option.selected = true;
            }
            promptSelect.appendChild(option);
        });

        // Auto-select first prompt if none selected
        if (!AppState.systemPromptFile && data.prompts.length > 0) {
            AppState.systemPromptFile = data.prompts[0].path;
            localStorage.setItem('system_prompt_file', AppState.systemPromptFile);
        }
    } catch (error) {
        console.error('Failed to load prompts:', error);
    }
}

/**
 * Initialize a new session with the backend
 */
async function initializeSession() {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.innerHTML = '<i class="bi bi-circle-fill"></i> Initializing...';
    statusEl.className = 'badge bg-warning';

    try {
        const response = await fetch(`${API_BASE}/api/session/initialize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                api_key: AppState.apiKey,
                model: AppState.model,
                system_prompt_file: AppState.systemPromptFile
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to initialize session');
        }

        const data = await response.json();
        AppState.sessionActive = true;

        statusEl.innerHTML = '<i class="bi bi-circle-fill"></i> Connected';
        statusEl.className = 'badge bg-success connected';

        // Enable chat input
        document.getElementById('userInput').disabled = false;
        document.getElementById('sendButton').disabled = false;

        console.log('Session initialized:', data);
        addSystemMessage('Session initialized successfully. Start chatting!');
    } catch (error) {
        console.error('Failed to initialize session:', error);
        statusEl.innerHTML = '<i class="bi bi-circle-fill"></i> Error';
        statusEl.className = 'badge bg-danger error';

        addSystemMessage(`Failed to initialize: ${error.message}`, 'danger');
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Settings modal
    document.getElementById('saveSettings').addEventListener('click', async () => {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const model = document.getElementById('modelSelect').value;
        const promptFile = document.getElementById('promptSelect').value;

        if (!apiKey) {
            showSettingsError('API key is required');
            return;
        }

        if (!promptFile) {
            showSettingsError('System prompt is required');
            return;
        }

        // Save to state and localStorage
        AppState.apiKey = apiKey;
        AppState.model = model;
        AppState.systemPromptFile = promptFile;

        localStorage.setItem('anthropic_api_key', apiKey);
        localStorage.setItem('anthropic_model', model);
        localStorage.setItem('system_prompt_file', promptFile);

        // Initialize session
        await initializeSession();

        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
        modal.hide();

        // Clear chat on new session
        clearChatMessages();
    });

    // Populate settings modal when opened
    document.getElementById('settingsModal').addEventListener('show.bs.modal', () => {
        document.getElementById('apiKeyInput').value = AppState.apiKey;
        document.getElementById('modelSelect').value = AppState.model;
        // Prompts already loaded
    });

    // Memory refresh button
    document.getElementById('refreshMemory').addEventListener('click', refreshMemoryFiles);

    // Clear memory button
    document.getElementById('clearMemory').addEventListener('click', async () => {
        if (!confirm('Are you sure you want to clear all memories? This cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/api/memory/clear`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Failed to clear memories');
            }

            const data = await response.json();
            addSystemMessage(data.message);
            refreshMemoryFiles();
            clearChatMessages();
        } catch (error) {
            console.error('Failed to clear memories:', error);
            addSystemMessage(`Error: ${error.message}`, 'danger');
        }
    });

    // Sessions refresh button
    document.getElementById('refreshSessions').addEventListener('click', refreshSessions);
}

/**
 * Show error in settings modal
 */
function showSettingsError(message) {
    const errorEl = document.getElementById('settingsError');
    errorEl.textContent = message;
    errorEl.classList.remove('d-none');

    setTimeout(() => {
        errorEl.classList.add('d-none');
    }, 5000);
}

/**
 * Add a system message to chat
 */
function addSystemMessage(text, type = 'info') {
    const messagesEl = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message system alert alert-${type}`;
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    messagesEl.appendChild(messageDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Clear all chat messages
 */
function clearChatMessages() {
    document.getElementById('chatMessages').innerHTML = '';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format timestamp
 */
function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    return date.toLocaleString();
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
