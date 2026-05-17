#!/usr/bin/env node

/**
 * Vite 启动包装器。
 *
 * 常规环境仍走子进程，便于隔离生命周期并收集日志。
 * 若当前环境禁止 `spawn`，则自动回退到“当前进程直接跑 Vite”，
 * 避免包装层自己把 dev server 误拦在门外。
 */

import { spawn } from 'child_process';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { runViteCli } from './vite-cli-safe.mjs';
import { withWindowsHide } from './windows-hide.js';

const DEFAULT_VITE_DEV_PORT = 4273;

const logDir = join(process.cwd(), 'logs');
if (!existsSync(logDir)) {
  mkdirSync(logDir, { recursive: true });
}

const logFile = join(logDir, `vite-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  appendFileSync(logFile, line);
}

function appendStreamLog(prefix, chunk, encoding) {
  try {
    const text = Buffer.isBuffer(chunk)
      ? chunk.toString(typeof encoding === 'string' ? encoding : undefined)
      : String(chunk);
    appendFileSync(logFile, `[${prefix}] ${text}`);
  } catch {
    // 写日志失败时不阻塞 Vite 本身。
  }
}

function teeProcessWrite(stream, prefix) {
  const originalWrite = stream.write.bind(stream);

  stream.write = function patchedWrite(chunk, encoding, callback) {
    appendStreamLog(prefix, chunk, encoding);
    return originalWrite(chunk, encoding, callback);
  };
}

async function runViteInline(reason) {
  log(`[INLINE] ${reason}`);
  log('[INLINE] 改为当前进程直接执行 Vite，避免包装层自己的 spawn 被环境拦截');

  teeProcessWrite(process.stdout, 'STDOUT');
  teeProcessWrite(process.stderr, 'STDERR');

  try {
    await runViteCli(viteArgs);
  } catch (error) {
    const detail = error instanceof Error ? error.stack ?? error.message : String(error);
    log(`[INLINE-ERROR] ${detail}`);
    process.exit(1);
  }
}

function readCliFlagValue(args, flagName) {
  const prefix = `${flagName}=`;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === flagName) {
      const next = args[i + 1];
      return next && !next.startsWith('--') ? next : undefined;
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return undefined;
}

function createViteArgs() {
  const viteArgs = process.argv.slice(2);
  const configLoader = process.env.VITE_CONFIG_LOADER?.trim();
  const configFile = process.env.VITE_CONFIG_FILE?.trim();
  const hasExplicitConfigLoader = viteArgs.some((arg) => arg === '--configLoader' || arg.startsWith('--configLoader='));
  const hasExplicitConfig = viteArgs.some((arg) => arg === '--config' || arg.startsWith('--config='));
  const hasExplicitHost = viteArgs.some((arg) => arg === '--host' || arg.startsWith('--host='));
  const hasExplicitPort = viteArgs.some((arg) => arg === '--port' || arg.startsWith('--port='));
  const explicitHost = readCliFlagValue(viteArgs, '--host');
  const configuredHost = explicitHost || process.env.VITE_HOST?.trim() || '127.0.0.1';
  const configuredPort = process.env.VITE_DEV_PORT?.trim();
  const preferredTsConfigPath = join(process.cwd(), 'vite.config.ts');
  const resolvedConfigFile = configFile || (existsSync(preferredTsConfigPath) ? preferredTsConfigPath : '');

  if (resolvedConfigFile && !hasExplicitConfig) {
    viteArgs.push('--config', resolvedConfigFile);
  }

  if (configLoader && !hasExplicitConfigLoader) {
    viteArgs.push('--configLoader', configLoader);
  }

  if (!hasExplicitPort) {
    const preferredPort = Number(configuredPort);
    const resolvedPort = Number.isFinite(preferredPort) && preferredPort > 0
      ? preferredPort
      : DEFAULT_VITE_DEV_PORT;
    process.env.VITE_DEV_PORT = String(resolvedPort);
  }

  const effectivePort = process.env.VITE_DEV_PORT?.trim();

  if (effectivePort && !hasExplicitHost) {
    viteArgs.push('--host', configuredHost);
  }

  if (effectivePort && !hasExplicitPort) {
    viteArgs.push('--port', effectivePort);
  }

  return viteArgs;
}

log('=== Vite 启动包装器 ===');
log(`日志文件: ${logFile}`);
log(`Node 版本: ${process.version}`);
log(`工作目录: ${process.cwd()}`);
log(`内存限制: ${process.execArgv.join(' ')}`);

const viteEntry = 'scripts/infra/vite-cli-safe.mjs';
const viteArgs = createViteArgs();
const shouldForceInline = process.env.BG_VITE_FORCE_INLINE === '1';

function resolveMaxOldSpaceSizeArg(defaultMb = 8192) {
  const fromNodeOptions = process.env.NODE_OPTIONS?.match(/--max-old-space-size=(\d+)/)?.[1];
  const fromEnv = process.env.BG_NODE_MAX_OLD_SPACE_SIZE?.trim();
  const parsed = Number.parseInt(fromEnv || fromNodeOptions || String(defaultMb), 10);
  const resolved = Number.isFinite(parsed) && parsed > 0 ? parsed : defaultMb;
  return `--max-old-space-size=${resolved}`;
}

log(`Vite 入口: ${viteEntry}`);
log(`Vite 参数: ${viteArgs.join(' ')}`);

if (shouldForceInline) {
  const reason = 'BG_VITE_FORCE_INLINE=1';
  await runViteInline(reason);
} else {
  let inlineMode = false;
  let vite = null;

  try {
    vite = spawn(process.execPath, [
      resolveMaxOldSpaceSizeArg(),
      viteEntry,
      ...viteArgs,
    ], withWindowsHide({
      stdio: ['inherit', 'pipe', 'pipe'],
      env: {
        ...process.env,
        FORCE_COLOR: '1',
        // Vite v7 只把 CI === "true" 视为禁用 stdin end 关服；"1" 仍会被当作非 CI。
        CI: 'true',
      },
    }));
  } catch (error) {
    if (error?.code === 'EPERM' && String(error?.syscall || '').includes('spawn')) {
      inlineMode = true;
      await runViteInline(`spawn 被当前环境同步拒绝：${error.message}`);
    } else {
      throw error;
    }
  }

  if (!inlineMode && vite) {
    log(`Vite 进程 PID: ${vite.pid}`);

    vite.stdout?.on('data', (data) => {
      const message = data.toString();
      process.stdout.write(message);
      appendFileSync(logFile, `[STDOUT] ${message}`);
    });

    vite.stderr?.on('data', (data) => {
      const message = data.toString();
      process.stderr.write(message);
      appendFileSync(logFile, `[STDERR] ${message}`);
    });

    vite.on('error', async (error) => {
      log(`[ERROR] Vite 进程错误: ${error.message}`);
      log(`[ERROR] 堆栈: ${error.stack}`);

      if (error.code === 'EPERM' && String(error.syscall || '').includes('spawn')) {
        inlineMode = true;
        await runViteInline(`spawn 被当前环境异步拒绝：${error.message}`);
        return;
      }

      process.exit(1);
    });

    vite.on('exit', (code, signal) => {
      if (inlineMode) return;

      log('[EXIT] Vite 进程退出');
      log(`[EXIT] 退出码: ${code}`);
      log(`[EXIT] 信号: ${signal}`);

      if (code !== 0 && code !== null) {
        log(`[EXIT] 异常退出，退出码: ${code}`);
        log('[EXIT] 可能原因: OOM / 未捕获异常 / 文件监听错误 / WebSocket 连接问题');
      }

      process.exit(code || 0);
    });

    vite.on('close', (code, signal) => {
      if (inlineMode) return;
      log('[CLOSE] Vite 进程关闭');
      log(`[CLOSE] 退出码: ${code}`);
      log(`[CLOSE] 信号: ${signal}`);
    });

    process.on('SIGINT', () => {
      log('[SIGINT] 收到 SIGINT，准备关闭 Vite');
      vite.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      log('[SIGTERM] 收到 SIGTERM，准备关闭 Vite');
      vite.kill('SIGTERM');
    });
  }
}

process.on('uncaughtException', (error) => {
  log(`[UNCAUGHT] ${error.message}`);
  log(`[UNCAUGHT] ${error.stack}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`[UNHANDLED] Promise 拒绝: ${reason}`);
  log(`[UNHANDLED] Promise: ${promise}`);
});

log('=== Vite 启动完成，开始监听 ===');
