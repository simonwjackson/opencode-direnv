// Tests for the OpenCode V2 entry point (dist/v2.js via the default export).
// A fake `direnv` on PATH stands in for the real binary so the tests are
// deterministic and need no direnv install: it prints $FAKE_DIRENV_OUT,
// records each run in $FAKE_DIRENV_COUNT and exits with $FAKE_DIRENV_EXIT.

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { deflateSync } from "node:zlib"
import plugin, { DirenvLoader } from "../dist/index.js"

const encodeWatches = (watches) => deflateSync(Buffer.from(JSON.stringify(watches))).toString("base64url")

function fixture({ envrc = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "opencode-direnv-v2-"))
  const project = join(root, "project")
  const bin = join(root, "bin")
  mkdirSync(join(project, "sub"), { recursive: true })
  mkdirSync(bin)
  execFileSync("git", ["init", "-q"], { cwd: project })
  const envrcPath = join(project, ".envrc")
  if (envrc) writeFileSync(envrcPath, "export FOO=bar\n")
  writeFileSync(
    join(bin, "direnv"),
    '#!/bin/sh\necho run >> "$FAKE_DIRENV_COUNT"\ncat "$FAKE_DIRENV_OUT"\nexit "${FAKE_DIRENV_EXIT:-0}"\n'
  )
  chmodSync(join(bin, "direnv"), 0o755)
  const out = join(root, "out.json")
  const count = join(root, "count")
  writeFileSync(count, "")
  const env = {
    PATH: `${bin}:${process.env.PATH}`,
    HOME: root,
    FAKE_DIRENV_OUT: out,
    FAKE_DIRENV_COUNT: count,
    REMOVE_ME: "stale",
  }
  const watch = () => ({ path: envrcPath, modtime: Math.trunc(statSync(envrcPath).mtimeMs / 1000), exists: true })
  return { project, envrcPath, out, env, watch, runs: () => readFileSync(count, "utf8").split("\n").filter(Boolean).length }
}

async function setup() {
  let handler
  const cleanup = await plugin.setup({
    shell: {
      hook: async (name, fn) => {
        assert.equal(name, "create.before")
        handler = fn
        return { dispose: async () => {} }
      },
    },
  })
  return { handler, cleanup }
}

const event = (f, cwd = f.project) => ({ cwd, env: { ...f.env } })

test("default export serves both majors and the named export is the same object", () => {
  assert.equal(typeof plugin.id, "string")
  assert.equal(typeof plugin.setup, "function")
  assert.equal(typeof plugin.server, "function")
  assert.equal(DirenvLoader, plugin)
})

test("applies the direnv diff to the shell command env, unsetting null keys", async () => {
  const f = fixture()
  writeFileSync(f.out, JSON.stringify({ FOO: "bar", REMOVE_ME: null }))
  const { handler } = await setup()
  const ev = event(f, join(f.project, "sub"))
  await handler(ev)
  assert.equal(ev.env.FOO, "bar")
  assert.equal("REMOVE_ME" in ev.env, false)
})

test("never mutates the shared server process.env", async () => {
  const f = fixture()
  writeFileSync(f.out, JSON.stringify({ OPENCODE_DIRENV_PROCESS_PROBE: "leak" }))
  const { handler } = await setup()
  await handler(event(f))
  assert.equal(process.env.OPENCODE_DIRENV_PROCESS_PROBE, undefined)
})

test("leaves the env untouched when there is no .envrc", async () => {
  const f = fixture({ envrc: false })
  writeFileSync(f.out, JSON.stringify({ FOO: "bar" }))
  const { handler } = await setup()
  const ev = event(f)
  await handler(ev)
  assert.deepEqual(ev.env, f.env)
  assert.equal(f.runs(), 0)
})

test("leaves the env untouched when direnv fails (blocked .envrc, not installed)", async () => {
  const f = fixture()
  writeFileSync(f.out, "")
  const { handler } = await setup()
  const ev = event(f)
  ev.env.FAKE_DIRENV_EXIT = "1"
  await handler(ev)
  assert.equal(ev.env.FOO, undefined)
  assert.equal(ev.env.REMOVE_ME, "stale")
})

test("reuses the result while watched files are unchanged and reloads when one changes", async () => {
  const f = fixture()
  writeFileSync(f.out, JSON.stringify({ FOO: "first", DIRENV_WATCHES: encodeWatches([f.watch()]) }))
  const { handler } = await setup()

  const first = event(f)
  await handler(first)
  const second = event(f)
  await handler(second)
  assert.equal(second.env.FOO, "first")
  assert.equal(f.runs(), 1)

  const later = new Date(Date.now() + 10_000)
  utimesSync(f.envrcPath, later, later)
  writeFileSync(f.out, JSON.stringify({ FOO: "second", DIRENV_WATCHES: encodeWatches([f.watch()]) }))
  const third = event(f)
  await handler(third)
  assert.equal(third.env.FOO, "second")
  assert.equal(f.runs(), 2)
})
