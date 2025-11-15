/**
 * Memory browser functionality
 */

let currentMemoryFiles = [];

/**
 * Set up memory browser event listeners
 */
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('closeMemoryViewer').addEventListener('click', closeMemoryViewer);
});

/**
 * Refresh memory files list
 */
async function refreshMemoryFiles() {
    try {
        const response = await fetch(`${API_BASE}/api/memory/files`);
        const data = await response.json();

        currentMemoryFiles = data.files || [];
        renderMemoryList();
    } catch (error) {
        console.error('Failed to load memory files:', error);
        document.getElementById('memoryList').innerHTML = `
            <div class="alert alert-danger">
                Failed to load memory files: ${escapeHtml(error.message)}
            </div>
        `;
    }
}

/**
 * Render memory files list
 */
function renderMemoryList() {
    const memoryList = document.getElementById('memoryList');

    if (currentMemoryFiles.length === 0) {
        memoryList.innerHTML = `
            <div class="text-muted text-center p-4">
                <i class="bi bi-folder2 fs-1"></i>
                <p class="mt-2">No memory files yet</p>
                <small>Claude will create memory files as you chat</small>
            </div>
        `;
        return;
    }

    const listHtml = currentMemoryFiles.map(file => {
        const sizeKb = (file.size / 1024).toFixed(1);
        const modifiedDate = new Date(file.modified * 1000).toLocaleString();

        return `
            <div class="memory-item list-group-item list-group-item-action" data-path="${escapeHtml(file.path)}">
                <div class="d-flex justify-content-between align-items-start">
                    <div class="flex-grow-1">
                        <div class="fw-bold">
                            <i class="bi bi-file-text"></i> ${escapeHtml(file.name)}
                        </div>
                        <small class="text-muted">
                            ${sizeKb} KB | Modified: ${modifiedDate}
                        </small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary view-file-btn" data-path="${escapeHtml(file.path)}">
                        <i class="bi bi-eye"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    memoryList.innerHTML = `<div class="list-group">${listHtml}</div>`;

    // Add click handlers
    memoryList.querySelectorAll('.view-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const path = btn.getAttribute('data-path');
            viewMemoryFile(path);
        });
    });

    memoryList.querySelectorAll('.memory-item').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.getAttribute('data-path');
            viewMemoryFile(path);
        });
    });
}

/**
 * View a memory file
 */
async function viewMemoryFile(path) {
    try {
        const response = await fetch(`${API_BASE}/api/memory/files/${encodeURIComponent(path)}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Show viewer
        const viewer = document.getElementById('memoryViewer');
        const fileName = document.getElementById('memoryFileName');
        const content = document.getElementById('memoryContent');

        fileName.textContent = path;
        content.textContent = data.content;

        viewer.style.display = 'block';

        // Highlight selected item
        document.querySelectorAll('.memory-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`.memory-item[data-path="${path}"]`)?.classList.add('active');

    } catch (error) {
        console.error('Failed to load memory file:', error);
        addSystemMessage(`Failed to load file: ${error.message}`, 'danger');
    }
}

/**
 * Close memory viewer
 */
function closeMemoryViewer() {
    document.getElementById('memoryViewer').style.display = 'none';
    document.querySelectorAll('.memory-item').forEach(item => {
        item.classList.remove('active');
    });
}
