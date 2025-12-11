<div align="center">

# opencode-direnv

**Seamless direnv integration for OpenCode**

[![npm version](https://img.shields.io/npm/v/opencode-direnv?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/opencode-direnv)
[![npm downloads](https://img.shields.io/npm/dm/opencode-direnv?style=flat-square&logo=npm&logoColor=white)](https://www.npmjs.com/package/opencode-direnv)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/Bun-%3E%3D1.0-f9f1e1?style=flat-square&logo=bun&logoColor=black)](https://bun.sh/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![direnv](https://img.shields.io/badge/direnv-compatible-FFC107?style=flat-square&logo=gnubash&logoColor=white)](https://direnv.net/)
[![OpenCode Plugin](https://img.shields.io/badge/OpenCode-Plugin-8B5CF6?style=flat-square)](https://opencode.ai/)

---

*Automatically load [direnv](https://direnv.net/) environment variables when OpenCode sessions start.*

[Installation](#installation) •
[Usage](#usage) •
[Configuration](#configuration) •
[API](#how-it-works) •
[Contributing](#contributing)

![Demo](demo.gif)

</div>

---

## Overview

opencode-direnv automatically detects and loads `.envrc` files, ensuring your OpenCode sessions have access to the same environment variables you use in your terminal.

### Key Features

- **Automatic Detection** — Searches for `.envrc` from the project directory up to the git root
- **Seamless Integration** — Applies environment variables to `process.env` for all subsequent commands
- **Smart Notifications** — Toast alerts for blocked `.envrc` files and successful environment loads
- **Zero Configuration** — Works out of the box with sensible defaults
- **Graceful Degradation** — Silently skips if direnv is not installed or no `.envrc` exists

---

## Requirements

| Dependency | Version | Required | Notes |
|------------|---------|----------|-------|
| [OpenCode](https://opencode.ai/) | `>=1.0.0` | Yes | Plugin host environment |
| [direnv](https://direnv.net/) | `>=2.0.0` | Yes | Must be available in PATH |
| TypeScript | `>=5.0.0` | Dev only | For building from source |

---

## Installation

### Via OpenCode Config

Just add the plugin to your configuration — OpenCode handles installation automatically.

### Configuration

Add the plugin to your OpenCode configuration:

**Project-level** (`./opencode.json`):
```json
{
  "plugin": ["opencode-direnv"]
}
```

**Global** (`~/.config/opencode/opencode.json`):
```json
{
  "plugin": ["opencode-direnv"]
}
```

---

## Usage

### Basic Setup

1. Ensure [direnv](https://direnv.net/) is installed on your system
2. Create or configure your `.envrc` file in your project
3. Allow the `.envrc` file:
   ```bash
   direnv allow
   ```
4. Start an OpenCode session — environment variables are loaded automatically

### Use Cases

| Scenario | Description |
|----------|-------------|
| **Nix Flakes** | Automatically load `use flake` environments for reproducible development |
| **Project Secrets** | Securely load API keys and credentials from `.envrc` |
| **Tool Versioning** | Leverage direnv's `layout` functions for project-specific tooling |
| **Database Connections** | Load connection strings and credentials per-project |
| **Cloud Configurations** | Set AWS, GCP, or Azure credentials per-project |

### Example `.envrc`

```bash
# Nix flake environment
use flake

# Project-specific variables
export DATABASE_URL="postgresql://localhost/myapp"
export API_KEY="your-api-key-here"

# Tool versions via asdf/mise
use asdf
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                     Session Creation                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. Search for .envrc (project dir → git root → filesystem root)│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. Execute `direnv export json`                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. Parse JSON and apply to process.env                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. All bash commands inherit environment variables             │
└─────────────────────────────────────────────────────────────────┘
```

### Behavior Details

1. **Session Start** — Plugin hooks into OpenCode session creation
2. **Directory Traversal** — Searches upward from project directory, stopping at git root
3. **Environment Export** — Executes `direnv export json` for structured output
4. **Variable Application** — Merges exported variables into `process.env`

---

## Notifications

| Type | Condition | Message |
|------|-----------|---------|
| Warning | `.envrc` is blocked | Prompts user to run `direnv allow` |
| Info | Environment loaded | Confirms successful environment application |
| *Silent* | No direnv or `.envrc` | No notification displayed |

---

## Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| Single Load | Environment loaded once per session | Start new session for `.envrc` changes |
| Manual Allow | `.envrc` must be explicitly allowed | Run `direnv allow` (security feature) |
| No Unload | Variables persist until session ends | Sessions are isolated by design |

---

## Troubleshooting

### Common Issues

**Environment not loading**
```bash
# Verify direnv is installed
which direnv

# Check if .envrc exists and is allowed
direnv status
```

**Variables not available in commands**
```bash
# Ensure .envrc is allowed
direnv allow

# Verify export works
direnv export json
```

**Plugin not activating**
- Confirm plugin is listed in `opencode.json`
- Check OpenCode logs for plugin initialization errors

---

## Contributing

Contributions are welcome. Please read our contributing guidelines before submitting a pull request.

```bash
# Clone the repository
git clone https://github.com/simonwjackson/opencode-direnv.git
cd opencode-direnv

# Install dependencies
bun install

# Build
bun run build
```

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Built with**

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-f9f1e1?style=for-the-badge&logo=bun&logoColor=black)](https://bun.sh/)

---

Made with care by [@simonwjackson](https://github.com/simonwjackson)

</div>
