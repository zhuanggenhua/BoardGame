#!/usr/bin/env node

import { spawn } from 'node:child_process';
import process from 'node:process';

const rawArgs = process.argv.slice(2);

const helpText = `
将生产镜像流式输送到服务器，并可选触发本地镜像部署

用法:
  node scripts/deploy/stream-images-to-server.mjs [选项]

选项:
  --tag <tag>                目标镜像 tag，默认 latest
  --host <user@host>         SSH 目标，默认 admin@8.148.71.102
  --remote-dir <path>        远端项目目录，默认 /home/admin/BoardGame
  --deploy                   输送完成后，远端执行 update-local
  --skip-local-pull          跳过本地 docker pull，要求本地已存在目标镜像
  --dry-run                  只打印命令，不真正执行
  --help                     显示帮助

说明:
  1. 本脚本在网络更好的机器或 CI 上执行。
  2. 它会把业务镜像通过 docker image save | ssh | docker image load 送到生产机。
  3. 若加 --deploy，会在远端执行:
     bash scripts/deploy/deploy-image.sh update-local <tag>
`.trim();

const readArgValue = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const direct = rawArgs.find((arg) => arg.startsWith(prefix));
  if (direct) {
    return direct.slice(prefix.length);
  }
  const index = rawArgs.findIndex((arg) => arg === `--${name}`);
  if (index >= 0 && rawArgs[index + 1]) {
    return rawArgs[index + 1];
  }
  return fallback;
};

const hasFlag = (name) => rawArgs.includes(`--${name}`);

if (hasFlag('help') || rawArgs.includes('-h')) {
  console.log(helpText);
  process.exit(0);
}

const tag = readArgValue('tag', 'latest').trim();
const host = readArgValue('host', 'admin@8.148.71.102').trim();
const remoteDir = readArgValue('remote-dir', '/home/admin/BoardGame').trim();
const shouldDeploy = hasFlag('deploy');
const skipLocalPull = hasFlag('skip-local-pull');
const dryRun = hasFlag('dry-run');

if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(tag)) {
  throw new Error(`无效 tag: ${tag || '<empty>'}`);
}

if (!host) {
  throw new Error('缺少 --host');
}

if (!remoteDir) {
  throw new Error('缺少 --remote-dir');
}

const gameRef = `ghcr.io/zhuanggenhua/boardgame-game:${tag}`;
const webRef = `ghcr.io/zhuanggenhua/boardgame-web:${tag}`;
const imageRefs = [gameRef, webRef];
const remoteDeployCommand = `cd ${shellQuote(remoteDir)} && bash scripts/deploy/deploy-image.sh update-local ${shellQuote(tag)}`;

const runCommand = (command, args, label) => new Promise((resolve, reject) => {
  console.log(`[stream-images] 执行 ${label}: ${command} ${args.join(' ')}`);
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
    shell: false,
  });
  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`${label} 失败，退出码: ${code ?? 'unknown'}`));
  });
});

const runPipedTransfer = () => new Promise((resolve, reject) => {
  console.log(`[stream-images] 开始流式传输镜像到 ${host}`);
  const save = spawn('docker', ['image', 'save', ...imageRefs], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    windowsHide: true,
    shell: false,
  });
  const load = spawn('ssh', [host, 'docker', 'image', 'load'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
    windowsHide: true,
    shell: false,
  });

  save.stdout.pipe(load.stdin);
  save.stderr.pipe(process.stderr);

  let saveExitCode = null;
  let loadExitCode = null;
  let settled = false;

  const finish = (error) => {
    if (settled) return;
    settled = true;
    if (error) {
      if (save.exitCode === null) {
        save.kill('SIGTERM');
      }
      if (load.exitCode === null) {
        load.kill('SIGTERM');
      }
      reject(error);
      return;
    }
    resolve();
  };

  save.on('error', (error) => finish(error));
  load.on('error', (error) => finish(error));

  save.on('exit', (code) => {
    saveExitCode = code ?? 1;
    if (saveExitCode !== 0) {
      finish(new Error(`docker image save 失败，退出码: ${saveExitCode}`));
      return;
    }
    if (loadExitCode === 0) {
      finish();
    }
  });

  load.on('exit', (code) => {
    loadExitCode = code ?? 1;
    if (loadExitCode !== 0) {
      finish(new Error(`远端 docker image load 失败，退出码: ${loadExitCode}`));
      return;
    }
    if (saveExitCode === 0) {
      finish();
    }
  });
});

const ensureLocalImagesReady = async () => {
  if (!skipLocalPull) {
    await runCommand('docker', ['pull', gameRef], '本地拉取 game 镜像');
    await runCommand('docker', ['pull', webRef], '本地拉取 web 镜像');
  }

  await runCommand('docker', ['image', 'inspect', gameRef], '检查本地 game 镜像');
  await runCommand('docker', ['image', 'inspect', webRef], '检查本地 web 镜像');
};

function shellQuote(value) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

const main = async () => {
  console.log('[stream-images] 目标镜像:');
  console.log(`  - game-server: ${gameRef}`);
  console.log(`  - web: ${webRef}`);
  console.log(`[stream-images] 目标服务器: ${host}`);
  console.log(`[stream-images] 远端目录: ${remoteDir}`);
  if (shouldDeploy) {
    console.log(`[stream-images] 输送完成后远端执行: ssh ${host} "${remoteDeployCommand}"`);
  }

  if (dryRun) {
    console.log('[stream-images] dry-run 模式，不实际执行');
    return;
  }

  await ensureLocalImagesReady();
  await runPipedTransfer();

  if (shouldDeploy) {
    await runCommand('ssh', [host, remoteDeployCommand], '远端 update-local 部署');
  }
};

main().catch((error) => {
  console.error(`[stream-images] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
