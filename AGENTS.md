# zxc - CLI Coding Assistant

## Overview

A terminal-based AI coding assistant powered by Ollama. Provides an interactive chat interface for reading files, executing commands, editing code, and writing new files.

## Project Structure

```
src/
  index.ts       - Entry point, initializes chat loop
  agent.ts       - Core agent logic, handles tool execution
  tools.ts       - Tool definitions (read, list, edit, write, bash)
  ollama.ts      - Ollama API integration
  config.ts      - Configuration management (~/.zxc/zxc.json)
  history.ts     - Chat history management
  ui/            - Terminal UI components (colors, prompts, output)
```

## Key Concepts

- **Tools**: The agent has 5 tools: `read`, `list`, `edit`, `write`, `bash`
- **Config**: Stored in `~/.zxc/zxc.json`, defaults to first available Ollama model
- **System Prompt**: Defines agent behavior and tool usage guidelines

## Development Guidelines

- Avoid comments in code - make it self-explanatory
