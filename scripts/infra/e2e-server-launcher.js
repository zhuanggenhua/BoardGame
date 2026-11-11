import { spawn } from 'child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { withWindowsHide } from './windows-hide.js';
import { prependNodePath, resolveWorkspaceNodeModuleFile } from './node-module-resolver.mjs';

function createSpawnOptions(env, overrides = {}) {
  return {
    stdio: overrides.stdio ?? 'inherit',
    env,
    ...withWindowsHide({}, env),
  };
}

export function spawnNodeScript(scriptPath, env, args = [], spawnOptions = {}) {
  return spawn(process.execPath, [scriptPath, ...args], createSpawnOptions(env, spawnOptions));
}

export function spawnBundleRunner({ label, entry, outfile, tsconfig, env, watch = true, spawnOptions = {} }) {
  const runnerArgs = [
    '--label', label,
    '--entry', entry,
    '--outfile', outfile,
    '--tsconfig', tsconfig,
  ];
  if (!watch) {
    runnerArgs.push('--once', 'true');
  }

  return spawnNodeScript('scripts/infra/dev-bundle-runner.mjs', env, [
    ...runnerArgs,
  ], spawnOptions);
}

export function spawnTsxEntry({ entry, tsconfig, env, spawnOptions = {} }) {
  const tsxCliInfo = resolveWorkspaceNodeModuleFile('tsx/dist/cli.mjs', {
    label: 'tsx CLI',
    cwd: process.cwd(),
  });
  return spawn(process.execPath, [
    tsxCliInfo.filePath,
    '--tsconfig',
    tsconfig,
    entry,
  ], createSpawnOptions(prependNodePath(env, tsxCliInfo.nodeModulesRoot), spawnOptions));
}

export function spawnTsLoaderEntry({ entry, env, tsconfig, spawnOptions = {} }) {
  const loaderUrl = pathToFileURL(path.resolve('scripts/infra/ts-runtime-loader.mjs')).href;
  return spawn(process.execPath, [
    '--loader',
    loaderUrl,
    entry,
  ], {
    stdio: spawnOptions.stdio ?? 'inherit',
    env: {
      ...env,
      ...(tsconfig ? { TS_RUNTIME_TSCONFIG: path.resolve(tsconfig) } : {}),
    },
    ...withWindowsHide({}, env),
  });
}

export function spawnNpxCommand(args, env) {
  const npmCliInfo = resolveWorkspaceNodeModuleFile('npm/bin/npm-cli.js', {
    label: 'npm CLI',
    cwd: process.cwd(),
  });
  return spawn(process.execPath, [npmCliInfo.filePath, 'exec', '--yes', '--', ...args], createSpawnOptions(prependNodePath(env, npmCliInfo.nodeModulesRoot)));
}

export function registerExitGuard(child, label, onFailure, options = {}) {
  const bootstrapLogFile = options.bootstrapLogFile?.trim();

  child.on('error', error => {
    const detailParts = [
      `${label}进程启动失败`,
      `pid=${child.pid ?? 'unknown'}`,
      `error=${error instanceof Error ? error.message : String(error)}`,
    ];

    if (bootstrapLogFile) {
      detailParts.push(`bootstrapLog=${bootstrapLogFile}`);
    }

    const detail = detailParts.join(', ');
    console.error(detail);
    onFailure(detail);
  });

  child.on('exit', (code, signal) => {
    const stoppedByParent = code === null && (signal === 'SIGINT' || signal === 'SIGTERM');
    if (code === 0 || stoppedByParent) {
      return;
    }

    const detailParts = [
      `${label}异常退出`,
      `pid=${child.pid ?? 'unknown'}`,
    ];

    if (code !== null) {
      detailParts.push(`code=${code}`);
    }

    if (signal) {
      detailParts.push(`signal=${signal}`);
    }

    if (bootstrapLogFile) {
      detailParts.push(`bootstrapLog=${bootstrapLogFile}`);
    }

    const detail = detailParts.join(', ');
    console.error(detail);
    onFailure(detail);
  });
}
