#!/bin/bash
# Startup script for Memory System v2 Web UI

echo "🧠 Memory System v2 - Web UI"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo ""
    echo "📝 Please edit .env and add your ANTHROPIC_API_KEY"
    echo "   Then run this script again."
    echo ""
    exit 1
fi

# Check if API key is set
if ! grep -q "ANTHROPIC_API_KEY=sk-ant-" .env 2>/dev/null; then
    echo "⚠️  Warning: ANTHROPIC_API_KEY not configured in .env"
    echo "📝 Please edit .env and add your API key, then run this script again."
    echo ""
    exit 1
fi

echo "✓ Environment configured"
echo ""
echo "Starting FastAPI server..."
echo "Navigate to: http://localhost:8000"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Run the server
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8888 --reload
