# Memory System v2 - Web UI

A modern web interface for Claude's autonomous memory management system, built with **FastAPI** and **Bootstrap 5**.

## 🎯 What's New in the Web UI

The Web UI provides a user-friendly alternative to the CLI with:

- ✨ **Real-time streaming chat** - See Claude's responses appear token-by-token
- 📁 **Memory browser** - Visual file explorer for Claude's memory files
- 📊 **Sessions dashboard** - Browse all conversation sessions
- 📈 **Diagram generation** - Generate Mermaid sequence diagrams with one click
- 🎨 **Modern Bootstrap UI** - Clean, responsive interface
- 🔄 **Auto-refresh** - Memory files update automatically as Claude uses them

## 🚀 Quick Start

### 1. Install Dependencies

```bash
uv sync
```

### 2. Configure Environment

Create a `.env` file (or copy from `.env.example`):

```bash
cp .env.example .env
```

Edit `.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=your_api_key_here
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

### 3. Run the Web Server

```bash
uv run python -m backend.main
```

Or use uvicorn directly:

```bash
uv run uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Open in Browser

Navigate to: **http://localhost:8000**

## 📖 How to Use

### First Time Setup

1. Click the **⚙ Settings** button in the top-right corner
2. Enter your **Anthropic API Key** (saved locally in browser)
3. Select a **Model** (default: Claude Sonnet 4.5)
4. Choose a **System Prompt** (e.g., "concise prompt")
5. Click **Initialize Session**

### Chatting with Claude

1. Once initialized, the chat input will be enabled
2. Type your message and press **Enter** or click **Send**
3. Watch Claude's response stream in real-time
4. Tool calls (memory operations) are shown inline
5. Token usage updates after each response

### Memory Browser (Right Panel)

- **View memory files** - Click any file to view its content
- **Refresh** - Click the refresh button to update the list
- **Clear All** - Delete all memory files (with confirmation)
- Files update automatically when Claude modifies them

### Sessions Dashboard

1. Click the **📊 Sessions** tab
2. Browse all recorded conversation sessions
3. **View Details** - See full session trace with events timeline
4. **Generate Diagram** - Create Mermaid sequence diagram
   - Click to generate
   - Copy the Mermaid code
   - Paste into [mermaid.live](https://mermaid.live) to visualize

## 🏗️ Architecture

```
Frontend (Browser)
  ├─ HTML/Bootstrap 5 UI
  ├─ Vanilla JavaScript
  └─ HTTP Streaming (Server-Sent Events)
         │
         ↓
Backend (FastAPI)
  ├─ HTTP Streaming Chat Endpoint
  ├─ Memory Operations API
  ├─ Sessions Management API
  └─ Reuses existing core logic:
      ├─ LocalFilesystemMemoryTool
      ├─ SessionTrace
      └─ Anthropic API Client
```

### Key Features

- **HTTP Streaming**: Uses Server-Sent Events (SSE) for real-time response streaming
- **Single-user POC**: No authentication, designed for local use
- **Auto-recorded sessions**: All conversations automatically saved to `sessions/`
- **Reuses 90% of CLI code**: `memory_tool.py` and `session_trace.py` unchanged

## 📁 File Structure

```
implicit-memory-system-webui/
├── backend/
│   ├── main.py                    # FastAPI application
│   ├── core/
│   │   └── conversation.py        # Conversation management
│   ├── api/                       # (future: split endpoints)
│   └── models/                    # (future: Pydantic models)
├── frontend/
│   ├── index.html                 # Main UI
│   └── static/
│       ├── css/
│       │   └── custom.css         # Custom styles
│       └── js/
│           ├── app.js             # Main app logic
│           ├── chat.js            # Chat functionality
│           ├── memory.js          # Memory browser
│           └── sessions.js        # Sessions dashboard
├── src/                           # Original CLI (unchanged)
│   ├── chat.py
│   ├── memory_tool.py
│   └── session_trace.py
├── prompts/                       # System prompts (shared)
├── memory/                        # Memory storage (shared)
└── sessions/                      # Session traces (shared)
```

## 🔌 API Endpoints

### Session Management
- `POST /api/session/initialize` - Initialize conversation session
- `GET /api/session/status` - Get current session status

### Chat
- `POST /api/chat` - Send message and stream response (SSE)

### Memory
- `GET /api/memory/files` - List all memory files
- `GET /api/memory/files/{path}` - Get file content
- `DELETE /api/memory/clear` - Clear all memories

### Sessions
- `GET /api/sessions` - List all session traces
- `GET /api/sessions/{id}` - Get session details
- `POST /api/sessions/{id}/diagram` - Generate Mermaid diagram

### Configuration
- `GET /api/prompts` - List available system prompts
- `GET /api/prompts/{name}` - Get prompt content
- `GET /api/config` - Get current configuration

## 🎨 UI Features

### Chat Interface
- Real-time streaming responses
- Tool call indicators
- Token usage display
- Auto-scrolling
- Message history

### Memory Browser
- File list with metadata (size, modified date)
- Click to view file contents
- Auto-refresh on tool calls
- Clear all memories button

### Sessions Dashboard
- Session list with stats
- Event timeline viewer
- One-click diagram generation
- Export to Mermaid format

## 🛠️ Development

### Run in Development Mode

```bash
uv run uvicorn backend.main:app --reload
```

This enables:
- Auto-reload on code changes
- Detailed error messages
- Hot module replacement

### Debug Logging

The backend uses Python's logging module. Check the console output for debug information.

### Frontend Development

The frontend uses vanilla JavaScript (no build step required). Just edit the files in `frontend/static/js/` and refresh the browser.

## 🔒 Security Notes

This is a **teaching POC** and **single-user application**:

- ✅ API key stored in browser localStorage only
- ✅ No authentication (designed for local use)
- ⚠️ Do not expose to public internet without adding authentication
- ⚠️ No input sanitization for production use

## 📝 Comparison: CLI vs Web UI

| Feature | CLI | Web UI |
|---------|-----|--------|
| **Interface** | Terminal commands | Browser-based GUI |
| **Streaming** | Text output | Real-time SSE streaming |
| **Memory View** | `/memory_view` command | Visual file browser |
| **Sessions** | JSON files | Interactive dashboard |
| **Diagrams** | Manual script run | One-click generation |
| **Multi-session** | ❌ | ✅ Open multiple tabs |
| **Mobile** | ❌ | ✅ Responsive design |

## 🤝 Contributing

This is a teaching POC for the article "The Memory Illusion v2". The Web UI demonstrates modern web development patterns for LLM applications.

## 📚 Learn More

- **Article**: [The Memory Illusion v2](https://alteredcraft.com/p/the-memory-illusion-teaching-your)
- **Original CLI**: See `README.md` for CLI usage
- **Anthropic Memory Tool**: [Documentation](https://docs.anthropic.com/)

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Use a different port
uv run uvicorn backend.main:app --port 8080
```

### Module Import Errors
```bash
# Ensure you're in the project root directory
cd /home/user/implicit-memory-system-webui
uv sync
```

### API Key Not Working
- Check `.env` file has correct API key
- Restart the server after changing `.env`
- Or enter API key in Settings modal (stored in browser)

### Sessions Not Loading
- Sessions are auto-created in `sessions/` directory
- Check file permissions on `sessions/` folder
- Refresh the Sessions tab

## 📄 License

Same as the main project (see LICENSE file).

---

**Enjoy chatting with Claude in the Web UI! 🧠✨**
