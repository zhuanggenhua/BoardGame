/**
 * 启动单 worker E2E 所需的前端、游戏服务、API 三个服务。
 */

import path from 'node:path';
import fs from 'node:fs';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS } from './e2e-port-config.js';
import { isPortInUse } from './port-allocator.js';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import { registerExitGuard, spawnBundleRunner, spawnNodeScript, spawnTsLoaderEntry, spawnTsxEntry } from './e2e-server-launcher.js';

const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
const bundleWatchEnabled = process.env.PW_SERVER_WATCH !== 'false';
const selectedRuntime = process.env.PW_SERVER_RUNTIME?.trim() || 'bundle';
const useTsxRuntime = selectedRuntime === 'tsx';
const useTsLoaderRuntime = selectedRuntime === 'ts-loader';
const usePrebuiltRuntime = selectedRuntime === 'prebuilt';
const ports = useDevServers ? DEV_SERVER_PORTS : E2E_SINGLE_WORKER_PORTS;
const prebuiltBundleRoot = process.env.PW_PREBUILT_BUNDLE_ROOT
  ?? path.join('temp', 'dev-bundles', 'e2e-single');
const bootstrapLogFile = process.env.PW_BOOTSTRAP_LOG_FILE?.trim() || '';

await assertChildProcessSupport('single worker E2E 启动', { probeEsbuild: !(usePrebuiltRuntime || useTsLoaderRuntime) });

console.log('\n🚀 启动单 worker E2E 服务...');
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
  console.error('single-worker E2E 使用共享固定端口；在多 AI / 多 worktree 并行时，这通常意味着另一条测试正在运行。');
  console.error('请优先改用隔离 worker / 分配端口，或在确认独占后再显式执行共享端口清理。');
  process.exit(1);
}

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
          label: 'e2e-game-single',
          entry: 'server.ts',
          outfile: path.join('temp', 'dev-bundles', 'e2e-single', 'game', 'server.mjs'),
          tsconfig: 'tsconfig.server.json',
          watch: bundleWatchEnabled,
          env: gameServerEnv,
        });

const apiServerEnv = {
  ...process.env,
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
          label: 'e2e-api-single',
          entry: 'apps/api/src/main.ts',
          outfile: path.join('temp', 'dev-bundles', 'e2e-single', 'api', 'main.mjs'),
          tsconfig: 'apps/api/tsconfig.json',
          watch: bundleWatchEnabled,
          env: apiServerEnv,
        });

const managedServices = [
  { label: '前端服务', child: frontend },
  { label: '游戏服务', child: gameServer },
  { label: 'API 服务', child: apiServer },
];

const cleanup = (exitCode = 0, reason = '') => {
  console.log('\n🛑 停止单 worker E2E 服务...');
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

console.log('✅ 单 worker E2E 服务已启动');
console.log('   按 Ctrl+C 停止所有服务\n');
