import fs from 'fs';
import path from 'path';

const EXCLUDE_PATH = path.resolve('scripts/audio/registry-exclusions.json');
const REGISTRY_PATHS = [
  path.resolve('public/assets/common/audio/registry.json'),
  path.resolve('src/assets/audio/registry.json'),
];

const loadExcludedKeys = () => {
  const raw = fs.readFileSync(EXCLUDE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const list = Array.isArray(parsed?.excludeKeys) ? parsed.excludeKeys : [];
  return new Set(list.filter((value) => typeof value === 'string' && value.trim().length > 0));
};

const applyExclusions = (registryPath, excludedKeys) => {
  const raw = fs.readFileSync(registryPath, 'utf8');
  const registry = JSON.parse(raw);
  const before = Array.isArray(registry.entries) ? registry.entries.length : 0;
  const entries = (registry.entries ?? []).filter((entry) => !excludedKeys.has(entry.key));
  const removed = before - entries.length;
  const nextRegistry = {
    ...registry,
    total: entries.length,
    entries,
  };
  fs.writeFileSync(registryPath, `${JSON.stringify(nextRegistry, null, 2)}\n`, 'utf8');
  console.log(`[AudioRegistryExclusions] ${path.relative(process.cwd(), registryPath)} removed=${removed} remain=${entries.length}`);
};

const main = () => {
  const excludedKeys = loadExcludedKeys();
  if (excludedKeys.size === 0) {
    console.log('[AudioRegistryExclusions] no excluded keys, skipped');
    return;
  }
  for (const registryPath of REGISTRY_PATHS) {
    applyExclusions(registryPath, excludedKeys);
  }
};

main();
