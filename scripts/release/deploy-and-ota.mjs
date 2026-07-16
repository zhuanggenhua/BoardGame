import { spawn } from 'node:child_process';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);

const helpText = `
部署 + Android OTA 一键编排

用法:
  node scripts/release/deploy-and-ota.mjs [选项]

默认行为:
  1. 先检查 package.json 版本已随本次发布自增
  2. 等待 10 分钟
  3. 触发 GitHub Actions 构建镜像，并由 CI 直接把镜像 tar 输送到生产机后执行 update-local
  4. 本地执行强制更新 OTA: node scripts/mobile/release-android.mjs ota --channel stable --force-update
  5. OTA 发布脚本必须等 bundle/latest.json 线上可读，并校验 latest.json 的 CORS 预检

准备版本:
  node scripts/release/deploy-and-ota.mjs --prepare-version
  node scripts/release/deploy-and-ota.mjs --prepare-version --bump minor

推荐发布顺序:
  1. 先执行 --prepare-version，默认 patch，会同步更新 package.json.version 与 androidVersionCode
  2. 提交并 push 版本改动
  3. 再执行 deploy-and-ota，部署 latest 并发布同一产品版本的 stable OTA
  4. 若 latest.json 或 CORS 预检不可读，OTA 步骤必须失败，不能汇报更新完成

选项:
  --prepare-version          只准备版本自增，不执行部署或 OTA
  --bump <patch|minor|major> 准备版本自增类型，默认 patch
  --allow-current-version    跳过“必须先准备版本”的门禁，仅用于明确不改版本的特殊发布
  --wait-minutes <number>    等待多少分钟后再开始，默认 10
  --skip-wait                立即执行，不等待
  --dry-run                  只打印将执行的命令，不真正执行
  --host <user@host>         覆盖 SSH 目标，默认 admin@8.148.71.102
  --remote-dir <path>        覆盖远端项目目录，默认 /home/admin/BoardGame
  --deploy-tag <tag>         部署镜像 tag；不传则部署 latest
  --deploy-mode <mode>       部署模式：ci-stream|stream|remote，默认 ci-stream
                             ci-stream: CI 构建后直接传镜像 tar 到服务器，再执行 update-local
                             stream: 本机拉镜像后传到服务器，再执行 update-local（fallback）
                             remote: 服务器直接拉 GHCR 镜像并执行 update
  --ci-ref <ref>             ci-stream 触发 workflow 的 Git ref；默认 latest 用 main，指定 v* tag 时用该 tag
  --ci-workflow <file>       ci-stream 触发的 workflow 文件，默认 docker-publish.yml
  --ota-channel <name>       OTA channel，默认 stable
  --skip-ota                 只更新服务器，不执行本地 Android OTA 发布
  --ota-extra "<args>"       追加给 release-android ota 的额外参数；禁止传 --no-force-update
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

const VERSION_PREPARED_ENV = 'BG_DEPLOY_VERSION_PREPARED';

const prepareVersion = hasFlag('prepare-version');
const bumpType = readArgValue('bump', 'patch');
const allowCurrentVersion = hasFlag('allow-current-version');
const waitMinutesRaw = readArgValue('wait-minutes', '10');
const waitMinutes = Number.parseFloat(waitMinutesRaw);
const dryRun = hasFlag('dry-run');
const skipWait = hasFlag('skip-wait');
const sshTarget = readArgValue('host', 'admin@8.148.71.102');
const remoteDir = readArgValue('remote-dir', '/home/admin/BoardGame');
const deployTag = readArgValue('deploy-tag', '');
const deployMode = readArgValue('deploy-mode', 'ci-stream');
const defaultCiRef = deployTag && deployTag !== 'latest' ? deployTag : 'main';
const ciRef = readArgValue('ci-ref', defaultCiRef);
const ciWorkflow = readArgValue('ci-workflow', 'docker-publish.yml');
const otaChannel = readArgValue('ota-channel', 'stable');
const skipOta = hasFlag('skip-ota');
const otaExtraRaw = readArgValue('ota-extra', '').trim();
const otaExtraArgs = otaExtraRaw ? otaExtraRaw.split(/\s+/).filter(Boolean) : [];

if (otaExtraArgs.includes('--no-force-update')) {
    throw new Error('所有 OTA 已强制更新，--ota-extra 禁止传入 --no-force-update。');
}

if (hasFlag('help') || rawArgs.includes('-h')) {
    console.log(helpText);
    process.exit(0);
}

if (!new Set(['patch', 'minor', 'major']).has(bumpType)) {
    throw new Error(`--bump 只支持 patch | minor | major，当前值: ${bumpType}`);
}

if (!new Set(['ci-stream', 'stream', 'remote']).has(deployMode)) {
    throw new Error(`--deploy-mode 只支持 ci-stream | stream | remote，当前值: ${deployMode}`);
}

if (!skipWait && (!Number.isFinite(waitMinutes) || waitMinutes < 0)) {
    throw new Error(`--wait-minutes 必须是 >= 0 的数字，当前值: ${waitMinutesRaw}`);
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

const runCommandCapture = (command, args, label) => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: rootDir,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
    });
    child.on('exit', (code) => {
        if (code === 0) {
            resolve({ stdout, stderr });
            return;
        }
        reject(new Error(`${label} 失败，退出码: ${code ?? 'unknown'}: ${stderr.trim() || stdout.trim()}`));
    });
    child.on('error', reject);
});

const sleep = (ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
});

const runNode = async (args, label) => {
    if (dryRun) {
        console.log(`[deploy-and-ota] dry-run 将执行 ${label}: ${process.execPath} ${args.join(' ')}`);
        return;
    }
    await runCommand(process.execPath, args, label);
};

const findTriggeredWorkflowRun = async (startedAt) => {
    for (let attempt = 1; attempt <= 24; attempt += 1) {
        const { stdout } = await runCommandCapture('gh', [
            'run',
            'list',
            '--workflow',
            ciWorkflow,
            '--event',
            'workflow_dispatch',
            '--limit',
            '20',
            '--json',
            'databaseId,status,conclusion,createdAt,url,headSha,event,displayTitle',
        ], '查询 CI 镜像直传 workflow');
        const runs = JSON.parse(stdout || '[]');
        const matchedRun = runs
            .filter((run) => new Date(run.createdAt).getTime() >= startedAt.getTime())
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (matchedRun) {
            return matchedRun;
        }
        await sleep(5_000);
    }
    throw new Error(`已触发 ${ciWorkflow}，但 2 分钟内没有找到对应的 workflow_dispatch run。`);
};

const triggerCiStreamDeploy = async () => {
    const tag = deployTag || 'latest';
    const startedAt = new Date(Date.now() - 60_000);
    const args = [
        'workflow',
        'run',
        ciWorkflow,
        '--ref',
        ciRef,
        '-f',
        'stream_to_server=true',
        '-f',
        'deploy_after_stream=true',
        '-f',
        `deploy_tag=${tag}`,
        '-f',
        `deploy_host=${sshTarget}`,
        '-f',
        `remote_dir=${remoteDir}`,
    ];

    if (dryRun) {
        console.log(`[deploy-and-ota] dry-run 将触发 CI 镜像直传部署: gh ${args.join(' ')}`);
        return;
    }

    await runCommand('gh', args, '触发 CI 镜像直传部署');
    const run = await findTriggeredWorkflowRun(startedAt);
    console.log(`[deploy-and-ota] CI 镜像直传 workflow: ${run.url}`);
    await runCommand('gh', [
        'run',
        'watch',
        String(run.databaseId),
        '--exit-status',
        '--interval',
        '30',
    ], '等待 CI 镜像直传部署完成');
};

const readPackageVersion = async () => {
    const { readProjectVersion } = await import('../mobile/version-utils.mjs');
    return readProjectVersion();
};

const remoteDeployCommand = deployTag
    ? `cd ${remoteDir} && bash scripts/deploy/deploy-image.sh update ${deployTag}`
    : `cd ${remoteDir} && bash scripts/deploy/deploy-image.sh update`;
const streamDeployArgs = [
    'scripts/deploy/stream-images-to-server.mjs',
    '--tag',
    deployTag || 'latest',
    '--host',
    sshTarget,
    '--remote-dir',
    remoteDir,
    '--deploy',
];

const otaCommandArgs = [
    'scripts/mobile/release-android.mjs',
    'ota',
    '--channel',
    otaChannel,
    '--force-update',
    ...otaExtraArgs,
];

const main = async () => {
    if (prepareVersion) {
        await runNode([
            'scripts/mobile/bump-project-version.mjs',
            '--bump',
            bumpType,
            ...(dryRun ? ['--dry-run'] : []),
        ], '准备项目版本自增');
        console.log(`[deploy-and-ota] 版本准备完成后，请提交并 push package.json / package-lock.json，再执行部署与 OTA。`);
        console.log(`[deploy-and-ota] 部署时请设置环境变量 ${VERSION_PREPARED_ENV}=1；若本次明确不改版本，可改用 --allow-current-version。`);
        return;
    }

    const releaseVersion = await readPackageVersion();
    if (!allowCurrentVersion) {
        if (process.env[VERSION_PREPARED_ENV] !== '1') {
            throw new Error(
                `正式更新部署默认要求先同步自增产品版本与 Android 版本号。`
                + ` 当前产品版本: ${releaseVersion}。`
                + ` 请先执行 node scripts/release/deploy-and-ota.mjs --prepare-version，提交并 push 后，`
                + `再设置 ${VERSION_PREPARED_ENV}=1 执行部署；若本次明确不改版本，可加 --allow-current-version。`,
            );
        }
        console.log(`[deploy-and-ota] 已确认本次版本自增准备完成，当前产品版本: ${releaseVersion}`);
    }

    if (!skipWait) {
        const waitMs = Math.round(waitMinutes * 60 * 1000);
        console.log(`[deploy-and-ota] 将在 ${waitMinutes} 分钟后开始部署与 OTA`);
        if (!dryRun) {
            await sleep(waitMs);
        }
    } else {
        console.log('[deploy-and-ota] 已跳过等待，立即开始');
    }

    if (deployMode === 'ci-stream') {
        console.log('[deploy-and-ota] 部署模式: ci-stream（CI 构建后直接输送镜像到服务器并 update-local）');
        console.log(`[deploy-and-ota] CI workflow: gh workflow run ${ciWorkflow} --ref ${ciRef} -f stream_to_server=true -f deploy_after_stream=true -f deploy_tag=${deployTag || 'latest'}`);
    } else if (deployMode === 'stream') {
        console.log('[deploy-and-ota] 部署模式: stream（本机输送镜像到服务器后 update-local）');
        console.log(`[deploy-and-ota] 镜像输送命令: ${process.execPath} ${streamDeployArgs.join(' ')}`);
    } else {
        console.log('[deploy-and-ota] 部署模式: remote（服务器直拉 GHCR 镜像）');
        console.log(`[deploy-and-ota] 远端部署命令: ssh ${sshTarget} "${remoteDeployCommand}"`);
    }
    if (skipOta) {
        console.log('[deploy-and-ota] OTA 命令: 已跳过');
    } else {
        console.log(`[deploy-and-ota] OTA 命令: ${process.execPath} ${otaCommandArgs.join(' ')}`);
    }
    if (dryRun) {
        console.log('[deploy-and-ota] dry-run 模式，不实际执行');
        return;
    }

    if (deployMode === 'ci-stream') {
        await triggerCiStreamDeploy();
    } else if (deployMode === 'stream') {
        await runCommand(process.execPath, streamDeployArgs, '生产部署（镜像输送）');
    } else {
        await runCommand('ssh', [sshTarget, remoteDeployCommand], '生产部署（服务器直拉）');
    }
    if (!skipOta) {
        await runCommand(process.execPath, otaCommandArgs, 'Android OTA');
    }
};

main().catch((error) => {
    console.error(`[deploy-and-ota] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
