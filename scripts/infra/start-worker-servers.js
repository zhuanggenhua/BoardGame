/**
 * 为指定 worker 启动一组隔离的 E2E 服务。
 *
 * 用法:
 *   node scripts/infra/start-worker-servers.js <workerId>
 */

import path from 'node:path';
import fs from 'node:fs';
import { allocateAvailablePorts, loadWorkerPorts, saveWorkerPorts, isPortInUse } from './port-allocator.js';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import { registerExitGuard, spawnBundleRunner, spawnNodeScript, spawnTsLoaderEntry, spawnTsxEntry } from './e2e-server-launcher.js';
import { startRuntimeHeartbeat } from './e2e-runtime-registry.js';

const workerId = Number.parseInt(process.argv[2] ?? '', 10);
const bundleWatchEnabled = process.env.PW_SERVER_WATCH === 'true';
const selectedRuntime = process.env.PW_SERVER_RUNTIME?.trim() || 'bundle';
const useTsxRuntime = selectedRuntime === 'tsx';
const useTsLoaderRuntime = selectedRuntime === 'ts-loader';
const usePrebuiltRuntime = selectedRuntime === 'prebuilt';
const prebuiltBundleRoot = process.env.PW_PREBUILT_BUNDLE_ROOT
  ?? path.join('temp', 'dev-bundles', `e2e-worker-${workerId}`);
const bootstrapLogFile = process.env.PW_BOOTSTRAP_LOG_FILE?.trim() || '';
const runtimeMetadata = {
  sessionId: process.env.PW_E2E_SESSION_ID?.trim() || '',
  entrypoint: process.env.PW_E2E_ENTRYPOINT?.trim() || '',
  commandSource: process.env.PW_E2E_COMMAND_SOURCE?.trim() || '',
  targetLabel: process.env.PW_E2E_TARGET?.trim() || process.env.PW_TEST_TARGET?.trim() || '',
};

if (Number.isNaN(workerId)) {
  console.error('用法: node scripts/infra/start-worker-servers.js <workerId>');
  process.exit(1);
}

await assertChildProcessSupport(`Worker ${workerId} E2E 服务启动`, { probeEsbuild: !(usePrebuiltRuntime || useTsLoaderRuntime) });

const ports = loadWorkerPorts(workerId) ?? await allocateAvailablePorts(workerId);
console.log(`\n🚀 启动 Worker ${workerId} 的 E2E 服务...`);
console.log(`  前端: http://localhost:${ports.frontend}`);
console.log(`  游戏服务: http://localhost:${ports.gameServer}`);
console.log(`  API 服务: http://localhost:${ports.apiServer}`);
console.log(`  服务运行时: ${selectedRuntime}`);
if (bootstrapLogFile) {
  console.log(`  启动日志: ${bootstrapLogFile}`);
}
console.log('');

const busyPorts = Object.entries(ports)
  .filter(([, port]) => isPortInUse(port))
  .map(([name, port]) => `${name}(${port})`);

if (busyPorts.length > 0) {
  console.error(`以下端口已被占用: ${busyPorts.join(', ')}`);
  console.error(`请先运行: node scripts/infra/port-allocator.js ${workerId}`);
  process.exit(1);
}

saveWorkerPorts(workerId, ports);

const prebuiltGameEntry = path.join(prebuiltBundleRoot, 'game', 'server.mjs');
const prebuiltApiEntry = path.join(prebuiltBundleRoot, 'api', 'main.mjs');

if (usePrebuiltRuntime) {
  if (!fs.existsSync(prebuiltGameEntry) || !fs.existsSync(prebuiltApiEntry)) {
    console.error(
      [
        'PW_SERVER_RUNTIME=prebuilt 需要预构建产物，但未找到以下文件：',
        `- ${prebuiltGameEntry}`,
        `- ${prebuiltApiEntry}`,
        '请先通过 dev-bundle-runner 生成，或切回 PW_SERVER_RUNTIME=tsx/ts-loader/bundle。',
      ].join('\n'),
    );
    process.exit(1);
  }
}

const frontend = spawnNodeScript('scripts/infra/vite-with-logging.js', {
  ...process.env,
  E2E_PROXY_QUIET: 'true',
  GAME_SERVER_PORT: String(ports.gameServer),
  API_SERVER_PORT: String(ports.apiServer),
}, [
  '--host',
  '127.0.0.1',
  '--port',
  String(ports.frontend),
  '--configLoader',
  process.env.VITE_CONFIG_LOADER || 'native',
]);

const gameServerEnv = {
  ...process.env,
  NODE_ENV: 'test',
  GAME_SERVER_PORT: String(ports.gameServer),
  USE_PERSISTENT_STORAGE: 'false',
};

const gameServer = useTsxRuntime
  ? spawnTsxEntry({
      entry: 'server.ts',
      tsconfig: 'tsconfig.server.json',
      env: gameServerEnv,
    })
  : useTsLoaderRuntime
    ? spawnTsLoaderEntry({
        entry: 'server.ts',
        tsconfig: 'tsconfig.server.json',
        env: gameServerEnv,
      })
    : usePrebuiltRuntime
      ? spawnNodeScript(
          prebuiltGameEntry,
          gameServerEnv,
        )
      : spawnBundleRunner({
          label: `e2e-game-worker-${workerId}`,
          entry: 'server.ts',
          outfile: path.join('temp', 'dev-bundles', `e2e-worker-${workerId}`, 'game', 'server.mjs'),
          tsconfig: 'tsconfig.server.json',
          watch: bundleWatchEnabled,
          env: gameServerEnv,
        });

const apiServerEnv = {
  ...process.env,
  NODE_ENV: 'test',
  API_SERVER_PORT: String(ports.apiServer),
};

const apiServer = useTsxRuntime
  ? spawnTsxEntry({
      entry: 'apps/api/src/main.ts',
      tsconfig: 'apps/api/tsconfig.json',
      env: apiServerEnv,
    })
  : useTsLoaderRuntime
    ? spawnTsLoaderEntry({
        entry: 'apps/api/src/main.ts',
        tsconfig: 'apps/api/tsconfig.json',
        env: apiServerEnv,
      })
    : usePrebuiltRuntime
      ? spawnNodeScript(
          prebuiltApiEntry,
          apiServerEnv,
        )
      : spawnBundleRunner({
          label: `e2e-api-worker-${workerId}`,
          entry: 'apps/api/src/main.ts',
          outfile: path.join('temp', 'dev-bundles', `e2e-worker-${workerId}`, 'api', 'main.mjs'),
          tsconfig: 'apps/api/tsconfig.json',
          watch: bundleWatchEnabled,
          env: apiServerEnv,
        });

const managedServices = [
  { label: '前端服务', child: frontend },
  { label: '游戏服务', child: gameServer },
  { label: 'API 服务', child: apiServer },
];
const runtimeScope = process.env.PW_RUNTIME_SCOPE ?? 'default';
const stopHeartbeat = startRuntimeHeartbeat(runtimeScope, () => ({
  active: true,
  ownerPids: [process.pid],
  servicePids: managedServices.map(service => service.child.pid).filter(pid => Number.isInteger(pid) && pid > 0),
  serviceDetails: managedServices.map(service => ({
    label: service.label,
    pid: Number.isInteger(service.child.pid) && service.child.pid > 0 ? service.child.pid : null,
  })),
  bootstrapLogFiles: bootstrapLogFile ? [bootstrapLogFile] : [],
  targetLabel: runtimeMetadata.targetLabel,
  sessionId: runtimeMetadata.sessionId,
  entrypoint: runtimeMetadata.entrypoint,
  commandSource: runtimeMetadata.commandSource,
}));

const cleanup = (exitCode = 0, reason = '') => {
  stopHeartbeat();
  console.log(`\n🛑 停止 Worker ${workerId} 的 E2E 服务...`);
  if (reason) {
    console.error(`  原因: ${reason}`);
  }
  for (const service of managedServices) {
    console.log(`  - ${service.label} pid=${service.child.pid ?? 'unknown'}`);
    service.child.kill();
  }
  process.exit(exitCode);
};

process.on('SIGINT', () => cleanup(0, '收到 SIGINT'));
process.on('SIGTERM', () => cleanup(0, '收到 SIGTERM'));

for (const service of managedServices) {
  registerExitGuard(
    service.child,
    service.label,
    detail => cleanup(1, detail),
    { bootstrapLogFile },
  );
}

console.log(`✅ Worker ${workerId} 服务已启动`);
console.log('   按 Ctrl+C 停止所有服务\n');
