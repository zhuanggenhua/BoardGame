import { listActiveRuntimes, getRegistryFilePath } from './e2e-runtime-registry.js';

const runtimes = listActiveRuntimes();
console.log(`E2E runtime registry: ${getRegistryFilePath()}`);
if (runtimes.length === 0) {
  console.log('No active E2E runtimes registered.');
  process.exit(0);
}

for (const runtime of runtimes) {
  console.log('---');
  console.log(`scope: ${runtime.scope}`);
  console.log(`mode: ${runtime.mode}`);
  console.log(`workers: ${runtime.workers}`);
  console.log(`ports: ${JSON.stringify(runtime.ports)}`);
  console.log(`target: ${runtime.target || '<unknown>'}`);
  console.log(`createdAt: ${runtime.createdAt}`);
  console.log(`updatedAt: ${runtime.updatedAt}`);
}
