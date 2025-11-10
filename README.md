# Memory System v2

Companion app for **"The Memory Illusion v2: From Explicit Commands to Implicit Trust"**

A demonstration of Claude's autonomous memory management using Anthropic's Memory Tool. Claude decides what to remember from your conversations and manages its own persistent memory across sessions.

**Article:** [The Memory Illusion: Teaching Your LLM to Remember](https://alteredcraft.com/p/the-memory-illusion-teaching-your)

---

## Quick Start

```bash
# 1. Install dependencies
uv sync

# 2. Configure API key
cp .env.example .env
# Add your Anthropic API key to .env

# 3. Run
uv run src/chat.py
```

---

## How It Works

Claude autonomously manages memory during natural conversations:

1. **You chat naturally** - No special commands needed
2. **Claude decides what to remember** - Names, preferences, project details
3. **Memory persists** - Stored as text files in `./memories/`
4. **Automatic recall** - Claude retrieves relevant memories when needed

**Example:**
```
**You**: Hi, I'm Alex. My son Leo turns 5 next Tuesday.
**Claude**: Hi Alex! Nice to meet you. Happy early 5th birthday to Leo!
[Claude creates /memories/user_profile.txt]

# Later...
**You**: What gift ideas do you have?
**Claude**: For Leo's 5th birthday, here are some age-appropriate ideas...
[Claude recalls Leo's age from memory]
```

---

## Commands

- `/quit` - Exit the program
- `/memory_view` - View all stored memories
- `/clear` - Clear all memories and start fresh
- `/debug` - Toggle debug logging to see memory operations
- `/dump` - Display current context window

---

## Features

### System Prompt Selection
Choose from different assistant personalities on startup (see comments in prompt files for explanations):
```bash
prompts
├── concise prompt_explanatory.txt
├── concise prompt.txt
├── more precise prompt_explanatory.txt
└── more precise prompt.txt
```

Add custom prompts by creating `.txt` files in `prompts/` and it will appear as a selection when you start a chat session.

### Session Traces
Every conversation has a trace recorded in `./sessions/` with:
- All messages and responses
- Memory tool operations
- Token usage statistics

Generate visual sequence diagrams from traces:
```bash
python scripts/generate_sequence_diagram.py sessions/session_*.json
```

---

## Troubleshooting

**Claude isn't remembering things?**
- Use an `_explanatory` system prompt
- Enable `/debug` to see tool operations
Based on what you learn, consider updates to your system prompt

**Start fresh?**
- Use `/clear` or delete `./memories/` directory

---

## Learn More

- **Article:** [The Memory Illusion v2](https://alteredcraft.com/p/the-memory-illusion-teaching-your)
- **Anthropic Docs:** [Memory Tool](https://docs.claude.com/en/docs/agents-and-tools/tool-use/memory-tool)
- **Original v1:** [simple_llm_memory_poc](https://github.com/AlteredCraft/simple_llm_memory_poc)
