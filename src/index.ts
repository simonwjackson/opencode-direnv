import type { Plugin } from "@opencode-ai/plugin"

/**
 * Direnv Auto-Loader Plugin for OpenCode
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



type ShellCommand = {
  quiet: () => ShellCommand
  cwd: (dir: string) => ShellCommand
  text: () => Promise<string>
}

type ShellExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => ShellCommand

export const DirenvLoader: Plugin = async ({ client, $, directory }) => {
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
   * Find .envrc file searching from directory up to stopAt (git root or filesystem root)
   */
  const findEnvrc = async (
    startDir: string,
    stopAt: string | null
  ): Promise<string | null> => {
    const { dirname, join } = await import("node:path")
    const { existsSync } = await import("node:fs")

    let current = startDir
    const boundary = stopAt || "/"

    while (true) {
      const envrcPath = join(current, ".envrc")
      if (existsSync(envrcPath)) {
        return envrcPath
      }

      // Stop if we've reached the boundary
      if (current === boundary || current === "/") {
        break
      }

      const parent = dirname(current)
      // Prevent infinite loop
      if (parent === current) {
        break
      }

      current = parent
    }

    return null
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
      const envrcPath = await findEnvrc(directory, gitRoot)
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
      console.log("[opencode-direnv] Event received:", event.type)
      
      if (event.type === "session.created") {
        console.log("[opencode-direnv] Session created event:", JSON.stringify(event, null, 2))
        
        // Use a simpler session tracking - just track if we've loaded for this directory
        const sessionKey = `${directory}-loaded`
        if (loadedSessions.has(sessionKey)) {
          console.log("[opencode-direnv] Already loaded for this directory, skipping")
          return
        }
        loadedSessions.add(sessionKey)

        const { envVars, blocked, envrcPath } = await loadDirenv()
        console.log("[opencode-direnv] Direnv result:", { hasEnvVars: !!envVars, blocked, envrcPath })

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
