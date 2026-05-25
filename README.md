# LoveCode AI ⚡

**Open-source terminal-native autonomous coding agent powered by free AI models.**

LoveCode AI is a terminal-first autonomous coding assistant that helps developers write code, edit files, debug issues, execute commands, understand repositories, and automate workflows — using free and local AI models.

```bash
npm install -g lovecode-ai
lovecode
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Lightweight** | Fast startup and low RAM usage |
| **Open Source** | Community-driven, MIT licensed |
| **Terminal Native** | Keyboard-first workflow, no IDE required |
| **Free AI First** | No paid API dependency |
| **Autonomous** | Multi-step agent workflows |
| **Offline Capable** | Local AI support via Ollama |

## Install

### npm (recommended)

```bash
npm install -g lovecode-ai
```

### From source

```bash
git clone https://github.com/anomalyco/lovecode.git
cd lovecode
npm install
npm run build
npm link
```

## Quick Start

```bash
# Start an interactive chat session
lovecode chat

# Run an autonomous task
lovecode run "refactor the auth module to use async/await"

# Initialize LoveCode in your project
lovecode init
```

## Usage

### `lovecode chat`

Start an interactive chat session with LoveCode AI.

```bash
lovecode chat                      # defaults to codellama via Ollama
lovecode chat -m deepseek-coder    # use a different model
lovecode chat -p ollama            # specify provider
```

### `lovecode run`

Run LoveCode AI on a specific task in autonomous mode.

```bash
lovecode run "add input validation"
lovecode run "fix the failing tests" --dir ./packages/core
```

### `lovecode init`

Initialize LoveCode AI configuration in your project.

```bash
lovecode init
lovecode init --force    # overwrite existing config
```

## AI Providers

| Provider | Free? | Offline? | Default Model |
|----------|-------|----------|---------------|
| **Ollama** | ✅ | ✅ | codellama |
| OpenAI Compatible | ✅ | ❌ | gpt-4o-mini |

LoveCode prioritizes **free** and **local** providers by default.

### Prerequisites for local models

1. Install [Ollama](https://ollama.com)
2. Pull a model: `ollama pull codellama`
3. Run LoveCode: `lovecode chat`

## Configuration

LoveCode looks for config in `.lovecode/config` in your project or `~/.config/lovecode/`.

```json
{
  "provider": "ollama",
  "model": "codellama",
  "temperature": 0.2,
  "maxTokens": 4096
}
```

## Architecture

```
lovecode/
├── bin/              # CLI entry point
├── src/
│   ├── commands/     # Command implementations
│   ├── core/         # Agent and tool system
│   ├── ai/           # AI provider integrations
│   └── utils/        # Shared utilities
├── dist/             # Compiled output
└── .lovecode/        # Project config
```

## Roadmap

- [x] CLI framework with chat, run, and init commands
- [ ] File read/write/edit tools
- [ ] Shell command execution
- [ ] Multi-step autonomous agent loop
- [ ] Code search (grep, glob)
- [ ] Git integration
- [ ] Multiple provider support
- [ ] Plugin system
- [ ] MCP server support
- [ ] Windows/WSL/Termux support

## Requirements

- **Node.js** 18+
- **Ollama** (for local AI) or an OpenAI-compatible API

## Development

```bash
git clone https://github.com/anomalyco/lovecode.git
cd lovecode
npm install
npm run dev           # watch mode
npm run build         # production build
npm run test          # run tests
npm run lint          # lint code
npm run typecheck     # type check
```

## Why LoveCode?

Most AI coding assistants are:
- **Paid** — requiring expensive subscriptions
- **Heavy** — running inside resource-hungry IDEs
- **Closed** — proprietary, with no community input
- **Tied to the cloud** — requiring internet always-on

LoveCode AI is none of those. It runs in your terminal, uses free/local AI, and is fully open source.

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">Built with ❤️ for the terminal</p>
