import {
  formatRuntimeSummary,
  getRuntimeProcessMemory,
  getRegistryFilePath,
  getSharedRegistryFilePath,
  listRuntimes,
} from './e2e-runtime-registry.js';

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

const runtimes = listRuntimes();
console.log(`Local E2E runtime registry: ${getRegistryFilePath()}`);
console.log(`Shared E2E runtime registry: ${getSharedRegistryFilePath()}`);
if (runtimes.length === 0) {
  console.log('No active E2E runtimes registered.');
  process.exit(0);
}

for (const runtime of runtimes) {
  console.log('---');
  console.log(`runtimeId: ${runtime.runtimeId}`);
  console.log(`worktree: ${runtime.worktreeRoot}`);
  console.log(`scope: ${runtime.scope}`);
  console.log(`status: ${runtime.status}`);
  console.log(`mode: ${runtime.mode}`);
  console.log(`workers: ${runtime.workers}`);
  console.log(`ports: ${JSON.stringify(runtime.ports)}`);
  console.log(`target: ${runtime.target || '<unknown>'}`);
  console.log(`ownerPids: ${JSON.stringify(runtime.ownerPids ?? [])}`);
  console.log(`servicePids: ${JSON.stringify(runtime.servicePids ?? [])}`);
  console.log(`createdAt: ${runtime.createdAt}`);
  console.log(`lastHeartbeatAt: ${runtime.lastHeartbeatAt ?? '<unknown>'}`);
  console.log(`updatedAt: ${runtime.updatedAt}`);
  const memory = getRuntimeProcessMemory(runtime);
  console.log(`memory.totalWorkingSet: ${formatBytes(memory.totalWorkingSetBytes)}`);
  if (memory.totalPrivateBytes > 0) {
    console.log(`memory.totalPrivate: ${formatBytes(memory.totalPrivateBytes)}`);
  }
  for (const owner of memory.owner) {
    console.log(`memory.owner.${owner.pid}: ${owner.name || 'unknown'} | WS=${formatBytes(owner.workingSetBytes)}${owner.privateBytes > 0 ? ` | Private=${formatBytes(owner.privateBytes)}` : ''}`);
  }
  for (const service of memory.services) {
    console.log(`memory.service.${service.label}: pid=${service.pid} ${service.name || 'unknown'} | WS=${formatBytes(service.workingSetBytes)}${service.privateBytes > 0 ? ` | Private=${formatBytes(service.privateBytes)}` : ''}`);
  }
  for (const other of memory.others) {
    console.log(`memory.other.${other.pid}: ${other.name || 'unknown'} | WS=${formatBytes(other.workingSetBytes)}${other.privateBytes > 0 ? ` | Private=${formatBytes(other.privateBytes)}` : ''}`);
  }
  console.log(`summary: ${formatRuntimeSummary(runtime)}`);
}
