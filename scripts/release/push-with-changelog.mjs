#!/usr/bin/env node
import { spawn } from 'node:child_process';
import process from 'node:process';

const rootDir = process.cwd();
const rawArgs = process.argv.slice(2);

const helpText = `
push 后自动发布游戏更新日志

用法:
  node scripts/release/push-with-changelog.mjs [git push 参数] -- [更新日志参数]

示例:
  npm run release:push-with-changelog -- -- --dry-run
  npm run release:push-with-changelog -- origin main -- --game dicethrone
  npm run release:push-with-changelog -- -- --summary "修复不可防御伤害响应窗口" --type fix

说明:
  - 脚本会在 push 前记录当前分支相对上游的待推送范围。
  - push 成功后，把该范围传给 publish-game-changelog.mjs。
  - 若当前没有上游或没有待推送提交，则退回最近一笔提交。
`.trim();

const splitArgs = (args) => {
    const separatorIndex = args.indexOf('--');
    if (separatorIndex < 0) {
        return { pushArgs: args, changelogArgs: [] };
    }
    return {
        pushArgs: args.slice(0, separatorIndex),
        changelogArgs: args.slice(separatorIndex + 1),
    };
};

const hasChangelogRangeOverride = (args) => args.some((arg) => (
    arg === '--range'
    || arg.startsWith('--range=')
    || arg === '--commit'
    || arg.startsWith('--commit=')
    || arg === '--base'
    || arg.startsWith('--base=')
));

const runCommand = (command, args, label, stdio = 'inherit') => new Promise((resolve, reject) => {
    const child = spawn(command, args, {
        cwd: rootDir,
        env: process.env,
        stdio,
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

const runCommandCapture = (command, args, label, { allowFailure = false } = {}) => new Promise((resolve, reject) => {
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
        if (code === 0 || allowFailure) {
            resolve({ stdout, stderr, code });
            return;
        }
        reject(new Error(`${label} 失败，退出码: ${code ?? 'unknown'}: ${stderr.trim() || stdout.trim()}`));
    });
    child.on('error', reject);
});

const getChangedPaths = async (range) => {
    const { stdout } = await runCommandCapture('git', ['diff', '--name-only', range], `读取待推送范围 ${range}`);
    return stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
};

const resolveRangeBeforePush = async () => {
    const upstream = await runCommandCapture(
        'git',
        ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'],
        '读取当前分支上游',
        { allowFailure: true },
    );
    const upstreamRef = upstream.code === 0 ? upstream.stdout.trim() : '';
    if (upstreamRef) {
        const range = `${upstreamRef}..HEAD`;
        const changedPaths = await getChangedPaths(range);
        if (changedPaths.length > 0) {
            return range;
        }
    }

    const hasParent = await runCommandCapture(
        'git',
        ['rev-parse', '--verify', 'HEAD~1'],
        '确认最近提交父提交',
        { allowFailure: true },
    );
    if (hasParent.code !== 0) {
        throw new Error('无法确定更新日志提交范围，请给更新日志参数显式传入 --range 或 --commit。');
    }
    return 'HEAD~1..HEAD';
};

const main = async () => {
    if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
        console.log(helpText);
        return;
    }

    const { pushArgs, changelogArgs } = splitArgs(rawArgs);
    const range = hasChangelogRangeOverride(changelogArgs) ? '' : await resolveRangeBeforePush();
    const resolvedPushArgs = pushArgs.length > 0 ? pushArgs : [];

    console.log(`[push-with-changelog] 执行 git push ${resolvedPushArgs.join(' ')}`.trim());
    await runCommand('git', ['push', ...resolvedPushArgs], 'git push');

    const publishArgs = [
        'scripts/release/publish-game-changelog.mjs',
        ...(range ? ['--range', range] : []),
        ...changelogArgs,
    ];
    console.log(`[push-with-changelog] 发布更新日志: ${process.execPath} ${publishArgs.join(' ')}`);
    await runCommand(process.execPath, publishArgs, '发布游戏更新日志');
};

main().catch((error) => {
    console.error(`[push-with-changelog] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
