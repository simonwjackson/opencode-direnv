import { execFile } from "node:child_process"
import { statSync } from "node:fs"
import { dirname } from "node:path"
import { promisify } from "node:util"
import { inflateSync } from "node:zlib"
import { findEnvrc } from "./envrc.js"

/**
 * OpenCode V2 support.
 *
 * V2 runs plugins inside a long-lived server shared by every project and
 * session, so mutating `process.env` (the V1 approach) would leak one
 * project's environment into all the others. Instead, the `shell` domain's
 * `create.before` hook applies the direnv diff to each shell command's own
 * `env`, resolved for that command's `cwd`.
 *
 * Behavior:
 * - Searches from the command's cwd up to its git root for .envrc
 * - Runs `direnv export json` against the command's environment and applies
 *   the diff (null values unset a variable)
 * - Reuses the result while every file direnv watches is unchanged (.envrc,
 *   its allow/deny state, `watch_file` entries such as a flake.lock), so a
 *   `direnv allow`/`deny` or an edited watched file takes effect on the next
 *   command
 * - Leaves the environment untouched if direnv is not installed, the .envrc
 *   is blocked, or no .envrc exists
 */

const run = promisify(execFile)

type Environment = Record<string, string | undefined>

type ShellCreateBefore = {
  cwd: string
  env: Environment
}

type Registration = {
  dispose: () => Promise<void>
}

export type V2Context = {
  shell: {
    hook: (
      name: "create.before",
      handler: (event: ShellCreateBefore) => Promise<void>
    ) => Promise<Registration>
  }
}

type DirenvDiff = Record<string, string | null>

type Watch = {
  path: string
  modtime: number
  exists: boolean
}

type Loaded = {
  diff: DirenvDiff
  watches: Watch[]
}

/**
 * Decode DIRENV_WATCHES (zlib-compressed JSON, base64url) into the files
 * direnv watches; an unreadable value yields no watches (never cached).
 */
const decodeWatches = (encoded: string | null | undefined): Watch[] => {
  if (!encoded) return []
  try {
    const watches: unknown = JSON.parse(inflateSync(Buffer.from(encoded, "base64url")).toString())
    return Array.isArray(watches) ? (watches as Watch[]) : []
  } catch {
    return []
  }
}

const unchanged = ({ path, modtime, exists }: Watch): boolean => {
  try {
    return exists && Math.trunc(statSync(path).mtimeMs / 1000) === modtime
  } catch {
    return !exists
  }
}

const findGitRoot = async (cwd: string, env: Environment): Promise<string | null> => {
  try {
    const { stdout } = await run("git", ["rev-parse", "--show-toplevel"], { cwd, env })
    return stdout.trim() || null
  } catch {
    return null
  }
}

export const setupV2 = async (ctx: V2Context) => {
  const cache = new Map<string, Loaded>()

  const loadDirenv = async (envrcPath: string, env: Environment): Promise<DirenvDiff | null> => {
    const cached = cache.get(envrcPath)
    if (cached && cached.watches.every(unchanged)) return cached.diff

    try {
      const { stdout } = await run("direnv", ["export", "json"], {
        cwd: dirname(envrcPath),
        env,
        maxBuffer: 16 * 1024 * 1024,
      })
      const diff: DirenvDiff = stdout.trim() ? JSON.parse(stdout) : {}
      const watches = decodeWatches(diff.DIRENV_WATCHES)
      if (watches.length > 0) cache.set(envrcPath, { diff, watches })
      return diff
    } catch {
      // direnv not installed, .envrc blocked, or export failed
      cache.delete(envrcPath)
      return null
    }
  }

  const registration = await ctx.shell.hook("create.before", async (event) => {
    const envrcPath = findEnvrc(event.cwd, await findGitRoot(event.cwd, event.env))
    if (!envrcPath) return

    const diff = await loadDirenv(envrcPath, event.env)
    if (!diff) return

    for (const [key, value] of Object.entries(diff)) {
      if (value === null) delete event.env[key]
      else event.env[key] = value
    }
  })

  return () => registration.dispose()
}
