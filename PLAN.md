# Real-Time Memory Files Panel - Implementation Plan

**Status**: ✅ COMMITTED - Ready for Implementation

## Overview
Enhance the Memory Files panel with real-time updates and visual feedback to help users understand LLM memory operations as they happen.

**Scope**: Teaching MVP - Track memory operations during chat interactions only (not external file changes)
**Scale**: ~12 or fewer memory files
**Update Mechanism**: SSE (Server-Sent Events) push during chat streams

---

## Design Decisions (COMMITTED)

### Implementation Approach
- ✅ **SSE Push Events** (not polling) - Instant updates via enhanced chat stream
- ✅ **Intercept Tool Runner** - Cleaner separation, no tight coupling with memory tool
- ✅ **Loading Skeleton** - Show on initial app load

### Animation Durations (Configurable Variables)
```javascript
const SLIDE_IN_ANIMATION_DURATION = 600;  // ms - New file slide-in
const HDD_FLICKER_DURATION = 1500;        // ms - Hard drive lights flicker
const LABEL_FLASH_DURATION = 1000;        // ms - Timestamp label glow/pulse
```

### Visual Effects
- **New File**: Slide-in from top (600ms)
- **File Read**: Green glow on "last accessed" label (1000ms)
- **File Update**: Orange glow on "last updated" label (1000ms), remove "new" badge
- **HDD Lights**: Green (read), Orange (write), flicker 1500ms

### Label Behavior
- **"new" badge**: Persists until user views file OR file is updated (never auto-dismiss)
- **Timestamps**: Persistent labels, updated on each operation
- **Update notification**: Dismissed after manual refresh (not auto-dismiss)

### Scroll Behavior (Deferred to MVP Testing)
- Auto-scroll to show affected files - address after hands-on testing

---

## Requirements Summary

### Real-Time Updates
- ✅ No refresh button needed during chat
- ✅ New files slide in from top
- ✅ Read/Write operations tracked and displayed
- ✅ File content viewer shows update notifications

### Visual Indicators
- **New File**: Slide-in animation + "new" label + "last updated: ..." timestamp
- **File Read**: Update "last accessed: ..." timestamp (persistent label) + green glow effect (1s)
- **File Update**: Update "last updated: ..." timestamp (persistent label) + orange glow effect (1s), remove "new" label if present
- **Content Viewer**: Hard drive lights (read/write) that flicker for 1.5s when operations occur

### State Management
- Initial state loaded from filesystem at app startup (with file metadata)
- "new" label persists until user views file or file is updated
- Timestamps persist (updated on each operation)
- Content viewer shows banner notification when viewed file is updated externally

---

## Implementation Approach: SSE Push Events

### Why SSE (not polling)?
- ✅ Instant updates (no 100-200ms delay)
- ✅ Efficient (no continuous polling overhead)
- ✅ Leverages existing SSE chat infrastructure
- ✅ Perfect for human-scale operation frequency
- ✅ Event-driven architecture matches the app's streaming design

### Architecture Flow

```
User sends chat → Claude uses Memory Tool → Backend emits memory event via SSE
                                                          ↓
                                          Frontend receives event → Updates UI with animation
```

---

## Detailed Implementation Plan

## Phase 1: Backend Changes

### 1.1 Enhance Memory File Metadata API
**File**: `backend/main.py`
**Endpoint**: `GET /api/memory/files`

**Current**:
```python
{
  "files": [
    {"path": "...", "name": "...", "size": 123, "modified": "2025-01-15T10:30:00"}
  ]
}
```

**Enhanced**:
```python
{
  "files": [
    {
      "path": "...",
      "name": "...",
      "size": 123,
      "created": "2025-01-15T10:00:00",    # NEW: file creation time
      "modified": "2025-01-15T10:30:00",   # ENHANCED: last modified time
      "accessed": "2025-01-15T11:00:00"    # NEW: last accessed time
    }
  ]
}
```

**Changes**:
- Use `Path.stat()` to get `st_ctime` (created), `st_mtime` (modified), `st_atime` (accessed)
- Return all three timestamps in ISO format

---

### 1.2 Add Memory Operation Events to SSE Stream
**File**: `backend/core/conversation.py`
**Function**: `send_message_streaming()`

**New Event Types**:
```python
# During tool execution, emit:
{
  "event": "memory_operation",
  "operation": "read" | "create" | "update" | "delete" | "rename",
  "path": "relative/path/to/file.txt",
  "timestamp": "2025-01-15T12:00:00.123Z"
}
```

**Implementation Strategy: Intercept Tool Runner Events**

The `tool_runner.until_done()` returns intermediate messages. Our approach:
1. After each tool call completes, inspect if it was a memory tool operation
2. Extract operation details from the tool call/result
3. Emit custom SSE event with operation metadata

**Benefits**: Clean separation of concerns, no tight coupling with memory tool

**Code Location**: After line 122 in `conversation.py`
```python
# After runner.until_done()
# Inspect runner result for tool calls
# If memory tool used, extract details and yield memory_operation event
```

---

### 1.3 Map Memory Tool Operations to Event Types
**File**: `backend/core/conversation.py` (new helper function)

**Mapping**:
- `view()` → `"read"` (when reading a file, not listing directory)
- `create()` → `"create"`
- `str_replace()` → `"update"`
- `insert()` → `"update"`
- `delete()` → `"delete"`
- `rename()` → `"rename"` (emit for both old and new paths)

**Detection Strategy**:
- Parse tool call `input` parameters to determine operation
- For `view()`: Check if path is file vs directory
- For others: Direct mapping

---

## Phase 2: Frontend Changes

### 2.1 Add Memory Operation Event Handler
**File**: `frontend/static/js/chat.js`
**Function**: `handleStreamEvent(event)`

**New Case**:
```javascript
case 'memory_operation':
  const { operation, path, timestamp } = data;
  handleMemoryOperation(operation, path, timestamp);
  break;
```

---

### 2.2 Implement Memory Operation Handler
**File**: `frontend/static/js/memory.js`

**New Function**: `handleMemoryOperation(operation, path, timestamp)`

**Behavior**:
```javascript
function handleMemoryOperation(operation, path, timestamp) {
  switch(operation) {
    case 'create':
      // 1. Fetch updated file list
      // 2. Identify new file
      // 3. Mark as 'new' in state
      // 4. Trigger slide-in animation
      // 5. Set 'last updated' timestamp
      // 6. Flash 'last updated' label (orange)
      break;

    case 'read':
      // 1. Update file state with 'last accessed' timestamp
      // 2. Flash 'last accessed' label (green)
      // 3. If file is open in viewer, trigger read HDD light animation
      break;

    case 'update':
      // 1. Update file state with 'last updated' timestamp
      // 2. Remove 'new' label if present
      // 3. Flash 'last updated' label (orange)
      // 4. If file is open in viewer, show update notification banner
      // 5. If file is open in viewer, trigger write HDD light animation
      break;

    case 'delete':
      // 1. Remove file from state
      // 2. Trigger fade-out animation
      // 3. If file is open in viewer, close it
      break;

    case 'rename':
      // 1. Update file path in state
      // 2. Re-render with new name
      break;
  }
}
```

---

### 2.3 Enhanced State Management
**File**: `frontend/static/js/memory.js`

**Current State**:
```javascript
let currentMemoryFiles = [];  // Simple array
```

**Enhanced State**:
```javascript
let memoryFilesState = {
  files: [
    {
      path: "...",
      name: "...",
      size: 123,
      created: "...",
      modified: "...",
      accessed: "...",
      isNew: true,           // NEW: tracks if file should show "new" label
      lastOperation: "create", // NEW: tracks last operation type
      operationTimestamp: "..." // NEW: when last operation occurred
    }
  ]
};
```

**State Update Logic**:
- On `create`: Set `isNew = true`, `lastOperation = 'create'`
- On `read`: Update `accessed` timestamp, `lastOperation = 'read'`
- On `update`: Set `isNew = false`, update `modified` timestamp, `lastOperation = 'update'`
- On user viewing file: Set `isNew = false`

---

### 2.4 UI Rendering Updates
**File**: `frontend/static/js/memory.js`
**Function**: `renderMemoryList()`

**Enhanced File Item HTML**:
```html
<div class="memory-item" data-path="..." data-is-new="true">
  <div class="d-flex justify-content-between align-items-start">
    <div class="flex-grow-1">
      <strong>filename.txt</strong>

      <!-- NEW: Labels -->
      <div class="memory-labels mt-1">
        <span class="badge bg-success" *ngIf="isNew">new</span>
      </div>

      <!-- NEW: Timestamps -->
      <div class="memory-timestamps mt-1">
        <small class="text-muted">
          Last updated: 2 minutes ago
        </small>
        <small class="text-muted" *ngIf="accessed">
          Last accessed: 5 seconds ago
        </small>
      </div>
    </div>

    <div class="memory-size">
      <small class="text-muted">1.2 KB</small>
    </div>
  </div>
</div>
```

**Timestamp Formatting**:
- Use relative time: "2 seconds ago", "5 minutes ago", "3 hours ago"
- Helper function: `formatRelativeTime(timestamp)` using JavaScript `Date` API

---

### 2.5 Animation Implementations

**Configurable Variables** (`frontend/static/js/memory.js`):
```javascript
// Animation duration constants (configurable)
const SLIDE_IN_ANIMATION_DURATION = 600;  // ms
const HDD_FLICKER_DURATION = 1500;        // ms
const LABEL_FLASH_DURATION = 1000;        // ms
```

#### 2.5.1 Slide-In Animation (New Files)
**File**: `frontend/static/css/custom.css`

```css
@keyframes slideInFromTop {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.memory-item.new-file-animation {
  animation: slideInFromTop var(--slide-in-duration, 0.6s) ease-out;
}
```

**JavaScript** (`frontend/static/js/memory.js`):
```javascript
function animateNewFile(fileElement) {
  fileElement.classList.add('new-file-animation');
  setTimeout(() => {
    fileElement.classList.remove('new-file-animation');
  }, SLIDE_IN_ANIMATION_DURATION);
}
```

---

#### 2.5.2 Label Flash/Glow Effect (Read/Write Operations)
**File**: `frontend/static/css/custom.css`

```css
@keyframes labelGlowGreen {
  0%, 100% {
    box-shadow: none;
    background-color: transparent;
  }
  50% {
    box-shadow: 0 0 8px rgba(0, 255, 0, 0.6);
    background-color: rgba(0, 255, 0, 0.1);
  }
}

@keyframes labelGlowOrange {
  0%, 100% {
    box-shadow: none;
    background-color: transparent;
  }
  50% {
    box-shadow: 0 0 8px rgba(255, 102, 0, 0.6);
    background-color: rgba(255, 102, 0, 0.1);
  }
}

.memory-timestamp-label {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.3s;
}

.memory-timestamp-label.flash-read {
  animation: labelGlowGreen var(--label-flash-duration, 1s) ease-in-out;
}

.memory-timestamp-label.flash-write {
  animation: labelGlowOrange var(--label-flash-duration, 1s) ease-in-out;
}
```

**JavaScript** (`frontend/static/js/memory.js`):
```javascript
function flashTimestampLabel(fileElement, operationType) {
  // operationType: 'read' or 'write'
  const labelClass = operationType === 'read'
    ? '.memory-timestamp-accessed'
    : '.memory-timestamp-updated';

  const label = fileElement.querySelector(labelClass);
  if (!label) return;

  const flashClass = operationType === 'read' ? 'flash-read' : 'flash-write';
  label.classList.add(flashClass);

  setTimeout(() => {
    label.classList.remove(flashClass);
  }, LABEL_FLASH_DURATION);
}
```

**Updated HTML Structure** (for labels):
```html
<div class="memory-timestamps mt-1">
  <small class="memory-timestamp-label memory-timestamp-updated">
    Last updated: 2 minutes ago
  </small>
  <small class="memory-timestamp-label memory-timestamp-accessed" *ngIf="accessed">
    Last accessed: 5 seconds ago
  </small>
</div>
```

---

#### 2.5.3 Hard Drive Lights (File Content Viewer)
**File**: `frontend/index.html` (Memory Viewer section)

**New HTML** (add above file content):
```html
<div id="memoryViewer" style="display: none;">
  <div class="memory-viewer-header">
    <h5 id="memoryViewerTitle">...</h5>
    <button onclick="closeMemoryViewer()">&times;</button>
  </div>

  <!-- NEW: Hard Drive Lights -->
  <div class="hdd-lights-panel">
    <div class="hdd-light read-light">
      <div class="light-indicator"></div>
      <span>READ</span>
    </div>
    <div class="hdd-light write-light">
      <div class="light-indicator"></div>
      <span>WRITE</span>
    </div>
  </div>

  <!-- NEW: Update Notification Banner -->
  <div id="updateNotificationBanner" style="display: none;" class="alert alert-info">
    File was updated - <a href="#" onclick="reloadMemoryViewer()">click to refresh</a>
  </div>

  <pre id="memoryViewerContent">...</pre>
  <div class="memory-viewer-meta">...</div>
</div>
```

**CSS** (`frontend/static/css/custom.css`):
```css
.hdd-lights-panel {
  display: flex;
  gap: 20px;
  padding: 10px;
  background: linear-gradient(to bottom, #2c3e50, #34495e);
  border-bottom: 2px solid #1a252f;
  justify-content: center;
}

.hdd-light {
  display: flex;
  align-items: center;
  gap: 8px;
}

.light-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #555;
  border: 1px solid #333;
  transition: all 0.3s;
}

.hdd-light.active .light-indicator {
  box-shadow: 0 0 10px currentColor;
}

.read-light.active .light-indicator {
  background: #00ff00;
  color: #00ff00;
}

.write-light.active .light-indicator {
  background: #ff6600;
  color: #ff6600;
}

@keyframes flicker {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.hdd-light.active .light-indicator {
  animation: flicker 1.5s ease-in-out;
}

.hdd-light span {
  color: #ecf0f1;
  font-size: 11px;
  font-weight: bold;
  letter-spacing: 1px;
}
```

**JavaScript** (`frontend/static/js/memory.js`):
```javascript
function triggerHDDLight(type) {
  const lightClass = type === 'read' ? '.read-light' : '.write-light';
  const lightElement = document.querySelector(lightClass);

  lightElement.classList.add('active');
  setTimeout(() => {
    lightElement.classList.remove('active');
  }, HDD_FLICKER_DURATION); // Configurable duration
}
```

---

#### 2.5.4 Update Notification Banner
**JavaScript** (`frontend/static/js/memory.js`):

```javascript
let currentViewedFilePath = null;

function viewMemoryFile(path) {
  currentViewedFilePath = path;
  // ... existing view logic ...
}

function handleMemoryOperation(operation, path, timestamp) {
  // ... other logic ...

  // If currently viewed file is updated
  if (operation === 'update' && path === currentViewedFilePath) {
    document.getElementById('updateNotificationBanner').style.display = 'block';
    triggerHDDLight('write');
  }

  if (operation === 'read' && path === currentViewedFilePath) {
    triggerHDDLight('read');
  }
}

function reloadMemoryViewer() {
  if (currentViewedFilePath) {
    viewMemoryFile(currentViewedFilePath);
    document.getElementById('updateNotificationBanner').style.display = 'none';
  }
}
```

---

### 2.6 Initial State Loading & Loading Skeleton
**File**: `frontend/static/js/app.js`

**On App Initialization** (in `initializeApp()` around line 140):
```javascript
async function initializeApp() {
  // ... existing initialization ...

  // Show loading skeleton while fetching
  showMemoryLoadingSkeleton();

  // Load initial memory files with metadata
  await refreshMemoryFiles();

  // Hide loading skeleton
  hideMemoryLoadingSkeleton();

  // Initialize all files as "not new" since they existed before session
  memoryFilesState.files.forEach(file => {
    file.isNew = false;
  });
}
```

**Loading Skeleton** (`frontend/static/js/memory.js`):
```javascript
function showMemoryLoadingSkeleton() {
  const memoryList = document.getElementById('memoryList');
  memoryList.innerHTML = `
    <div class="loading-skeleton">
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
      <div class="skeleton-item"></div>
    </div>
  `;
}

function hideMemoryLoadingSkeleton() {
  // Loading skeleton is replaced by actual content in renderMemoryList()
}
```

**CSS** (`frontend/static/css/custom.css`):
```css
.skeleton-item {
  height: 60px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: loading 1.5s ease-in-out infinite;
  border-radius: 4px;
  margin-bottom: 10px;
}

@keyframes loading {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
```

**Note**: Files present at startup are NOT marked as "new" (only files created during session)

---

## Phase 3: Testing & Polish

### 3.1 Testing Scenarios

**Test 1: New File Creation**
1. User sends chat: "Remember my favorite color is blue"
2. Claude creates new memory file
3. ✅ File slides in from top with animation
4. ✅ "new" badge appears
5. ✅ "Last updated: just now" appears

**Test 2: File Read**
1. User sends chat: "What's my favorite color?"
2. Claude reads memory file
3. ✅ "Last accessed: just now" updates
4. ✅ "Last accessed" label flashes green (1s)
5. ✅ If file viewer open, read HDD light flickers

**Test 3: File Update**
1. User sends chat: "Actually I prefer green"
2. Claude updates existing memory file
3. ✅ "new" badge removed (if present)
4. ✅ "Last updated: just now" updates
5. ✅ "Last updated" label flashes orange (1s)
6. ✅ If file viewer open, write HDD light flickers + notification banner appears

**Test 4: Concurrent Operations**
1. Claude performs multiple operations in one turn
2. ✅ All operations trigger appropriate UI updates
3. ✅ Animations don't conflict

**Test 5: Initial Load**
1. Restart web app with existing memory files
2. ✅ Files appear immediately
3. ✅ No "new" badges (only for session-created files)
4. ✅ Timestamps from filesystem displayed

---

### 3.2 Edge Cases

**Empty State**
- No memory files exist → Show helpful empty state message

**File Deleted While Viewing**
- User viewing file, Claude deletes it → Close viewer with notification

**Rapid Operations**
- Multiple operations on same file quickly → Ensure state updates correctly, animations queue properly

**Network Issues**
- SSE connection drops → Graceful degradation (show warning, allow manual refresh)

---

### 3.3 Polish & UX Refinements

**Accessibility**
- Add ARIA labels to status indicators
- Ensure animations respect `prefers-reduced-motion`
- Keyboard navigation support

**Responsive Design**
- Ensure animations work on mobile viewports
- Test on common browsers (Chrome, Firefox, Safari, Edge)

**Performance**
- Debounce rapid state updates
- Use CSS transforms for animations (GPU accelerated)
- Limit re-renders to affected items only

---

## Dependencies

### New Dependencies Required
None! Implementation uses vanilla JavaScript and CSS animations.

**Verify Current Versions**:
- Bootstrap 5.3.2 (already using via CDN) ✅
- Modern ES6+ JavaScript features (all major browsers) ✅

---

## File Change Summary

### Backend Files Modified
1. `backend/main.py` - Enhance `/api/memory/files` endpoint with metadata
2. `backend/core/conversation.py` - Add memory operation event emission to SSE stream

### Frontend Files Modified
3. `frontend/static/js/memory.js` - Enhanced state management, event handlers, animations
4. `frontend/static/js/chat.js` - Add memory_operation event case
5. `frontend/static/css/custom.css` - Animation styles, HDD lights styling
6. `frontend/index.html` - Add HDD lights panel, notification banner to memory viewer

### Documentation Updated
7. `CLAUDE.md` - Document new real-time memory panel features
8. `README.md` or `README_WEBUI.md` - Update with new UI capabilities

---

## Implementation Sequence

### Sprint 1: Backend Foundation (2-3 hours)
1. ✅ Enhance `/api/memory/files` with created/accessed timestamps
2. ✅ Implement memory operation event emission in ConversationManager
3. ✅ Test event emission with debug logging

### Sprint 2: Frontend Core (3-4 hours)
1. ✅ Enhanced state management in memory.js
2. ✅ Memory operation event handler
3. ✅ Update renderMemoryList() with labels and timestamps
4. ✅ Implement relative time formatting

### Sprint 3: Animations (3-4 hours)
1. ✅ Slide-in animation for new files
2. ✅ Label flash/glow effects (read/write)
3. ✅ HDD lights component
4. ✅ Update notification banner
5. ✅ Loading skeleton
6. ✅ CSS styling and polish

### Sprint 4: Testing & Polish (2-3 hours)
1. ✅ End-to-end testing of all scenarios
2. ✅ Cross-browser testing
3. ✅ Accessibility improvements
4. ✅ Documentation updates

**Total Estimated Time**: 10-14 hours

---

## Risks & Mitigations

### Risk 1: SSE Event Order
**Issue**: Events might arrive out of order or be missed
**Mitigation**: Include sequence numbers in events, handle duplicates gracefully

### Risk 2: Memory Viewer State Sync
**Issue**: File content viewer might show stale data
**Mitigation**: Clear notification banner makes user aware, explicit refresh action

### Risk 3: Animation Performance
**Issue**: Multiple rapid operations could cause janky animations
**Mitigation**: Use requestAnimationFrame, CSS transforms, animation queuing

### Risk 4: Browser Compatibility
**Issue**: Older browsers might not support all features
**Mitigation**: Test on all major browsers, provide graceful degradation

---

## Future Enhancements (Out of Scope for MVP)

- [ ] Filesystem watching for external changes
- [ ] Diff visualization for file updates
- [ ] Operation history timeline
- [ ] Undo/redo for memory operations
- [ ] Search/filter memory files
- [ ] Bulk operations
- [ ] Export memory files as zip
- [ ] Memory file analytics (most accessed, largest, etc.)

---

## Success Criteria

✅ **User can observe memory operations in real-time without clicking refresh**
✅ **New files slide in with visual feedback**
✅ **Read/Write operations are clearly indicated**
✅ **File viewer shows when content is stale**
✅ **Animations are smooth and non-distracting**
✅ **Works reliably across Chrome, Firefox, Safari, Edge**
✅ **Teaching value: Users understand LLM memory behavior**

---

## Next Steps

✅ **Plan Approved - Ready for Implementation**

Proceed with implementation in sprints following the sequence outlined above. Start with Sprint 1 (Backend Foundation) to establish the SSE event infrastructure, then build out the frontend animations and interactions.
