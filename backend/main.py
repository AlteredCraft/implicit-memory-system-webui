"""
FastAPI backend for Memory System v2 Web UI.
Provides HTTP streaming chat, memory operations, and session management.
"""

import os
import json
import logging
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from backend.core.conversation import ConversationManager, load_system_prompt, get_available_prompts

# Add src to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from memory_tool import LocalFilesystemMemoryTool
from anthropic.types.beta import BetaMemoryTool20250818ViewCommand

# Import generate_sequence_diagram from scripts
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
from generate_sequence_diagram import generate_mermaid_diagram


# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


# Global conversation manager (single-user POC)
conversation_manager: Optional[ConversationManager] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("Starting Memory System v2 Web UI")
    yield
    # Cleanup
    if conversation_manager:
        trace_file = conversation_manager.finalize()
        logger.info(f"Session trace saved to: {trace_file}")


# Create FastAPI app
app = FastAPI(
    title="Memory System v2 Web UI",
    description="Web interface for Claude's autonomous memory management",
    version="2.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class ChatMessage(BaseModel):
    message: str


class ConfigUpdate(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None
    system_prompt_file: Optional[str] = None


class SessionInitialize(BaseModel):
    api_key: str
    model: str
    system_prompt_file: str


# ==================== API Endpoints ====================

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "session_active": conversation_manager is not None}


@app.get("/api/prompts")
async def list_prompts():
    """List available system prompts."""
    prompts = get_available_prompts()
    return {"prompts": prompts}


@app.get("/api/prompts/{prompt_name}")
async def get_prompt(prompt_name: str):
    """Get content of a specific prompt."""
    prompt_file = f"prompts/{prompt_name}.txt"
    if not Path(prompt_file).exists():
        raise HTTPException(status_code=404, detail="Prompt not found")

    try:
        content = load_system_prompt(prompt_file)
        return {"name": prompt_name, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/session/initialize")
async def initialize_session(config: SessionInitialize):
    """Initialize a new conversation session."""
    global conversation_manager

    # Finalize existing session if any
    if conversation_manager:
        conversation_manager.finalize()

    # Validate API key
    if not config.api_key:
        raise HTTPException(status_code=400, detail="API key required")

    # Load system prompt
    try:
        system_prompt = load_system_prompt(config.system_prompt_file)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load prompt: {e}")

    # Create new conversation manager
    conversation_manager = ConversationManager(
        api_key=config.api_key,
        model=config.model,
        system_prompt=system_prompt
    )

    return {
        "status": "initialized",
        "model": config.model,
        "prompt_file": config.system_prompt_file
    }


@app.get("/api/session/status")
async def get_session_status():
    """Get current session status."""
    if not conversation_manager:
        return {"active": False}

    return {
        "active": True,
        "model": conversation_manager.model,
        "tokens": conversation_manager.get_token_stats(),
        "message_count": len(conversation_manager.messages)
    }


@app.get("/api/session/current")
async def get_current_session():
    """Get current active session ID."""
    if not conversation_manager or not conversation_manager.trace:
        return {"session_id": None}

    return {
        "session_id": conversation_manager.trace.session_id
    }


@app.post("/api/chat")
async def chat_streaming(message: ChatMessage):
    """
    Send a message and stream Claude's response back.
    Returns Server-Sent Events (SSE) stream.
    """
    if not conversation_manager:
        raise HTTPException(status_code=400, detail="Session not initialized. Call /api/session/initialize first.")

    async def event_generator():
        """Generate SSE events from conversation stream."""
        try:
            async for event in conversation_manager.send_message_streaming(message.message):
                # Format as SSE
                event_data = json.dumps(event)
                yield f"data: {event_data}\n\n"
        except Exception as e:
            logger.error(f"Error in chat stream: {e}", exc_info=True)
            error_event = json.dumps({"type": "error", "data": {"message": str(e)}})
            yield f"data: {error_event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.get("/api/memory/files")
async def list_memory_files():
    """List all memory files."""
    memory_dir = Path("memory/memories")
    if not memory_dir.exists():
        return {"files": []}

    files = []
    for file_path in memory_dir.rglob("*.txt"):
        relative_path = file_path.relative_to(memory_dir)
        files.append({
            "path": str(relative_path),
            "name": file_path.name,
            "size": file_path.stat().st_size,
            "modified": file_path.stat().st_mtime
        })

    return {"files": files}


@app.get("/api/memory/files/{file_path:path}")
async def get_memory_file(file_path: str):
    """Get content of a specific memory file."""
    full_path = Path("memory/memories") / file_path

    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    try:
        content = full_path.read_text(encoding='utf-8')
        return {
            "path": file_path,
            "content": content,
            "size": full_path.stat().st_size
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/memory/clear")
async def clear_all_memories():
    """Clear all memory files."""
    if not conversation_manager:
        raise HTTPException(status_code=400, detail="Session not initialized")

    result = conversation_manager.clear_memories()
    return {"message": result}


@app.get("/api/sessions")
async def list_sessions():
    """List all recorded session files."""
    sessions_dir = Path("sessions")
    if not sessions_dir.exists():
        return {"sessions": []}

    sessions = []
    for session_file in sorted(sessions_dir.glob("session_*.json"), reverse=True):
        try:
            with open(session_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            # Get total tokens from last token_usage event
            total_tokens = 0
            token_events = [
                e for e in data.get("events", [])
                if e.get("event_type") == "token_usage"
            ]
            if token_events:
                last_event = token_events[-1]
                cumulative = last_event.get("cumulative", {})
                total_tokens = (
                    cumulative.get("total_input_tokens", 0) +
                    cumulative.get("total_output_tokens", 0)
                )

            sessions.append({
                "id": data.get("session_id", session_file.stem),
                "filename": session_file.name,
                "start_time": data.get("start_time"),
                "end_time": data.get("end_time"),
                "model": data.get("model"),
                "event_count": len(data.get("events", [])),
                "total_tokens": total_tokens
            })
        except Exception as e:
            logger.error(f"Error reading session {session_file}: {e}")
            continue

    return {"sessions": sessions}


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    """Get details of a specific session."""
    sessions_dir = Path("sessions")
    session_file = None

    # Find session file by ID
    for f in sessions_dir.glob("session_*.json"):
        with open(f, 'r', encoding='utf-8') as file:
            data = json.load(file)
            if data.get("session_id") == session_id:
                session_file = f
                break

    if not session_file:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        with open(session_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sessions/{session_id}/diagram")
async def generate_session_diagram(session_id: str):
    """Generate Mermaid sequence diagram for a session."""
    sessions_dir = Path("sessions")
    session_file = None

    # Find session file by ID
    for f in sessions_dir.glob("session_*.json"):
        with open(f, 'r', encoding='utf-8') as file:
            data = json.load(file)
            if data.get("session_id") == session_id:
                session_file = f
                break

    if not session_file:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        with open(session_file, 'r', encoding='utf-8') as f:
            trace_data = json.load(f)

        # Generate diagram
        diagram = generate_mermaid_diagram(trace_data)

        # Save diagram file
        diagram_file = sessions_dir / f"diagram_{session_id}.md"
        with open(diagram_file, 'w', encoding='utf-8') as f:
            f.write(diagram)

        return {
            "session_id": session_id,
            "diagram": diagram,
            "diagram_file": str(diagram_file)
        }
    except Exception as e:
        logger.error(f"Error generating diagram: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/config")
async def get_config():
    """Get current configuration."""
    return {
        "api_key_set": bool(os.getenv("ANTHROPIC_API_KEY")),
        "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
        "app_log_level": os.getenv("APP_LOG_LEVEL", "INFO")
    }


# ==================== Static Files ====================

# Serve frontend
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


@app.get("/")
async def read_index():
    """Serve the main index.html."""
    return FileResponse("frontend/index.html")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
