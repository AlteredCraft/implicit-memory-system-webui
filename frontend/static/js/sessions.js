/**
 * Sessions dashboard functionality
 */

let currentSessions = [];
let currentSessionId = null;

/**
 * Refresh sessions list
 */
async function refreshSessions() {
    try {
        // Fetch sessions list
        const sessionsResponse = await fetch(`${API_BASE}/api/sessions`);
        const sessionsData = await sessionsResponse.json();
        currentSessions = sessionsData.sessions || [];

        // Fetch current session ID
        const currentResponse = await fetch(`${API_BASE}/api/session/current`);
        const currentData = await currentResponse.json();
        currentSessionId = currentData.session_id;

        renderSessionsList();
    } catch (error) {
        console.error('Failed to load sessions:', error);
        document.getElementById('sessionsList').innerHTML = `
            <div class="alert alert-danger">
                Failed to load sessions: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

/**
 * Render sessions list
 */
function renderSessionsList() {
    const sessionsList = document.getElementById('sessionsList');

    if (currentSessions.length === 0) {
        sessionsList.innerHTML = `
            <div class="text-muted text-center p-4">
                <i class="bi bi-journal-text fs-1"></i>
                <p class="mt-2">No sessions recorded yet</p>
                <small>Session traces are automatically saved when you chat</small>
            </div>
        `;
        return;
    }

    const listHtml = currentSessions.map(session => {
        const startTime = formatTimestamp(session.start_time);
        const endTime = session.end_time ? formatTimestamp(session.end_time) : 'In progress';
        const duration = calculateDuration(session.start_time, session.end_time);
        const isActive = session.id === currentSessionId;

        return `
            <div class="session-item list-group-item list-group-item-action ${isActive ? 'border-primary' : ''}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="fw-bold mb-1">
                            <i class="bi bi-journal-text"></i> ${escapeHtml(session.id)}
                            ${isActive ? '<span class="badge bg-success ms-2">Active</span>' : ''}
                        </div>
                        <div class="small text-muted mb-2">
                            <div><i class="bi bi-calendar"></i> ${startTime}</div>
                            <div><i class="bi bi-clock"></i> Duration: ${duration}</div>
                            <div><i class="bi bi-cpu"></i> Model: ${escapeHtml(session.model)}</div>
                            <div>
                                <i class="bi bi-chat"></i> ${session.event_count} events |
                                <i class="bi bi-speedometer2"></i> ${session.total_tokens.toLocaleString()} tokens
                            </div>
                        </div>
                        <div class="btn-group btn-group-sm">
                            <button class="btn btn-outline-primary view-session-btn" data-id="${escapeHtml(session.id)}">
                                <i class="bi bi-eye"></i> View Details
                            </button>
                            <button class="btn btn-outline-secondary generate-diagram-btn" data-id="${escapeHtml(session.id)}">
                                <i class="bi bi-diagram-3"></i> View Diagram
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    sessionsList.innerHTML = listHtml;

    // Add click handlers
    sessionsList.querySelectorAll('.view-session-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sessionId = btn.getAttribute('data-id');
            viewSessionDetails(sessionId);
        });
    });

    sessionsList.querySelectorAll('.generate-diagram-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const sessionId = btn.getAttribute('data-id');
            generateDiagram(sessionId);
        });
    });
}

/**
 * Calculate duration between two timestamps
 */
function calculateDuration(startTime, endTime) {
    if (!startTime) return 'Unknown';
    if (!endTime) return 'In progress';

    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end - start;

    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
}

/**
 * View session details
 */
async function viewSessionDetails(sessionId) {
    try {
        const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const session = await response.json();

        // Create details HTML
        const detailsHtml = `
            <div class="mb-3">
                <h6>Session Information</h6>
                <table class="table table-sm">
                    <tr>
                        <th>Session ID:</th>
                        <td>${escapeHtml(session.session_id)}</td>
                    </tr>
                    <tr>
                        <th>Model:</th>
                        <td>${escapeHtml(session.model)}</td>
                    </tr>
                    <tr>
                        <th>Start Time:</th>
                        <td>${formatTimestamp(session.start_time)}</td>
                    </tr>
                    <tr>
                        <th>End Time:</th>
                        <td>${session.end_time ? formatTimestamp(session.end_time) : 'In progress'}</td>
                    </tr>
                    <tr>
                        <th>Events:</th>
                        <td>${session.events.length}</td>
                    </tr>
                </table>
            </div>

            <div class="mb-3">
                <h6>System Prompt</h6>
                <pre class="border rounded p-2 bg-light" style="max-height: 200px; overflow-y: auto;">${escapeHtml(session.system_prompt)}</pre>
            </div>

            <div>
                <h6>Events Timeline</h6>
                <div class="list-group" style="max-height: 400px; overflow-y: auto;">
                    ${renderEventsList(session.events)}
                </div>
            </div>
        `;

        document.getElementById('sessionDetails').innerHTML = detailsHtml;

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('sessionDetailModal'));
        modal.show();

    } catch (error) {
        console.error('Failed to load session:', error);
        alert(`Failed to load session: ${error.message}`);
    }
}

/**
 * Render events list
 */
function renderEventsList(events) {
    return events.map((event, index) => {
        const timestamp = new Date(event.timestamp).toLocaleTimeString();
        let icon = 'bi-circle';
        let badgeClass = 'bg-secondary';
        let details = '';

        // Ensure event.details exists
        const eventDetails = event.details || {};

        switch (event.event_type) {
            case 'user_input':
                icon = 'bi-person';
                badgeClass = 'bg-primary';
                if (eventDetails.message) {
                    details = `<div class="mt-1"><small><strong>Input:</strong> ${escapeHtml(eventDetails.message)}</small></div>`;
                }
                break;
            case 'llm_request':
                icon = 'bi-send';
                badgeClass = 'bg-info';
                const tools = eventDetails.tools ? eventDetails.tools.join(', ') : 'none';
                details = `<div class="mt-1"><small>Messages: ${eventDetails.messages_count || 0} | Tools: ${tools}</small></div>`;
                break;
            case 'llm_response':
                icon = 'bi-robot';
                badgeClass = 'bg-success';
                if (eventDetails.response) {
                    details = `<div class="mt-1"><small><strong>Response:</strong> ${escapeHtml(eventDetails.response)}</small></div>`;
                }
                break;
            case 'tool_call':
                icon = 'bi-wrench';
                badgeClass = 'bg-warning';
                details = `<div class="mt-1"><small><code>${escapeHtml(JSON.stringify(eventDetails, null, 2))}</code></small></div>`;
                break;
            case 'tool_result':
                icon = 'bi-check-circle';
                badgeClass = 'bg-success';
                if (eventDetails.result) {
                    details = `<div class="mt-1"><small>${escapeHtml(eventDetails.result)}</small></div>`;
                }
                break;
            case 'token_usage':
                icon = 'bi-speedometer2';
                badgeClass = 'bg-info';
                const usage = eventDetails.last_request || {};
                details = `<div class="mt-1"><small>Input: ${usage.input_tokens || 0} | Output: ${usage.output_tokens || 0}</small></div>`;
                break;
            case 'error':
                icon = 'bi-exclamation-triangle';
                badgeClass = 'bg-danger';
                details = `<div class="mt-1"><small><strong>${eventDetails.error_type || 'Error'}:</strong> ${escapeHtml(eventDetails.message || 'Unknown error')}</small></div>`;
                break;
        }

        return `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <span class="badge ${badgeClass}">
                            <i class="${icon}"></i> ${event.event_type}
                        </span>
                        <small class="text-muted ms-2">${timestamp}</small>
                        ${details}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Generate sequence diagram for a session
 */
async function generateDiagram(sessionId) {
    // Show diagram modal with loading state
    const modal = new bootstrap.Modal(document.getElementById('diagramModal'));
    document.getElementById('diagramContent').innerHTML = `
        <div class="text-center p-5">
            <div class="spinner-border text-primary mb-3" role="status">
                <span class="visually-hidden">Loading diagram...</span>
            </div>
            <p>Generating Mermaid sequence diagram...</p>
        </div>
    `;
    modal.show();

    try {
        const response = await fetch(`${API_BASE}/api/sessions/${encodeURIComponent(sessionId)}/diagram`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Store diagram for live editor
        window.currentDiagram = data.diagram;

        // Extract mermaid code from markdown code fence
        let mermaidCode = data.diagram;
        const mermaidMatch = data.diagram.match(/```mermaid\n([\s\S]*?)\n```/);
        if (mermaidMatch) {
            mermaidCode = mermaidMatch[1].trim();
        }

        // Simplified UI - just source and buttons
        document.getElementById('diagramContent').innerHTML = `
            <div class="alert alert-info mb-3 d-flex justify-content-between align-items-center">
                <div>
                    <i class="bi bi-info-circle"></i>
                    <strong>Mermaid Sequence Diagram Generated</strong><br>
                    <small>Click "View in Live Editor" to see the rendered diagram with full interactive features.</small>
                </div>
                <button class="btn btn-success btn-sm" onclick="openInMermaidLiveEditor()">
                    <i class="bi bi-diagram-3"></i> View in Live Editor
                </button>
            </div>

            <div class="mb-2">
                <strong>Mermaid Source Code:</strong>
            </div>
            <pre class="border rounded p-3 bg-light" style="max-height: 400px; overflow-y: auto;">${escapeHtml(data.diagram)}</pre>
        `;

    } catch (error) {
        console.error('Failed to generate diagram:', error);
        document.getElementById('diagramContent').innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> Failed to load diagram: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

/**
 * Generate Mermaid Live Editor URL
 */
function generateMermaidLiveEditorUrl(mermaidCode) {
    // Create the state object for Mermaid Live Editor
    const state = {
        code: mermaidCode,
        mermaid: {
            theme: 'default'
        },
        updateEditor: false,
        autoSync: true,
        updateDiagram: true
    };

    // Convert to JSON and encode
    const jsonString = JSON.stringify(state);

    // For simple diagrams, use base64 encoding
    try {
        const base64 = btoa(encodeURIComponent(jsonString).replace(/%([0-9A-F]{2})/g,
            function toSolidBytes(match, p1) {
                return String.fromCharCode('0x' + p1);
            }));
        return `https://mermaid.live/edit#base64:${base64}`;
    } catch (e) {
        // If base64 fails (too long), fall back to pako compression
        // Note: This requires adding pako library to the page
        console.warn('Base64 encoding failed, diagram may be too large for URL');
        // For now, just return the mermaid.live base URL
        return 'https://mermaid.live/edit';
    }
}

/**
 * Open diagram in Mermaid Live Editor
 */
function openInMermaidLiveEditor() {
    if (window.currentDiagram) {
        // Extract mermaid code from markdown code fence if present
        let mermaidCode = window.currentDiagram;
        const mermaidMatch = window.currentDiagram.match(/```mermaid\n([\s\S]*?)\n```/);
        if (mermaidMatch) {
            mermaidCode = mermaidMatch[1].trim();
        }

        const url = generateMermaidLiveEditorUrl(mermaidCode);
        window.open(url, '_blank');
    }
}

