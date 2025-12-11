# opencode-direnv

OpenCode plugin that automatically loads [direnv](https://direnv.net/) environment variables at session start.

## Features

- Automatically runs `direnv export json` when a new session is created
- Searches for `.envrc` from project directory up to git root
- Applies environment variables to `process.env` for all subsequent commands
- Shows toast notifications:
  - Warning when `.envrc` is blocked (prompts to run `direnv allow`)
  - Info when environment is successfully loaded
- Silently skips if direnv is not installed or no `.envrc` exists

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-direnv"]
}
```

Or in your global config at `~/.config/opencode/opencode.json`.

## Requirements

- [direnv](https://direnv.net/) must be installed and available in PATH
- Your `.envrc` must be allowed (`direnv allow`)

## How it Works

1. On session creation, the plugin searches for `.envrc` starting from the project directory
2. Search stops at git root (if in a git repo) or filesystem root
3. Runs `direnv export json` to get environment variables
4. Applies variables to `process.env` so all bash commands inherit them

## Use Cases

- **Nix flakes**: Load `use flake` environments automatically
- **Project secrets**: Load API keys and credentials from `.envrc`
- **Tool versions**: Use direnv's `layout` functions for project-specific tooling

## Limitations

- Environment is loaded once per session; changes to `.envrc` require a new session
- Must run `direnv allow` manually if `.envrc` is blocked (security feature of direnv)
- No unloading when session ends (sessions are isolated)

## License

MIT
