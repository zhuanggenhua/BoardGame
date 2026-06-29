import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);

const helpText = `
部署 + Android OTA 一键编排

用法:
  node scripts/release/deploy-and-ota.mjs [选项]

默认行为:
  1. 等待 10 分钟
  2. ssh 到生产机执行: bash scripts/deploy/deploy-image.sh update
  3. 本地执行: node scripts/mobile/release-android.mjs ota --channel stable

选项:
  --wait-minutes <number>    等待多少分钟后再开始，默认 10
  --skip-wait                立即执行，不等待
  --dry-run                  只打印将执行的命令，不真正执行
  --deploy-mode <mode>       部署模式：remote | stream，默认 remote
  --host <user@host>         覆盖 SSH 目标，默认 admin@8.148.71.102
  --remote-dir <path>        覆盖远端项目目录，默认 /home/admin/BoardGame
  --deploy-tag <tag>         远端执行 update <tag>；不传则执行 update latest
  --ota-channel <name>       OTA channel，默认 stable
  --skip-ota                 只更新服务器，不执行本地 Android OTA 发布
  --ota-extra "<args>"       追加给 release-android ota 的额外参数
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

const waitMinutesRaw = readArgValue('wait-minutes', '10');
const waitMinutes = Number.parseFloat(waitMinutesRaw);
const dryRun = hasFlag('dry-run');
const skipWait = hasFlag('skip-wait');
const deployMode = readArgValue('deploy-mode', 'remote');
const sshTarget = readArgValue('host', 'admin@8.148.71.102');
const remoteDir = readArgValue('remote-dir', '/home/admin/BoardGame');
const deployTag = readArgValue('deploy-tag', '');
const otaChannel = readArgValue('ota-channel', 'stable');
const skipOta = hasFlag('skip-ota');
const otaExtraRaw = readArgValue('ota-extra', '').trim();
const otaExtraArgs = otaExtraRaw ? otaExtraRaw.split(/\s+/).filter(Boolean) : [];

if (hasFlag('help') || rawArgs.includes('-h')) {
    console.log(helpText);
    process.exit(0);
}

if (!skipWait && (!Number.isFinite(waitMinutes) || waitMinutes < 0)) {
    throw new Error(`--wait-minutes 必须是 >= 0 的数字，当前值: ${waitMinutesRaw}`);
}

if (!['remote', 'stream'].includes(deployMode)) {
    throw new Error(`--deploy-mode 只能是 remote 或 stream，当前值: ${deployMode}`);
}

const runCommand = (command, args, label) => new Promise((resolve, reject) => {
    console.log(`[deploy-and-ota] 执行 ${label}: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
        cwd: rootDir,
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
        shell: false,
    });
    child.on('exit', (code) => {
        if (code === 0) {
            resolve();
            return;
        }
        reject(new Error(`${label} 失败，退出码: ${code ?? 'unknown'}`));
    });
    child.on('error', reject);
});

const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

const remoteDeployCommand = deployTag
    ? `cd ${remoteDir} && bash scripts/deploy/deploy-image.sh update ${deployTag}`
    : `cd ${remoteDir} && bash scripts/deploy/deploy-image.sh update`;

const otaCommandArgs = [
    'scripts/mobile/release-android.mjs',
    'ota',
    '--channel',
    otaChannel,
    ...otaExtraArgs,
];

const main = async () => {
    if (!skipWait) {
        const waitMs = Math.round(waitMinutes * 60 * 1000);
        console.log(`[deploy-and-ota] 将在 ${waitMinutes} 分钟后开始部署与 OTA`);
        if (!dryRun) {
            await sleep(waitMs);
        }
    } else {
        console.log('[deploy-and-ota] 已跳过等待，立即开始');
    }

    console.log(`[deploy-and-ota] 远端部署命令: ssh ${sshTarget} "${remoteDeployCommand}"`);
    if (skipOta) {
        console.log('[deploy-and-ota] OTA 命令: 已跳过');
    } else {
        console.log(`[deploy-and-ota] OTA 命令: ${process.execPath} ${otaCommandArgs.join(' ')}`);
    }
    if (dryRun) {
        console.log('[deploy-and-ota] dry-run 模式，不实际执行');
        return;
    }

    if (deployMode === 'stream') {
        const streamArgs = [
            'scripts/deploy/stream-images-to-server.mjs',
            '--host',
            sshTarget,
            '--remote-dir',
            remoteDir,
        ];
        if (deployTag) {
            streamArgs.push('--tag', deployTag);
        }
        streamArgs.push('--deploy');
        console.log(`[deploy-and-ota] 镜像输送命令: ${process.execPath} ${streamArgs.join(' ')}`);
        await runCommand(process.execPath, streamArgs, '镜像输送部署');
    } else {
        await runCommand('ssh', [sshTarget, remoteDeployCommand], '生产部署');
    }
    if (!skipOta) {
        await runCommand(process.execPath, otaCommandArgs, 'Android OTA');
    }
};

main().catch((error) => {
    console.error(`[deploy-and-ota] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
