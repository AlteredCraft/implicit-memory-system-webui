#!/usr/bin/env python3
"""
Generate Mermaid Sequence Diagram from Session Trace

This script reads a session trace JSON file and generates a Mermaid sequence diagram
showing the interaction flow between User, Host App, LLM, and Memory System.

Usage:
    python scripts/generate_sequence_diagram.py <session_trace_file.json>

The diagram is saved to ./diagrams/ directory with a name based on the session ID.
"""

import json
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any


def escape_text(text: str, max_length: int = 50) -> str:
    """
    Escape special characters and truncate text for Mermaid diagram.

    Args:
        text: Text to escape
        max_length: Maximum length before truncation

    Returns:
        Escaped and truncated text
    """
    # Replace newlines and quotes
    text = text.replace('\n', '<br/>')
    text = text.replace('"', "'")

    # Truncate if too long
    if len(text) > max_length:
        text = text[:max_length] + "..."

    return text


def generate_mermaid_diagram(trace_data: Dict[str, Any]) -> str:
    """
    Generate a Mermaid sequence diagram from session trace data.

    Args:
        trace_data: Parsed session trace JSON

    Returns:
        Mermaid diagram as a string
    """
    lines = [
        "---",
        f"Session ID: {trace_data.get('session_id', 'unknown')}",
        f"Start Time: {trace_data.get('start_time', 'unknown')}",
        f"Model: {trace_data.get('model', 'unknown')}",
        "---",
        "",
        "```mermaid",
        "sequenceDiagram",
        "    participant User",
        "    participant HostApp as Host App<br/>(chat.py)",
        "    participant LLM as Claude LLM",
        "    participant MemorySystem as Memory System<br/>(memory_tool)",
        "",
        "    Note over HostApp: Session Started",
    ]

    events = trace_data.get('events', [])
    turn_number = 0
    in_turn = False

    for i, event in enumerate(events):
        event_type = event.get('event_type')

        if event_type == 'user_input':
            # Start a new conversation turn
            turn_number += 1
            content = escape_text(event.get('content', ''))

            lines.append("")
            lines.append(f"    rect rgb(200, 220, 255)")
            lines.append(f"        Note over User,MemorySystem: Turn {turn_number}: User Input")
            lines.append("")
            lines.append(f'        User->>HostApp: "{content}"')
            lines.append("        HostApp->>HostApp: Append to messages")
            in_turn = True

        elif event_type == 'llm_request':
            if in_turn:
                lines.append("")
                lines.append(f"        HostApp->>LLM: POST /messages<br/>tools: {event.get('tools', [])}")

        elif event_type == 'tool_call':
            tool_name = event.get('tool_name', '')
            command = event.get('command', '')
            parameters = event.get('parameters', {})

            if tool_name == 'memory':
                # Format parameters for display
                params_str = ', '.join([f"{k}={repr(v)[:30]}" for k, v in parameters.items()])
                if len(params_str) > 50:
                    params_str = params_str[:50] + "..."

                lines.append("")
                lines.append(f"        Note over LLM: Decides to {command}")
                lines.append(f"        LLM->>MemorySystem: {command}({params_str})")
                lines.append("        activate MemorySystem")

        elif event_type == 'tool_result':
            tool_name = event.get('tool_name', '')
            command = event.get('command', '')
            success = event.get('success', True)
            error = event.get('error')
            result = event.get('result', '')

            if tool_name == 'memory':
                if success:
                    result_preview = escape_text(result, 40)
                    lines.append(f'        MemorySystem-->>LLM: {result_preview}')
                else:
                    error_msg = escape_text(error or 'Error', 40)
                    lines.append(f'        MemorySystem-->>LLM: ERROR: {error_msg}')
                lines.append("        deactivate MemorySystem")

        elif event_type == 'llm_response':
            content = escape_text(event.get('content', ''), 60)

            lines.append("")
            lines.append("        Note over LLM: Ready to respond")
            lines.append(f'        LLM-->>HostApp: "{content}"')
            lines.append("        HostApp->>HostApp: Append to messages")
            lines.append(f'        HostApp-->>User: "{content}"')

            if in_turn:
                lines.append("    end")
                in_turn = False

        elif event_type == 'error':
            error_msg = escape_text(event.get('message', 'Unknown error'), 40)
            lines.append(f"    Note over HostApp: ERROR: {error_msg}")

    # Close any open turn
    if in_turn:
        lines.append("    end")

    lines.append("")
    lines.append("    Note over HostApp: Session Ended")
    lines.append("```")

    return '\n'.join(lines)


def main():
    """Main entry point for the script."""
    parser = argparse.ArgumentParser(
        description='Generate Mermaid sequence diagram from session trace'
    )
    parser.add_argument(
        'trace_file',
        help='Path to session trace JSON file'
    )
    parser.add_argument(
        '-o', '--output',
        help='Output file path (default: ./diagrams/sequence_<session_id>.md)'
    )

    args = parser.parse_args()

    # Read the trace file
    trace_path = Path(args.trace_file)
    if not trace_path.exists():
        print(f"Error: Trace file not found: {trace_path}")
        return 1

    try:
        with open(trace_path, 'r', encoding='utf-8') as f:
            trace_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in trace file: {e}")
        return 1

    # Generate the diagram
    diagram = generate_mermaid_diagram(trace_data)

    # Determine output path
    if args.output:
        output_path = Path(args.output)
    else:
        diagrams_dir = Path('./diagrams')
        diagrams_dir.mkdir(exist_ok=True)

        session_id = trace_data.get('session_id', 'unknown')
        output_path = diagrams_dir / f"sequence_{session_id}.md"

    # Ensure output directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write the diagram
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(diagram)

    # Output the path (this is what the user sees)
    print(f"Sequence diagram saved to: {output_path}")

    return 0


if __name__ == '__main__':
    exit(main())
