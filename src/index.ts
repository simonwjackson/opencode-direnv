import type { Plugin } from "@opencode-ai/plugin"
import { findEnvrc } from "./envrc.js"
import { setupV2 } from "./v2.js"

/**
 * Direnv Auto-Loader Plugin for OpenCode
 *
 * OpenCode 1.x: the behavior below. OpenCode 2.x: see ./v2.ts.
 *
 * Automatically loads environment variables from direnv at session start.
 * This ensures bash commands have access to project-specific env vars
 * defined in .envrc files (commonly used with Nix flakes).
 *
 * Behavior:
 * - Runs `direnv export json` on session creation
 * - Applies exported variables to process.env
 * - Searches from project directory up to git root for .envrc
 * - Shows toast notification if .envrc is blocked
 * - Silently skips if direnv is not installed or .envrc is missing
 */

type ToastVariant = "info" | "success" | "warning" | "error"

type SessionClient = {
  tui: {
    showToast: (opts: {
      body: { message: string; variant: ToastVariant }
    }) => Promise<void>
  }
}

type DirenvResult = {
  envVars: Record<string, string> | null
  blocked: boolean
  envrcPath: string | null
}

type SessionCreatedEvent = {
  type: "session.created"
  properties: { info: { id: string } }
}

type ShellCommand = {
  quiet: () => ShellCommand
  cwd: (dir: string) => ShellCommand
  text: () => Promise<string>
}

type ShellExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => ShellCommand

const serverV1: Plugin = async ({ client, $, directory }) => {
  const loadedSessions = new Set<string>()
  const typedClient = client as unknown as SessionClient
  const shell = $ as unknown as ShellExecutor

  /**
   * Find git root directory, if one exists
   */
  const findGitRoot = async (): Promise<string | null> => {
    try {
      const result = await shell`git rev-parse --show-toplevel`.quiet().text()
      return result.trim() || null
    } catch {
      return null
    }
  }

  /**
   * Load direnv environment variables
   */
  const loadDirenv = async (): Promise<DirenvResult> => {
    const result: DirenvResult = {
      envVars: null,
      blocked: false,
      envrcPath: null,
    }

    try {
      // Find git root to use as search boundary
      const gitRoot = await findGitRoot()

      // Find .envrc file
      const envrcPath = findEnvrc(directory, gitRoot)
      if (!envrcPath) {
        return result
      }

      result.envrcPath = envrcPath

      // Get the directory containing .envrc
      const { dirname } = await import("node:path")
      const envrcDir = dirname(envrcPath)

      // Run direnv export from the .envrc directory
      // Capture both stdout and stderr
      const proc = shell`direnv export json`.cwd(envrcDir).quiet()

      try {
        const output = await proc.text()

        if (output.trim()) {
          result.envVars = JSON.parse(output) as Record<string, string>
        }
      } catch (error: unknown) {
        // Check if it's a blocked error by examining stderr
        const stderr =
          typeof error === "object" &&
          error !== null &&
          "stderr" in error &&
          typeof (error as { stderr: unknown }).stderr === "string"
            ? (error as { stderr: string }).stderr
            : ""
        if (stderr.includes("is blocked")) {
          result.blocked = true
        }
      }

      return result
    } catch {
      // direnv not installed or other error
      return result
    }
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
        const typedEvent = event as SessionCreatedEvent
        const sessionID = typedEvent.properties.info.id

        // Only load once per session
        if (loadedSessions.has(sessionID)) return
        loadedSessions.add(sessionID)

        const { envVars, blocked, envrcPath } = await loadDirenv()

        if (blocked && envrcPath) {
          await typedClient.tui.showToast({
            body: {
              message: "direnv: .envrc is blocked. Run `direnv allow` to enable.",
              variant: "warning",
            },
          })
          return
        }

        if (envVars) {
          // Apply to process.env so child processes (bash commands) inherit them
          Object.assign(process.env, envVars)

          await typedClient.tui.showToast({
            body: {
              message: "direnv: environment loaded",
              variant: "info",
            },
          })
        }
      }
    },
  }
}

// One default export serves both OpenCode majors: V2 reads `id` + `setup`,
// V1 calls `server`. The named export is the same object, so a V1 loader that
// walks every export still loads the plugin once.
export const DirenvLoader = {
  id: "opencode-direnv",
  setup: setupV2,
  server: serverV1,
}

export default DirenvLoader
