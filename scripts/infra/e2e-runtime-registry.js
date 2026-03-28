import * as fs from 'node:fs';
import * as path from 'node:path';

function getTmpDir(cwd = process.cwd()) {
  return path.join(cwd, '.tmp');
}

export function getRegistryFilePath(cwd = process.cwd()) {
  return path.join(getTmpDir(cwd), 'e2e-runtime-registry.json');
}

function ensureTmpDir(cwd = process.cwd()) {
  const tmpDir = getTmpDir(cwd);
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
}

export function readRuntimeRegistry(cwd = process.cwd()) {
  const filePath = getRegistryFilePath(cwd);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return { runtimes: [], updatedAt: null };
  }
}

function writeRuntimeRegistry(data, cwd = process.cwd()) {
  ensureTmpDir(cwd);
  const filePath = getRegistryFilePath(cwd);
  fs.writeFileSync(filePath, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2));
}

export function upsertRuntime(record, cwd = process.cwd()) {
  const registry = readRuntimeRegistry(cwd);
  const runtimes = Array.isArray(registry.runtimes) ? registry.runtimes : [];
  const next = runtimes.filter(entry => entry.scope !== record.scope);
  next.push({ ...record, updatedAt: new Date().toISOString() });
  writeRuntimeRegistry({ runtimes: next }, cwd);
}

export function removeRuntime(scope, cwd = process.cwd()) {
  const registry = readRuntimeRegistry(cwd);
  const runtimes = Array.isArray(registry.runtimes) ? registry.runtimes : [];
  writeRuntimeRegistry({ runtimes: runtimes.filter(entry => entry.scope !== scope) }, cwd);
}

export function listActiveRuntimes(cwd = process.cwd()) {
  const registry = readRuntimeRegistry(cwd);
  const runtimes = Array.isArray(registry.runtimes) ? registry.runtimes : [];
  return runtimes.filter(entry => entry?.active !== false);
}
