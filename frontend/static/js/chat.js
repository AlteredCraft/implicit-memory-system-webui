/**
 * Chat functionality with HTTP streaming
 */

let currentAssistantMessage = null;
let isStreaming = false;

/**
 * Set up chat event listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');

    // Send message on button click
    sendButton.addEventListener('click', sendMessage);

    // Send message on Enter key (Shift+Enter for new line)
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});

/**
 * Send a chat message
 */
async function sendMessage() {
    if (!AppState.sessionActive) {
        addSystemMessage('Session not initialized. Please configure settings first.', 'warning');
        return;
    }

    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();

    if (!message || isStreaming) {
        return;
    }

    // Clear input
    userInput.value = '';
    userInput.disabled = true;
    document.getElementById('sendButton').disabled = true;
    isStreaming = true;

    // Add user message to chat
    addUserMessage(message);

    // Create assistant message placeholder
    currentAssistantMessage = createAssistantMessage();

    try {
        // Send message and stream response
        const response = await fetch(`${API_BASE}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Read streaming response
        await readStreamingResponse(response);

    } catch (error) {
        console.error('Chat error:', error);
        addSystemMessage(`Error: ${error.message}`, 'danger');
    } finally {
        // Re-enable input
        userInput.disabled = false;
        document.getElementById('sendButton').disabled = false;
        userInput.focus();
        isStreaming = false;
        currentAssistantMessage = null;
    }
}

/**
 * Read and process streaming response (Server-Sent Events)
 */
async function readStreamingResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            // Decode chunk
            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE events
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data.trim()) {
                        try {
                            const event = JSON.parse(data);
                            handleStreamEvent(event);
                        } catch (e) {
                            console.error('Failed to parse event:', data, e);
                        }
                    }
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Handle a stream event from the backend
 */
function handleStreamEvent(event) {
    switch (event.type) {
        case 'text':
            // Append text chunk to current message
            appendToAssistantMessage(event.data);
            break;

        case 'tool_use_start':
            // Show tool use indicator
            addToolUseIndicator(event.data.tool);
            break;

        case 'done':
            // Final event with token stats
            updateTokenDisplay(event.data.tokens);
            removeTypingIndicator();
            break;

        case 'error':
            // Error from backend
            addSystemMessage(`Error: ${event.data.message}`, 'danger');
            removeTypingIndicator();
            break;

        default:
            console.log('Unknown event type:', event);
    }
}

/**
 * Add user message to chat
 */
function addUserMessage(text) {
    const messagesEl = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-content">${escapeHtml(text)}</div>
    `;
    messagesEl.appendChild(messageDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Create assistant message placeholder
 */
function createAssistantMessage() {
    const messagesEl = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-header">
            <i class="bi bi-robot"></i> Claude
        </div>
        <div class="message-content"></div>
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    messagesEl.appendChild(messageDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return messageDiv;
}

/**
 * Append text to current assistant message
 */
function appendToAssistantMessage(text) {
    if (!currentAssistantMessage) return;

    const contentEl = currentAssistantMessage.querySelector('.message-content');
    contentEl.textContent += text;

    // Auto-scroll
    const messagesEl = document.getElementById('chatMessages');
    messagesEl.scrollTop = messagesEl.scrollHeight;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator() {
    if (!currentAssistantMessage) return;

    const indicator = currentAssistantMessage.querySelector('.typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

/**
 * Add tool use indicator
 */
function addToolUseIndicator(toolName) {
    if (!currentAssistantMessage) return;

    const contentEl = currentAssistantMessage.querySelector('.message-content');
    const toolDiv = document.createElement('div');
    toolDiv.className = 'tool-use mt-2';
    toolDiv.innerHTML = `<i class="bi bi-wrench"></i> Using tool: <strong>${escapeHtml(toolName)}</strong>`;

    // Insert before typing indicator
    const indicator = currentAssistantMessage.querySelector('.typing-indicator');
    if (indicator) {
        currentAssistantMessage.insertBefore(toolDiv, indicator);
    } else {
        currentAssistantMessage.appendChild(toolDiv);
    }

    // Auto-scroll
    const messagesEl = document.getElementById('chatMessages');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    // Also refresh memory view (tool likely modified memory)
    setTimeout(() => refreshMemoryFiles(), 500);
}

/**
 * Update token display
 */
function updateTokenDisplay(tokens) {
    const tokenDisplay = document.getElementById('tokenDisplay');
    tokenDisplay.textContent = `Tokens: ${tokens.total_input.toLocaleString()} in / ${tokens.total_output.toLocaleString()} out`;

    if (tokens.total_cache_read > 0) {
        tokenDisplay.textContent += ` | Cache: ${tokens.total_cache_read.toLocaleString()} read`;
    }
}
