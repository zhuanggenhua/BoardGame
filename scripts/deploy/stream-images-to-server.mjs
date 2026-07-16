#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const rawArgs = process.argv.slice(2);

const helpText = `
将生产镜像输送到服务器，并可选触发本地镜像部署

用法:
  node scripts/deploy/stream-images-to-server.mjs [选项]

选项:
  --tag <tag>                目标镜像 tag，默认 latest
  --host <user@host>         SSH 目标，默认 admin@8.148.71.102
  --remote-dir <path>        远端项目目录，默认 /home/admin/BoardGame
  --ssh-key-path <path>      SSH 私钥路径；默认读取 BOARDGAME_DEPLOY_SSH_KEY_PATH
  --known-hosts-path <path>  known_hosts 路径；默认读取 BOARDGAME_DEPLOY_SSH_KNOWN_HOSTS_PATH
  --deploy                   输送完成后，远端执行 update-local
  --skip-local-pull          跳过本地 docker pull，要求本地已存在目标镜像
  --dry-run                  只打印命令，不真正执行
  --help                     显示帮助

说明:
  1. 本脚本在网络更好的机器或 CI 上执行。
  2. 它会先在本地导出镜像 tar，再通过 scp 上传到生产机，最后在生产机本地执行 docker image load。
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
const host = readArgValue('host', process.env.BOARDGAME_DEPLOY_SSH_TARGET || 'admin@8.148.71.102').trim();
const remoteDir = readArgValue('remote-dir', '/home/admin/BoardGame').trim();
const sshKeyPath = readArgValue('ssh-key-path', process.env.BOARDGAME_DEPLOY_SSH_KEY_PATH || '').trim();
const knownHostsPath = readArgValue('known-hosts-path', process.env.BOARDGAME_DEPLOY_SSH_KNOWN_HOSTS_PATH || '').trim();
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
const localArchivePath = path.join(os.tmpdir(), `boardgame-images-${tag}-${process.pid}.tar`);
const remoteArchivePath = `/tmp/boardgame-images-${tag}-${process.pid}.tar`;

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

const exportLocalArchive = async () => {
  await runCommand('docker', ['image', 'save', '-o', localArchivePath, ...imageRefs], '导出本地镜像 tar');
};

const uploadArchiveToRemote = async () => {
  await runCommand('scp', [...sshClientArgs, localArchivePath, `${host}:${remoteArchivePath}`], '上传镜像 tar 到服务器');
};

const loadArchiveOnRemote = async () => {
  await runCommand(
    'ssh',
    [...sshClientArgs, host, `docker image load -i ${shellQuote(remoteArchivePath)}`],
    '服务器本地导入镜像 tar',
  );
};

const cleanupLocalArchive = async () => {
  await rm(localArchivePath, { force: true });
};

const cleanupRemoteArchive = async () => {
  try {
    await runCommand('ssh', [...sshClientArgs, host, `rm -f ${shellQuote(remoteArchivePath)}`], '清理服务器镜像 tar');
  } catch (error) {
    console.warn(`[stream-images] 清理服务器镜像 tar 失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

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

const sshClientArgs = [
  '-o', 'BatchMode=yes',
  '-o', 'ConnectTimeout=20',
  '-o', 'ServerAliveInterval=20',
  '-o', 'ServerAliveCountMax=3',
  '-o', 'StrictHostKeyChecking=yes',
];

if (sshKeyPath) {
  sshClientArgs.push('-o', 'IdentitiesOnly=yes', '-i', sshKeyPath);
}

if (knownHostsPath) {
  sshClientArgs.push('-o', `UserKnownHostsFile=${knownHostsPath}`);
}

const main = async () => {
  console.log('[stream-images] 目标镜像:');
  console.log(`  - game-server: ${gameRef}`);
  console.log(`  - web: ${webRef}`);
  console.log(`[stream-images] 目标服务器: ${host}`);
  console.log(`[stream-images] 远端目录: ${remoteDir}`);
  console.log(`[stream-images] 本地临时 tar: ${localArchivePath}`);
  console.log(`[stream-images] 远端临时 tar: ${remoteArchivePath}`);
  if (shouldDeploy) {
    console.log(`[stream-images] 输送完成后远端执行: ssh ${host} "${remoteDeployCommand}"`);
  }

  if (dryRun) {
    console.log('[stream-images] dry-run 模式，不实际执行');
    return;
  }

  await ensureLocalImagesReady();
  try {
    await exportLocalArchive();
    await uploadArchiveToRemote();
    await loadArchiveOnRemote();

    if (shouldDeploy) {
      await runCommand('ssh', [...sshClientArgs, host, remoteDeployCommand], '远端 update-local 部署');
    }
  } finally {
    await cleanupRemoteArchive();
    await cleanupLocalArchive();
  }
};

main().catch((error) => {
  console.error(`[stream-images] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
