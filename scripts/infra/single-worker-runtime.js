import fs from 'node:fs';
import path from 'node:path';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS } from './e2e-port-config.js';
import { isPortInUse } from './port-allocator.js';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import {
  registerExitGuard,
  spawnBundleRunner,
  spawnNodeScript,
  spawnTsLoaderEntry,
  spawnTsxEntry,
} from './e2e-server-launcher.js';
import { startRuntimeHeartbeat } from './e2e-runtime-registry.js';

function resolvePort(value, fallback) {
  const port = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(port) && port > 0 ? port : fallback;
}

function normalizeScopeSegment(scope) {
  const normalized = String(scope ?? 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return normalized || 'default';
}

function getScopedBundleRoot(runtimeScope) {
  return path.join('temp', 'dev-bundles', 'e2e-single', normalizeScopeSegment(runtimeScope));
}

function createRuntimeLogWriter(logFile, logger) {
  if (!logFile) {
    return {
      writeLine(message = '') {
        logger.log(message);
      },
      pipeChildOutput() {},
      close() {},
    };
  }

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const stream = fs.createWriteStream(logFile, { flags: 'a' });

  return {
    writeLine(message = '') {
      stream.write(`${message}\n`);
    },
    pipeChildOutput(child) {
      child.stdout?.on('data', chunk => {
        stream.write(chunk);
      });
      child.stderr?.on('data', chunk => {
        stream.write(chunk);
      });
    },
    close() {
      stream.end();
    },
  };
}

export function resolveSingleWorkerRuntimeContext(env = process.env, overrides = {}) {
  const useDevServers = overrides.useDevServers ?? env.PW_USE_DEV_SERVERS === 'true';
  const bundleWatchEnabled = overrides.bundleWatchEnabled ?? env.PW_SERVER_WATCH !== 'false';
  const selectedRuntime = overrides.selectedRuntime ?? (env.PW_SERVER_RUNTIME?.trim() || 'bundle');
  const useTsxRuntime = selectedRuntime === 'tsx';
  const useTsLoaderRuntime = selectedRuntime === 'ts-loader';
  const usePrebuiltRuntime = selectedRuntime === 'prebuilt';
  const defaultPorts = useDevServers ? DEV_SERVER_PORTS : E2E_SINGLE_WORKER_PORTS;
  const prebuiltBundleRoot = env.PW_PREBUILT_BUNDLE_ROOT ?? path.join('temp', 'dev-bundles', 'e2e-single');
  const runtimeScope = overrides.runtimeScope ?? env.PW_RUNTIME_SCOPE ?? 'default';
  const target = overrides.target ?? env.PW_TEST_TARGET ?? '';
  const targetLabel = overrides.targetLabel ?? env.PW_E2E_TARGET?.trim() ?? target;
  const requestedRuntimeMode = overrides.runtimeMode ?? env.PW_E2E_DAEMON?.trim() ?? '';
  const runtimeMode = requestedRuntimeMode === 'shared-single' || requestedRuntimeMode === 'isolated-single'
    ? requestedRuntimeMode
    : (useDevServers ? 'shared-dev' : 'shared-single-run');
  const runtimeMetadata = {
    sessionId: overrides.sessionId ?? env.PW_E2E_SESSION_ID?.trim() ?? '',
    entrypoint: overrides.entrypoint ?? env.PW_E2E_ENTRYPOINT?.trim() ?? '',
    commandSource: overrides.commandSource ?? env.PW_E2E_COMMAND_SOURCE?.trim() ?? '',
    targetLabel,
  };

  return {
    useDevServers,
    bundleWatchEnabled,
    selectedRuntime,
    useTsxRuntime,
    useTsLoaderRuntime,
    usePrebuiltRuntime,
    prebuiltBundleRoot,
    runtimeScope,
    runtimeMode,
    target,
    runtimeMetadata,
    ports: {
      frontend: resolvePort(env.PW_PORT ?? env.VITE_DEV_PORT, defaultPorts.frontend),
      gameServer: resolvePort(env.PW_GAME_SERVER_PORT ?? env.GAME_SERVER_PORT, defaultPorts.gameServer),
      apiServer: resolvePort(env.PW_API_SERVER_PORT ?? env.API_SERVER_PORT, defaultPorts.apiServer),
    },
  };
}

export async function startSingleWorkerRuntime(options = {}) {
  const env = options.env ?? process.env;
  const logger = options.logger ?? console;
  const logFile = options.logFile?.trim() || '';
  const childStdio = options.childStdio ?? (logFile ? ['ignore', 'pipe', 'pipe'] : 'inherit');
  const context = resolveSingleWorkerRuntimeContext(env, {
    runtimeMode: options.runtimeMode,
    runtimeScope: options.runtimeScope,
    target: options.target,
    targetLabel: options.targetLabel,
    sessionId: options.sessionId,
    entrypoint: options.entrypoint,
    commandSource: options.commandSource,
  });
  const runtimeLog = createRuntimeLogWriter(logFile, logger);
  const {
    bundleWatchEnabled,
    ports,
    prebuiltBundleRoot,
    runtimeMetadata,
    runtimeMode,
    runtimeScope,
    selectedRuntime,
    target,
    usePrebuiltRuntime,
    useTsLoaderRuntime,
    useTsxRuntime,
  } = context;
  const scopedBundleRoot = getScopedBundleRoot(runtimeScope);

  await assertChildProcessSupport('single worker E2E 启动', {
    probeEsbuild: !(usePrebuiltRuntime || useTsLoaderRuntime),
  });

  runtimeLog.writeLine('');
  runtimeLog.writeLine('🚀 启动单 worker E2E 服务...');
  runtimeLog.writeLine(`  前端: http://localhost:${ports.frontend}`);
  runtimeLog.writeLine(`  游戏服务: http://localhost:${ports.gameServer}`);
  runtimeLog.writeLine(`  API 服务: http://localhost:${ports.apiServer}`);
  runtimeLog.writeLine(`  服务运行时: ${selectedRuntime}`);
  if (logFile) {
    runtimeLog.writeLine(`  启动日志: ${logFile}`);
  }
  runtimeLog.writeLine('');

  const busyPorts = Object.entries(ports)
    .filter(([, port]) => isPortInUse(port))
    .map(([name, port]) => `${name}(${port})`);

  if (busyPorts.length > 0) {
    throw new Error(
      [
        `以下端口已被占用: ${busyPorts.join(', ')}`,
        'single-worker E2E 使用共享固定端口；在多 AI / 多 worktree 并行时，这通常意味着另一条测试正在运行。',
        '请优先改用隔离 worker / 分配端口，或在确认独占后再显式执行共享端口清理。',
      ].join('\n'),
    );
  }

  const prebuiltGameEntry = path.join(prebuiltBundleRoot, 'game', 'server.mjs');
  const prebuiltApiEntry = path.join(prebuiltBundleRoot, 'api', 'main.mjs');
  if (usePrebuiltRuntime && (!fs.existsSync(prebuiltGameEntry) || !fs.existsSync(prebuiltApiEntry))) {
    throw new Error(
      [
        'PW_SERVER_RUNTIME=prebuilt 需要预构建产物，但未找到以下文件：',
        `- ${prebuiltGameEntry}`,
        `- ${prebuiltApiEntry}`,
        '请先通过 dev-bundle-runner 生成，或切回 PW_SERVER_RUNTIME=tsx/ts-loader/bundle。',
      ].join('\n'),
    );
  }

  const frontend = spawnNodeScript('scripts/infra/vite-with-logging.js', {
    ...env,
    E2E_PROXY_QUIET: 'true',
    GAME_SERVER_PORT: String(ports.gameServer),
    API_SERVER_PORT: String(ports.apiServer),
  }, [
    '--host',
    '127.0.0.1',
    '--port',
    String(ports.frontend),
    '--configLoader',
    env.VITE_CONFIG_LOADER || 'native',
  ], {
    stdio: childStdio,
  });

  const gameServerEnv = {
    ...env,
    NODE_ENV: 'test',
    GAME_SERVER_PORT: String(ports.gameServer),
    USE_PERSISTENT_STORAGE: 'false',
  };

  const gameServer = useTsxRuntime
    ? spawnTsxEntry({
      entry: 'server.ts',
      tsconfig: 'tsconfig.server.json',
      env: gameServerEnv,
      spawnOptions: { stdio: childStdio },
    })
    : useTsLoaderRuntime
      ? spawnTsLoaderEntry({
        entry: 'server.ts',
        tsconfig: 'tsconfig.server.json',
        env: gameServerEnv,
        spawnOptions: { stdio: childStdio },
      })
      : usePrebuiltRuntime
        ? spawnNodeScript(prebuiltGameEntry, gameServerEnv, [], {
          stdio: childStdio,
        })
        : spawnBundleRunner({
          label: 'e2e-game-single',
          entry: 'server.ts',
          outfile: path.join(scopedBundleRoot, 'game', 'server.mjs'),
          tsconfig: 'tsconfig.server.json',
          watch: bundleWatchEnabled,
          env: gameServerEnv,
          spawnOptions: { stdio: childStdio },
        });

  const apiServerEnv = {
    ...env,
    NODE_ENV: 'test',
    API_SERVER_PORT: String(ports.apiServer),
  };

  const apiServer = useTsxRuntime
    ? spawnTsxEntry({
      entry: 'apps/api/src/main.ts',
      tsconfig: 'apps/api/tsconfig.json',
      env: apiServerEnv,
      spawnOptions: { stdio: childStdio },
    })
    : useTsLoaderRuntime
      ? spawnTsLoaderEntry({
        entry: 'apps/api/src/main.ts',
        tsconfig: 'apps/api/tsconfig.json',
        env: apiServerEnv,
        spawnOptions: { stdio: childStdio },
      })
      : usePrebuiltRuntime
        ? spawnNodeScript(prebuiltApiEntry, apiServerEnv, [], {
          stdio: childStdio,
        })
        : spawnBundleRunner({
          label: 'e2e-api-single',
          entry: 'apps/api/src/main.ts',
          outfile: path.join(scopedBundleRoot, 'api', 'main.mjs'),
          tsconfig: 'apps/api/tsconfig.json',
          watch: bundleWatchEnabled,
          env: apiServerEnv,
          spawnOptions: { stdio: childStdio },
        });

  const managedServices = [
    { label: '前端服务', child: frontend },
    { label: '游戏服务', child: gameServer },
    { label: 'API 服务', child: apiServer },
  ];

  for (const service of managedServices) {
    runtimeLog.pipeChildOutput(service.child);
  }

  let stopped = false;
  let rejectFailure;
  const failurePromise = new Promise((_, reject) => {
    rejectFailure = reject;
  });

  const stopHeartbeat = startRuntimeHeartbeat(runtimeScope, () => ({
    active: true,
    mode: runtimeMode,
    workers: 1,
    ports,
    target,
    targetLabel: runtimeMetadata.targetLabel,
    ownerPids: [process.pid],
    servicePids: managedServices.map(service => service.child.pid).filter(pid => Number.isInteger(pid) && pid > 0),
    bootstrapLogFiles: logFile ? [logFile] : [],
    sessionId: runtimeMetadata.sessionId,
    entrypoint: runtimeMetadata.entrypoint,
    commandSource: runtimeMetadata.commandSource,
  }));

  const stop = (reason = '') => {
    if (stopped) {
      return;
    }
    stopped = true;
    stopHeartbeat();
    runtimeLog.writeLine('');
    runtimeLog.writeLine('🛑 停止单 worker E2E 服务...');
    if (reason) {
      runtimeLog.writeLine(`  原因: ${reason}`);
    }
    for (const service of managedServices) {
      runtimeLog.writeLine(`  - ${service.label} pid=${service.child.pid ?? 'unknown'}`);
      try {
        service.child.kill();
      } catch {
        // ignore
      }
    }
    runtimeLog.close();
  };

  for (const service of managedServices) {
    registerExitGuard(
      service.child,
      service.label,
      (detail) => {
        stop(detail);
        rejectFailure(new Error(detail));
      },
      { bootstrapLogFile: logFile },
    );
  }

  runtimeLog.writeLine('✅ 单 worker E2E 服务已启动');
  runtimeLog.writeLine('   按 Ctrl+C 停止所有服务');
  runtimeLog.writeLine('');

  return {
    context,
    ports,
    runtimeMode,
    runtimeScope,
    logFile,
    managedServices,
    failurePromise,
    getServicePids() {
      return managedServices.map(service => service.child.pid).filter(pid => Number.isInteger(pid) && pid > 0);
    },
    stop,
  };
}
