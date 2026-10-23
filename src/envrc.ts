import { existsSync } from "node:fs"
import { dirname, join } from "node:path"

/**
 * Find .envrc file searching from directory up to stopAt (git root or filesystem root)
 */
export const findEnvrc = (startDir: string, stopAt: string | null): string | null => {
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
