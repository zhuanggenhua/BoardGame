#!/usr/bin/env node

import { existsSync, mkdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const skills = join(root, '.spec', 'skills')
const agents = join(root, '.spec', 'agents')
const dryRun = process.argv.includes('--dry-run')
const hosts = [
  { target: join(root, '.codex', 'skill'), source: skills },
  { target: join(root, '.agents', 'skills'), source: skills },
  { target: join(root, '.claude', 'skills'), source: skills },
  { target: join(root, '.claude', 'agents'), source: agents },
]

function normalizedRealPath(path) {
  const real = realpathSync.native(path)
  return process.platform === 'win32' ? real.toLowerCase() : real
}

function pointsToCanonical(target, source) {
  if (!existsSync(target)) return false
  try {
    return normalizedRealPath(target) === normalizedRealPath(source)
  } catch {
    return false
  }
}

for (const { target, source } of hosts) {
  if (!existsSync(source)) throw new Error(`Canonical source missing: ${relative(root, source)}`)
  if (pointsToCanonical(target, source)) {
    console.log(`LINK_OK ${relative(root, target)} -> ${relative(root, source)}`)
    continue
  }
  if (existsSync(target)) {
    throw new Error(`Refusing to replace non-link host path: ${relative(root, target)}`)
  }
  if (dryRun) {
    console.log(`WOULD_LINK ${relative(root, target)} -> ${relative(root, source)}`)
    continue
  }
  rmSync(target, { recursive: true, force: true })
  mkdirSync(dirname(target), { recursive: true })
  symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir')
  console.log(`LINKED ${relative(root, target)} -> ${relative(root, source)}`)
}
