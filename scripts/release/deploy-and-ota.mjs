import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
    loadGameNames,
    loadUnderConstructionGameIds,
    parsePublishOptions,
    publishChangelogDrafts,
    readPackageVersion,
} from './publish-game-changelog.mjs';
import {
    formatDeploymentOtaNotes,
    prepareDeploymentGameChangelog,
    resolveDeploymentChangelogApiBaseUrl,
} from './deployment-game-changelog.mjs';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);

const helpText = `
部署 + Android OTA 一键编排

用法:
  node scripts/release/deploy-and-ota.mjs [选项]

默认行为:
  1. 等待 10 分钟
  2. 触发 GitHub Actions 构建镜像，并由 CI 直接把镜像 tar 输送到生产机后执行 update-local
  3. 触发 Android OTA Publish workflow，发布同一 git ref 的 stable OTA
  4. OTA workflow 必须等 bundle/latest.json 线上可读，并校验 latest.json 的 CORS 预检

准备商业产品 / 原生版本:
  node scripts/release/deploy-and-ota.mjs --prepare-version
  node scripts/release/deploy-and-ota.mjs --prepare-version --bump minor

推荐发布顺序:
  1. 代码热更新：提交并 push 后直接执行 deploy-and-ota，服务器版本以 git ref / 镜像为准
  2. 商业产品或原生壳版本发布：先执行 --prepare-version，再提交并 push 版本改动
  3. OTA 包版本在上传时通过 --ota-extra 指定，未指定时按 OTA 游标基线 + UTC 时间自动生成
  4. 若 latest.json 或 CORS 预检不可读，OTA 步骤必须失败，不能汇报更新完成

选项:
  --prepare-version          只准备商业产品 / 原生壳版本自增，不执行部署或 OTA
  --bump <patch|minor|major> 准备版本自增类型，默认 patch
  --allow-current-version    兼容旧命令；部署默认已允许当前商业产品版本
  --wait-minutes <number>    等待多少分钟后再开始，默认 10
  --skip-wait                立即执行，不等待
  --dry-run                  只打印将执行的命令，不真正执行
  --host <user@host>         覆盖 SSH 目标，默认 admin@8.148.71.102
  --remote-dir <path>        覆盖远端项目目录，默认 /home/admin/BoardGame
  --deploy-preview            同一次 CI 镜像构建后同步 Acer 预览机
  --preview-host <user@host>  Acer 预览机 SSH 目标
  --preview-remote-dir <path> Acer 预览机项目目录
  --deploy-tag <tag>         部署镜像 tag；不传则部署 latest
  --deploy-mode <mode>       部署模式：ci-stream|stream|remote，默认 ci-stream
                             ci-stream: CI 构建后直接传镜像 tar 到服务器，再执行 update-local
                             stream: 本机拉镜像后传到服务器，再执行 update-local（fallback）
                             remote: 服务器直接拉 GHCR 镜像并执行 update
  --ci-ref <ref>             ci-stream 触发 workflow 的 Git ref；默认 latest 用 main，指定 v* tag 时用该 tag
  --ci-workflow <file>       ci-stream 触发的 workflow 文件，默认 docker-publish.yml
  --resume-ci-run-id <id>    不重新触发部署 workflow，继续等待已有 run
  --workflow-timeout-minutes <number>
                             等待单个 workflow 完成的上限，默认 30，可用 BG_DEPLOY_WORKFLOW_TIMEOUT_MINUTES 覆盖
  --workflow-poll-seconds <number>
                             查询 workflow 状态的间隔，默认 30，可用 BG_DEPLOY_WORKFLOW_POLL_SECONDS 覆盖
  --ota-channel <name>       OTA channel，默认 stable
  --ota-mode <mode>          OTA 模式：workflow|local，默认 workflow
  --ota-workflow <file>      OTA workflow 文件，默认 android-ota-publish.yml
  --ota-ref <ref>            触发 OTA workflow 的 Git ref，默认同 --ci-ref
  --ota-git-ref <ref>        OTA workflow 实际 checkout/publish 的 git_ref，默认同 --ci-ref
  --changelog-file <path>    可选游戏更新日志 JSON；发布网页日志并将同一文案传给 OTA
  --changelog-api-base-url <url>
                             游戏更新日志 API 地址；也可用 BG_CHANGELOG_API_BASE_URL / VITE_BACKEND_URL
  --resume-ota-run-id <id>   不重新触发 OTA workflow，继续等待已有 run
  --skip-ota                 只更新服务器，不执行 Android OTA 发布
  --ota-extra "<args>"       追加给 OTA 的额外参数；workflow 模式支持 --version/--display-version/--ota-version-base/--product-version/--expected-base-version/--dry-run/--skip-latest/--force-update-title/--force-update-message，local 模式原样传给 release-android ota；禁止传 --no-force-update
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

const prepareVersion = hasFlag('prepare-version');
const bumpType = readArgValue('bump', 'patch');
const allowCurrentVersion = hasFlag('allow-current-version');
const waitMinutesRaw = readArgValue('wait-minutes', '10');
const waitMinutes = Number.parseFloat(waitMinutesRaw);
const dryRun = hasFlag('dry-run');
const skipWait = hasFlag('skip-wait');
const sshTarget = readArgValue('host', 'admin@8.148.71.102');
const remoteDir = readArgValue('remote-dir', '/home/admin/BoardGame');
const deployPreview = hasFlag('deploy-preview');
const previewSshTarget = readArgValue('preview-host', 'zhanggenhua@direct-home.easyboardgame.top');
const previewRemoteDir = readArgValue('preview-remote-dir', '/home/zhanggenhua/BoardGame');
const deployTag = readArgValue('deploy-tag', '');
const deployMode = readArgValue('deploy-mode', 'ci-stream');
const defaultCiRef = deployTag && deployTag !== 'latest' ? deployTag : 'main';
const ciRef = readArgValue('ci-ref', defaultCiRef);
const ciWorkflow = readArgValue('ci-workflow', 'docker-publish.yml');
const resumeCiRunId = readArgValue('resume-ci-run-id', '');
const workflowTimeoutMinutesRaw = readArgValue(
    'workflow-timeout-minutes',
    process.env.BG_DEPLOY_WORKFLOW_TIMEOUT_MINUTES || '30',
);
const workflowTimeoutMinutes = Number.parseFloat(workflowTimeoutMinutesRaw);
const workflowPollSecondsRaw = readArgValue(
    'workflow-poll-seconds',
    process.env.BG_DEPLOY_WORKFLOW_POLL_SECONDS || '30',
);
const workflowPollSeconds = Number.parseFloat(workflowPollSecondsRaw);
const otaChannel = readArgValue('ota-channel', 'stable');
const otaMode = readArgValue('ota-mode', 'workflow');
const otaWorkflow = readArgValue('ota-workflow', 'android-ota-publish.yml');
const otaRef = readArgValue('ota-ref', ciRef);
const otaGitRef = readArgValue('ota-git-ref', ciRef);
const resumeOtaRunId = readArgValue('resume-ota-run-id', '');
const skipOta = hasFlag('skip-ota');
const changelogFile = readArgValue('changelog-file', '').trim();
const changelogApiBaseUrl = readArgValue('changelog-api-base-url', '').trim();
const otaExtraRaw = readArgValue('ota-extra', '').trim();
const otaExtraArgs = otaExtraRaw ? otaExtraRaw.split(/\s+/).filter(Boolean) : [];
const hasOtaNotesOverride = otaExtraArgs.some((arg) => {
    const optionName = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    return optionName === '--notes' || optionName === '--empty-notes';
});
let deploymentChangelogDrafts = [];
let deploymentChangelogSkippedGameIds = [];
let deploymentChangelogOptions;
let sharedReleaseNotes = '';

if (otaExtraArgs.includes('--no-force-update')) {
    throw new Error('所有 OTA 已强制更新，--ota-extra 禁止传入 --no-force-update。');
}

if (hasOtaNotesOverride) {
    throw new Error('完整部署的 OTA 更新说明由共享游戏日志统一决定，--ota-extra 禁止传入 --notes / --empty-notes。');
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

if (!new Set(['workflow', 'local']).has(otaMode)) {
    throw new Error(`--ota-mode 只支持 workflow | local，当前值: ${otaMode}`);
}

if (!skipWait && (!Number.isFinite(waitMinutes) || waitMinutes < 0)) {
    throw new Error(`--wait-minutes 必须是 >= 0 的数字，当前值: ${waitMinutesRaw}`);
}

if (!Number.isFinite(workflowTimeoutMinutes) || workflowTimeoutMinutes <= 0) {
    throw new Error(`--workflow-timeout-minutes 必须是 > 0 的数字，当前值: ${workflowTimeoutMinutesRaw}`);
}

if (!Number.isFinite(workflowPollSeconds) || workflowPollSeconds <= 0) {
    throw new Error(`--workflow-poll-seconds 必须是 > 0 的数字，当前值: ${workflowPollSecondsRaw}`);
}

const readExtraArgValue = (name, fallback = '') => {
    const prefix = `--${name}=`;
    const direct = otaExtraArgs.find((arg) => arg.startsWith(prefix));
    if (direct) {
        return direct.slice(prefix.length);
    }
    const index = otaExtraArgs.findIndex((arg) => arg === `--${name}`);
    if (index >= 0 && otaExtraArgs[index + 1]) {
        return otaExtraArgs[index + 1];
    }
    return fallback;
};

const hasExtraFlag = (name) => otaExtraArgs.includes(`--${name}`);
const supportedWorkflowOtaExtraArgs = new Set([
    '--dry-run',
    '--skip-latest',
    '--version',
    '--display-version',
    '--ota-version-base',
    '--product-version',
    '--expected-base-version',
    '--force-update-title',
    '--force-update-message',
]);

if (otaMode === 'workflow') {
    for (let index = 0; index < otaExtraArgs.length; index += 1) {
        const arg = otaExtraArgs[index];
        const optionName = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
        if (!optionName.startsWith('--')) {
            continue;
        }
        if (!supportedWorkflowOtaExtraArgs.has(optionName)) {
            throw new Error(`workflow OTA 模式不支持 ota-extra 参数: ${arg}`);
        }
    }
}

const runCommand = (command, args, label) => new Promise((resolve, reject) => {
    console.log(`[deploy-and-ota] 执行 ${label}: ${command} ${formatArgsForLog(args)}`);
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

const workflowTimeoutMs = Math.round(workflowTimeoutMinutes * 60 * 1000);
const workflowPollMs = Math.round(workflowPollSeconds * 1000);

const runNode = async (args, label) => {
    if (dryRun) {
        console.log(`[deploy-and-ota] dry-run 将执行 ${label}: ${process.execPath} ${formatArgsForLog(args)}`);
        return;
    }
    await runCommand(process.execPath, args, label);
};

const formatArgsForLog = (args) => args.map((arg) => (
    arg.startsWith('release_notes=') ? `release_notes=[${arg.length - 'release_notes='.length} chars]` : arg
)).join(' ');

const prepareDeploymentChangelog = async () => {
    if (!changelogFile) return;

    const payload = JSON.parse(await readFile(resolve(rootDir, changelogFile), 'utf8'));
    deploymentChangelogOptions = parsePublishOptions([], process.env);
    if (!deploymentChangelogOptions.versionLabel) {
        deploymentChangelogOptions.versionLabel = await readPackageVersion();
    }
    const prepared = prepareDeploymentGameChangelog({
        payload,
        gameNames: await loadGameNames(),
        underConstructionGameIds: await loadUnderConstructionGameIds(),
        defaultVersionLabel: deploymentChangelogOptions.versionLabel,
    });
    deploymentChangelogDrafts = prepared.drafts;
    deploymentChangelogSkippedGameIds = prepared.skippedGameIds;
    sharedReleaseNotes = formatDeploymentOtaNotes(deploymentChangelogDrafts);
    if (deploymentChangelogDrafts.length > 0) {
        deploymentChangelogOptions.apiBaseUrl = resolveDeploymentChangelogApiBaseUrl({
            explicitUrl: changelogApiBaseUrl,
            env: process.env,
        });
    }
};

const findTriggeredWorkflowRun = async ({ workflow, startedAt, label }) => {
    for (let attempt = 1; attempt <= 24; attempt += 1) {
        const { stdout } = await runCommandCapture('gh', [
            'run',
            'list',
            '--workflow',
            workflow,
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
    throw new Error(`已触发 ${workflow}，但 2 分钟内没有找到对应的 ${label} workflow_dispatch run。`);
};

const waitForWorkflowRun = async ({ runId, label }) => {
    const deadline = Date.now() + workflowTimeoutMs;
    let lastStatus = '';
    let lastUrl = '';

    while (Date.now() < deadline) {
        const { stdout } = await runCommandCapture('gh', [
            'run',
            'view',
            String(runId),
            '--json',
            'status,conclusion,displayTitle,workflowName,url,updatedAt',
        ], `查询 ${label} workflow`);
        const run = JSON.parse(stdout || '{}');
        lastStatus = `${run.status || 'unknown'}${run.conclusion ? `/${run.conclusion}` : ''}`;
        lastUrl = run.url || lastUrl;

        if (run.status === 'completed') {
            if (run.conclusion === 'success') {
                console.log(`[deploy-and-ota] ${label} workflow 已成功: ${run.url || runId}`);
                return run;
            }
            throw new Error(`${label} workflow 失败: ${run.conclusion || 'unknown'} ${run.url || runId}`);
        }

        console.log(`[deploy-and-ota] ${label} workflow 仍在运行: ${lastStatus} ${run.url || runId}`);
        await sleep(Math.min(workflowPollMs, Math.max(1_000, deadline - Date.now())));
    }

    throw new Error(
        `${label} workflow 在 ${workflowTimeoutMinutes} 分钟内未完成，当前状态: ${lastStatus || 'unknown'}。`
        + ` run=${lastUrl || runId}。不要重新触发同一发布；请提高 --workflow-timeout-minutes，`
        + `或用 --resume-${label === 'CI 镜像直传部署' ? 'ci' : 'ota'}-run-id ${runId} 继续等待。`,
    );
};

const triggerCiStreamDeploy = async () => {
    if (resumeCiRunId) {
        console.log(`[deploy-and-ota] 继续等待已有 CI 镜像直传 workflow run: ${resumeCiRunId}`);
        await waitForWorkflowRun({ runId: resumeCiRunId, label: 'CI 镜像直传部署' });
        return;
    }

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

    if (deployPreview) {
        args.push(
            '-f',
            'stream_to_preview=true',
            '-f',
            'deploy_preview_after_stream=true',
            '-f',
            'preview_deploy_host=' + previewSshTarget,
            '-f',
            'preview_remote_dir=' + previewRemoteDir,
        );
    }

    if (dryRun) {
        console.log(`[deploy-and-ota] dry-run 将触发 CI 镜像直传部署: gh ${args.join(' ')}`);
        return;
    }

    await runCommand('gh', args, '触发 CI 镜像直传部署');
    const run = await findTriggeredWorkflowRun({
        workflow: ciWorkflow,
        startedAt,
        label: 'CI 镜像直传部署',
    });
    console.log(`[deploy-and-ota] CI 镜像直传 workflow: ${run.url}`);
    await waitForWorkflowRun({ runId: run.databaseId, label: 'CI 镜像直传部署' });
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

const workflowOtaInputs = () => ([
    'workflow',
    'run',
    otaWorkflow,
    '--ref',
    otaRef,
    '-f',
    `channel=${otaChannel}`,
    '-f',
    `git_ref=${otaGitRef}`,
    '-f',
    `dry_run=${hasExtraFlag('dry-run') ? 'true' : 'false'}`,
    '-f',
    `skip_latest=${hasExtraFlag('skip-latest') ? 'true' : 'false'}`,
    '-f',
    'force_update=true',
    '-f',
    'release_notes_mode=shared',
    ...(sharedReleaseNotes ? ['-f', `release_notes=${sharedReleaseNotes}`] : []),
    ...(readExtraArgValue('version') ? ['-f', `version=${readExtraArgValue('version')}`] : []),
    ...(readExtraArgValue('display-version') ? ['-f', `display_version=${readExtraArgValue('display-version')}`] : []),
    ...(readExtraArgValue('ota-version-base') ? ['-f', `ota_version_base=${readExtraArgValue('ota-version-base')}`] : []),
    ...(readExtraArgValue('product-version') ? ['-f', `product_version=${readExtraArgValue('product-version')}`] : []),
    ...(readExtraArgValue('expected-base-version') ? ['-f', `expected_base_version=${readExtraArgValue('expected-base-version')}`] : []),
    ...(readExtraArgValue('force-update-title') ? ['-f', `force_update_title=${readExtraArgValue('force-update-title')}`] : []),
    ...(readExtraArgValue('force-update-message') ? ['-f', `force_update_message=${readExtraArgValue('force-update-message')}`] : []),
]);

const triggerOtaWorkflow = async () => {
    if (resumeOtaRunId) {
        console.log(`[deploy-and-ota] 继续等待已有 Android OTA workflow run: ${resumeOtaRunId}`);
        await waitForWorkflowRun({ runId: resumeOtaRunId, label: 'Android OTA' });
        return;
    }

    const startedAt = new Date(Date.now() - 60_000);
    const args = workflowOtaInputs();

    if (dryRun) {
        console.log(`[deploy-and-ota] dry-run 将触发 Android OTA workflow: gh ${formatArgsForLog(args)}`);
        return;
    }

    await runCommand('gh', args, '触发 Android OTA workflow');
    const run = await findTriggeredWorkflowRun({
        workflow: otaWorkflow,
        startedAt,
        label: 'Android OTA',
    });
    console.log(`[deploy-and-ota] Android OTA workflow: ${run.url}`);
    await waitForWorkflowRun({ runId: run.databaseId, label: 'Android OTA' });
};

const main = async () => {
    if (prepareVersion) {
        await runNode([
            'scripts/mobile/bump-project-version.mjs',
            '--bump',
            bumpType,
            ...(dryRun ? ['--dry-run'] : []),
        ], '准备项目版本自增');
        console.log('[deploy-and-ota] 版本准备完成后，请提交并 push package.json / package-lock.json。');
        console.log('[deploy-and-ota] 普通服务器热更新不需要准备版本；只有商业产品 / 原生壳版本发布才需要。');
        return;
    }

    if (allowCurrentVersion) {
        console.log('[deploy-and-ota] --allow-current-version 已兼容保留；当前部署默认不要求修改商业产品版本。');
    }

    await prepareDeploymentChangelog();
    if (changelogFile && deploymentChangelogSkippedGameIds.length > 0) {
        console.log(`[deploy-and-ota] 跳过实施中游戏日志: ${deploymentChangelogSkippedGameIds.join(', ')}`);
    }
    if (deploymentChangelogDrafts.length > 0) {
        console.log(`[deploy-and-ota] 已准备 ${deploymentChangelogDrafts.length} 条网页/OTA 共用更新日志:`);
        deploymentChangelogDrafts.forEach(({ gameId, title, content }) => {
            console.log(`\n[${gameId}] ${title}\n${content}`);
        });
    } else {
        console.log('[deploy-and-ota] 未提供可公开的玩家更新日志；完整部署的 OTA 更新说明将留空。');
    }
    if (otaMode === 'local') {
        if (sharedReleaseNotes) {
            otaCommandArgs.push('--notes', sharedReleaseNotes);
        } else {
            otaCommandArgs.push('--empty-notes');
        }
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
        const previewSummary = deployPreview
            ? ` -f stream_to_preview=true -f deploy_preview_after_stream=true -f preview_deploy_host=${previewSshTarget} -f preview_remote_dir=${previewRemoteDir}`
            : '';
        console.log(`[deploy-and-ota] CI workflow: gh workflow run ${ciWorkflow} --ref ${ciRef} -f stream_to_server=true -f deploy_after_stream=true -f deploy_tag=${deployTag || 'latest'}${previewSummary}`);
    } else if (deployMode === 'stream') {
        console.log('[deploy-and-ota] 部署模式: stream（本机输送镜像到服务器后 update-local）');
        console.log(`[deploy-and-ota] 镜像输送命令: ${process.execPath} ${streamDeployArgs.join(' ')}`);
    } else {
        console.log('[deploy-and-ota] 部署模式: remote（服务器直拉 GHCR 镜像）');
        console.log(`[deploy-and-ota] 远端部署命令: ssh ${sshTarget} "${remoteDeployCommand}"`);
    }
    if (skipOta) {
        console.log('[deploy-and-ota] OTA 命令: 已跳过');
    } else if (otaMode === 'workflow') {
        console.log(`[deploy-and-ota] OTA workflow: gh ${formatArgsForLog(workflowOtaInputs())}`);
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
    if (deploymentChangelogDrafts.length > 0) {
        try {
            await publishChangelogDrafts({
                drafts: deploymentChangelogDrafts,
                options: deploymentChangelogOptions,
            });
        } catch (error) {
            throw new Error(
                `服务器部署已成功；网页更新日志写入失败，Android OTA 未启动。可能已有部分游戏日志写入，重试会执行重复检查。${error instanceof Error ? ` ${error.message}` : ` ${String(error)}`}`,
            );
        }
    }

    if (!skipOta) {
        try {
            if (otaMode === 'workflow') {
                await triggerOtaWorkflow();
            } else {
                await runCommand(process.execPath, otaCommandArgs, 'Android OTA');
            }
        } catch (error) {
            if (deploymentChangelogDrafts.length > 0) {
                throw new Error(
                    `服务器部署和网页更新日志已完成；Android OTA 失败。${error instanceof Error ? error.message : String(error)}`,
                );
            }
            throw error;
        }
    }
};

main().catch((error) => {
    console.error(`[deploy-and-ota] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
