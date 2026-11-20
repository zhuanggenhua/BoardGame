/**
 * 启动单 worker E2E 所需的前端、游戏服务、API 三个服务。
 *
 * 兼容入口：
 * - legacy global-setup 仍可直接 spawn 本脚本
 * - 标准 supervisor 路径改为直接复用 single-worker-runtime 模块
 */

import { startSingleWorkerRuntime } from './single-worker-runtime.js';

const runtime = await startSingleWorkerRuntime({
  env: process.env,
  logger: console,
  logFile: '',
});

async function shutdown(exitCode = 0, reason = '') {
  await runtime.stop(reason);
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0, '收到 SIGINT'));
process.on('SIGTERM', () => shutdown(0, '收到 SIGTERM'));

try {
  await runtime.failurePromise;
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  await shutdown(1, message);
}
