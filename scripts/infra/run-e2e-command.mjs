import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withWindowsHide } from './windows-hide.js';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import { runEncodingCheck } from './check-file-encoding.mjs';
import { runE2ESafetyCheck } from './check-e2e-safety.js';
import { cleanupTestConnections } from './cleanup_test_connections.js';
import { assertSafeE2EServerMode, resolveUseDevServers } from './e2e-mode-config.js';
import {
    formatRuntimeSummary,
    getWorktreeRoot,
    listActiveRuntimes,
    pruneStaleRuntimes,
} from './e2e-runtime-registry.js';
import { acquireGlobalHeavyBudget } from './global-heavy-budget.mjs';
import { acquireTaskGuard } from './heavy-task-guard.mjs';
import { ensureE2EAssets } from './ensure-e2e-assets.mjs';

function resolvePlaywrightCli(startDir) {
    let currentDir = path.resolve(startDir);
    while (true) {
        const candidate = path.join(currentDir, 'node_modules', 'playwright', 'cli.js');
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            throw new Error(`找不到 Playwright CLI：从 ${startDir} 向上查找 node_modules/playwright/cli.js 失败`);
        }
        currentDir = parentDir;
    }
}

const playwrightCli = resolvePlaywrightCli(process.cwd());
const runtimeNode = process.env.PW_NODE_BINARY || process.execPath;
const PREFLIGHT_CACHE_PATH = path.resolve(process.cwd(), '.tmp', 'e2e-preflight-cache.json');
const CLEANUP_CACHE_TTL_MS = 90_000;
const ENCODING_CACHE_TTL_MS = 90_000;
const SAFETY_CACHE_TTL_MS = 90_000;
const PREFLIGHT_WRITE_RETRYABLE_CODES = new Set(['EBUSY', 'EPERM']);
const PREFLIGHT_WRITE_RETRY_COUNT = 6;
const PREFLIGHT_WRITE_RETRY_DELAY_MS = 50;
const HEAVY_TASK_GUARD_WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const HEAVY_TASK_GUARD_WAIT_POLL_MS = 10 * 1000;
const E2E_RUNTIME_WAIT_TIMEOUT_MS = 30 * 60 * 1000;
const E2E_RUNTIME_WAIT_POLL_MS = 10 * 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parsePositiveIntegerEnv(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return fallback;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isHeavyTaskGuardContention(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('已有同类重任务在运行')
        || message.includes('检测到冲突重任务正在运行');
}

export function findBlockingE2ERuntimes(runtimes, {
    preferSharedSingleRun = false,
    currentWorktreeRoot = getWorktreeRoot(process.cwd()),
} = {}) {
    return (Array.isArray(runtimes) ? runtimes : []).filter((runtime) => {
        const status = runtime?.status;
        if (status !== 'active' && status !== 'active-unhealthy') {
            return false;
        }

        const isReusableSharedRuntime = (
            preferSharedSingleRun
            && status === 'active'
            && runtime.mode === 'shared-single'
            && runtime.scope === 'shared-single'
            && runtime.health?.ready === true
            && path.resolve(runtime.worktreeRoot ?? '') === path.resolve(currentWorktreeRoot)
        );

        return !isReusableSharedRuntime;
    });
}

function formatRuntimeQueueSummary(runtimes) {
    return runtimes
        .map(runtime => `- ${formatRuntimeSummary(runtime)}`)
        .join('\n');
}

async function waitForE2ERuntimeWindow({
    isListMode,
    mode,
    preferSharedSingleRun,
    logger = console,
} = {}) {
    if (isListMode || mode === 'parallel' || process.env.BG_BYPASS_E2E_RUNTIME_GUARD === '1') {
        return;
    }

    const waitTimeoutMs = parsePositiveIntegerEnv(
        'BG_E2E_RUNTIME_WAIT_TIMEOUT_MS',
        E2E_RUNTIME_WAIT_TIMEOUT_MS,
    );
    const waitPollMs = parsePositiveIntegerEnv(
        'BG_E2E_RUNTIME_WAIT_POLL_MS',
        E2E_RUNTIME_WAIT_POLL_MS,
    );
    const currentWorktreeRoot = getWorktreeRoot(process.cwd());
    const startedAt = Date.now();
    let attempt = 0;

    while (true) {
        pruneStaleRuntimes(process.cwd(), { killOrphans: true, logger });
        const blockingRuntimes = findBlockingE2ERuntimes(listActiveRuntimes(process.cwd()), {
            preferSharedSingleRun,
            currentWorktreeRoot,
        });

        if (blockingRuntimes.length === 0) {
            return;
        }

        const elapsedMs = Date.now() - startedAt;
        if (elapsedMs >= waitTimeoutMs) {
            throw new Error([
                '已有不可复用的 E2E runtime 仍在运行，拒绝继续启动新的 E2E。',
                '这会让多个会话同时拉起浏览器/前端/游戏服/API 服务，直接增加 CPU 和内存占用。',
                formatRuntimeQueueSummary(blockingRuntimes),
                '请等待该 runtime 结束，或确认它已经失联后再运行安全清理。',
            ].join('\n'));
        }

        attempt += 1;
        const remainingMs = Math.max(0, waitTimeoutMs - elapsedMs);
        logger.log?.([
            '[e2e-runtime-guard] 检测到不可复用的活跃 E2E runtime，进入低资源排队等待。',
            `第 ${attempt} 次检查命中，${Math.ceil(waitPollMs / 1000)}s 后重试。`,
            `最长还可等待 ${Math.ceil(remainingMs / 1000)}s。`,
            formatRuntimeQueueSummary(blockingRuntimes),
        ].join('\n'));
        await sleep(waitPollMs);
    }
}

async function acquireTaskGuardWithQueue(args) {
    const waitTimeoutMs = parsePositiveIntegerEnv(
        'BG_HEAVY_TASK_GUARD_WAIT_TIMEOUT_MS',
        HEAVY_TASK_GUARD_WAIT_TIMEOUT_MS,
    );
    const waitPollMs = parsePositiveIntegerEnv(
        'BG_HEAVY_TASK_GUARD_WAIT_POLL_MS',
        HEAVY_TASK_GUARD_WAIT_POLL_MS,
    );
    const startedAt = Date.now();
    let attempt = 0;

    while (true) {
        attempt += 1;
        try {
            return acquireTaskGuard(args);
        } catch (error) {
            if (!isHeavyTaskGuardContention(error)) {
                throw error;
            }

            const elapsedMs = Date.now() - startedAt;
            if (elapsedMs >= waitTimeoutMs) {
                throw error;
            }

            const remainingMs = Math.max(0, waitTimeoutMs - elapsedMs);
            console.log([
                '[heavy-task-guard] 已有 E2E/quality-gate 重任务在运行，进入低资源排队等待。',
                `第 ${attempt} 次检查失败，${Math.ceil(waitPollMs / 1000)}s 后重试。`,
                `最长还可等待 ${Math.ceil(remainingMs / 1000)}s。`,
            ].join(' '));
            await sleep(waitPollMs);
        }
    }
}

function createE2ESessionId() {
    return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function run(command, args, env) {
    console.log(`🎭 启动 Playwright: ${[command, ...args].join(' ')}`);
    const result = spawnSync(command, args, withWindowsHide({
        stdio: 'inherit',
        env,
        shell: false,
    }, env));

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        return result.status;
    }

    console.log('✅ Playwright 进程已结束。');
    return 0;
}

function runJsonCommand(command, args, env) {
    const result = spawnSync(command, args, withWindowsHide({
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
        shell: false,
    }, env));

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        const stderr = result.stderr?.toString?.() || '';
        const stdout = result.stdout?.toString?.() || '';
        throw new Error(stderr.trim() || stdout.trim() || `命令执行失败: status=${result.status}`);
    }

    const stdout = result.stdout?.toString?.().trim() || '';
    if (!stdout) {
        throw new Error('命令未返回 JSON 输出。');
    }

    return JSON.parse(stdout);
}

function ensureManagedRuntimeWithHold(command, args, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, withWindowsHide({
            stdio: ['pipe', 'pipe', 'pipe'],
            env,
            shell: false,
        }, env));

        let stdout = '';
        let stderr = '';
        let settled = false;

        const finalizeError = (fallbackMessage) => {
            if (settled) {
                return;
            }
            settled = true;
            reject(new Error(
                [
                    fallbackMessage,
                    stdout.trim() ? `stdout:\n${stdout.trim()}` : '',
                    stderr.trim() ? `stderr:\n${stderr.trim()}` : '',
                ].filter(Boolean).join('\n\n'),
            ));
        };

        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');

        child.stdout?.on('data', chunk => {
            stdout += chunk;
            if (settled) {
                return;
            }

            const line = stdout.split(/\r?\n/, 1)[0]?.trim();
            if (!line) {
                return;
            }

            try {
                const payload = JSON.parse(line);
                settled = true;
                resolve({ child, payload });
            } catch {
                // 等完整输出；若子进程退出仍拿不到合法 JSON，则在 close 事件里失败。
            }
        });

        child.stderr?.on('data', chunk => {
            stderr += chunk;
            process.stderr.write(chunk);
        });

        child.on('error', error => {
            finalizeError(`启动 E2E runtime manager 失败: ${error instanceof Error ? error.message : String(error)}`);
        });

        child.on('close', code => {
            if (!settled) {
                finalizeError(`E2E runtime manager 提前退出: status=${code ?? 'null'}`);
            }
        });
    });
}

async function stopHeldManager(child) {
    if (!child || child.exitCode !== null || child.killed) {
        return;
    }

    await new Promise(resolve => {
        let finished = false;
        const finish = () => {
            if (finished) {
                return;
            }
            finished = true;
            resolve();
        };

        const timer = setTimeout(() => {
            try {
                child.kill('SIGTERM');
            } catch {
                // ignore
            }
            finish();
        }, 5000);

        child.once('close', () => {
            clearTimeout(timer);
            finish();
        });

        try {
            child.stdin?.end();
        } catch {
            try {
                child.kill('SIGTERM');
            } catch {
                // ignore
            }
        }
    });
}

function stopManagedRuntime(runtimeId, env) {
    if (!runtimeId) {
        return;
    }

    try {
        runJsonCommand(runtimeNode, [
            'scripts/infra/e2e-runtime-manager.mjs',
            'stop',
            '--json',
            '--runtimeId',
            runtimeId,
        ], env);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ 停止托管 E2E runtime 失败: runtimeId=${runtimeId}\n${message}`);
    }
}

function createEnv(overrides = {}) {
    return {
        ...process.env,
        PW_HEADED: 'false',
        PWDEBUG: '0',
        PW_USE_DEV_SERVERS: 'false',
        PW_ALLOW_DEV_SERVER_TESTS: 'false',
        PW_START_SERVERS: 'false',
        PW_SERVER_WATCH: process.env.PW_SERVER_WATCH ?? 'false',
        ...overrides,
    };
}

function mergeNodeOptions(preferredOption, existingValue = process.env.NODE_OPTIONS) {
    const preferredOptions = Array.isArray(preferredOption)
        ? preferredOption
        : [preferredOption];
    const existing = String(existingValue ?? '').trim();
    if (!existing) {
        return preferredOptions.join(' ');
    }

    const filtered = existing
        .split(/\s+/)
        .filter(option => option
            && !option.startsWith('--max-old-space-size=')
            && !option.startsWith('--max-semi-space-size='));

    return [...filtered, ...preferredOptions].join(' ').trim();
}

function ensurePreflightCacheDir() {
    fs.mkdirSync(path.dirname(PREFLIGHT_CACHE_PATH), { recursive: true });
}

function sleepSync(ms) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readPreflightCache() {
    try {
        return JSON.parse(fs.readFileSync(PREFLIGHT_CACHE_PATH, 'utf-8'));
    } catch {
        return {};
    }
}

function writePreflightCache(cache) {
    ensurePreflightCacheDir();
    let lastError = null;
    for (let attempt = 0; attempt < PREFLIGHT_WRITE_RETRY_COUNT; attempt += 1) {
        try {
            fs.writeFileSync(PREFLIGHT_CACHE_PATH, JSON.stringify(cache, null, 2));
            return;
        } catch (error) {
            lastError = error;
            if (!PREFLIGHT_WRITE_RETRYABLE_CODES.has(error?.code) || attempt === PREFLIGHT_WRITE_RETRY_COUNT - 1) {
                throw error;
            }
            sleepSync(PREFLIGHT_WRITE_RETRY_DELAY_MS);
        }
    }

    if (lastError) {
        throw lastError;
    }
}

function getPreflightCacheKey(mode, options = {}) {
    const explicitTarget = options.explicitTargetPath || '<none>';
    const reuseLabel = options.preferSharedSingleRun ? 'shared-single' : 'cold-start';
    return `${mode}::${reuseLabel}::${explicitTarget}`;
}

function shouldReusePreflight(cache, key, ttlMs) {
    const entry = cache[key];
    if (!entry || typeof entry.completedAt !== 'number') {
        return false;
    }

    return (Date.now() - entry.completedAt) <= ttlMs;
}

function markPreflightDone(cache, key) {
    cache[key] = {
        completedAt: Date.now(),
    };
    writePreflightCache(cache);
}

function hasExplicitPlaywrightTarget(args) {
    const targetFlags = new Set(['--grep', '-g', '--test-list']);

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (targetFlags.has(arg)) {
            const next = args[index + 1];
            if (next && !next.startsWith('-')) {
                return true;
            }
            continue;
        }

        if (
            arg.startsWith('--grep=') ||
            arg.startsWith('--test-list=') ||
            arg === '--last-failed' ||
            arg.startsWith('--only-changed')
        ) {
            return true;
        }

        if (!arg.startsWith('-')) {
            return true;
        }
    }

    return false;
}

function createModeEnv(mode) {
    switch (mode) {
        case 'default':
            return createEnv();
        case 'dev':
            return createEnv({
                PW_USE_DEV_SERVERS: 'true',
                PW_ALLOW_DEV_SERVER_TESTS: 'true',
                PW_START_SERVERS: 'false',
                PW_WORKERS: '1',
            });
        case 'isolated':
            return createEnv({
                PW_USE_DEV_SERVERS: 'false',
            });
        case 'ci':
            return createEnv({
                NODE_OPTIONS: mergeNodeOptions('--max-old-space-size=8192'),
                // Vite 前端子进程默认保持保守堆上限；在系统提交内存偏高时，过大的堆上限会让 Windows/Node 24
                // 更容易在 Zone/VirtualAlloc 阶段直接 OOM。需要长链重压时可由调用方显式覆盖。
                BG_NODE_MAX_OLD_SPACE_SIZE: process.env.BG_NODE_MAX_OLD_SPACE_SIZE ?? '4096',
                PW_SERVER_WATCH: 'false',
            });
        case 'critical':
            return createEnv();
        case 'parallel':
            return createEnv({
                PW_ALLOW_FULL_RUN: 'true',
            });
        default:
            console.error(`未知模式: ${mode}`);
            process.exit(1);
    }
}

function getExplicitTargetPath(args) {
    for (const arg of args) {
        if (typeof arg === 'string' && !arg.startsWith('-') && /\.e2e\.[cm]?tsx?$/i.test(arg)) {
            return arg.replace(/\\/g, '/');
        }
    }

    return '';
}

function isPlaywrightListMode(args) {
    return args.some(arg => arg === '--list');
}

function resolveRequestedServiceReuse(envOverrides = {}) {
    const value = (
        envOverrides.PW_E2E_SERVICE_REUSE
        ?? process.env.PW_E2E_SERVICE_REUSE
        ?? ''
    ).trim();
    return value;
}

function isMultiWorkerRequest(value) {
    const raw = String(value ?? '').trim();
    if (!raw) {
        return false;
    }

    const workers = Number.parseInt(raw, 10);
    return Number.isFinite(workers) && workers > 1;
}

function shouldAutoPreferSharedSingleRun({
    mode,
    modeEnv,
    envOverrides = {},
    isListMode,
}) {
    if (isListMode || process.env.CI) {
        return false;
    }

    if (mode === 'dev' || mode === 'parallel') {
        return false;
    }

    if (modeEnv.PW_HAS_EXPLICIT_TARGET !== 'true') {
        return false;
    }

    if (isMultiWorkerRequest(process.env.PW_WORKERS) || isMultiWorkerRequest(envOverrides.PW_WORKERS)) {
        return false;
    }

    return !resolveUseDevServers(modeEnv);
}

function buildManagedRuntimeArgs({
    explicitTargetPath,
    preferSharedSingleRun,
    runtimeScope,
}) {
    const args = [
        'scripts/infra/e2e-runtime-manager.mjs',
        'ensure',
        '--json',
        '--hold',
        '--target',
        explicitTargetPath,
    ];

    if (preferSharedSingleRun) {
        args.push('--mode', 'shared-single');
    } else {
        args.push('--scope', runtimeScope);
    }

    return args;
}

function summarizeRuntimeBootstrapFailure(error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const [firstParagraph] = rawMessage.split(/\n\s*\n/);
    return firstParagraph?.trim() || rawMessage;
}

function deriveManagedRuntimeScope(mode, explicitTargetPath) {
    const normalizedTarget = String(explicitTargetPath ?? '')
        .trim()
        .replace(/\\/g, '/')
        .toLowerCase();
    const normalizedWorktree = process.cwd()
        .trim()
        .replace(/\\/g, '/')
        .toLowerCase();
    const baseName = path.basename(normalizedTarget)
        .replace(/\.e2e\.[cm]?tsx?$/i, '')
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'target';
    const worktreeName = path.basename(normalizedWorktree)
        .replace(/[^a-z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        || 'worktree';
    const digest = createHash('sha1')
        .update(`${normalizedWorktree}:${mode}:${normalizedTarget}`)
        .digest('hex')
        .slice(0, 10);

    return `single-${mode}-${worktreeName}-${baseName}-${digest}`;
}

function resolveBootstrapMode({ isListMode, shouldUseManagedSingleRuntime }) {
    if (isListMode) {
        return 'none';
    }

    return shouldUseManagedSingleRuntime ? 'attach-managed' : 'legacy-global-setup';
}

export async function runE2ECommand({ mode, extraArgs = [], envOverrides = {}, entrypoint = 'run-e2e-command' } = {}) {
    if (!mode) {
        console.error('用法: node scripts/infra/run-e2e-command.mjs <default|dev|isolated|ci|critical|parallel> [...playwrightArgs]');
        process.exit(1);
    }

    const modeEnv = {
        ...createModeEnv(mode),
        ...envOverrides,
    };
    assertSafeE2EServerMode(modeEnv);
    modeEnv.PW_RUNTIME_SCOPE = modeEnv.PW_RUNTIME_SCOPE
        || process.env.PW_RUNTIME_SCOPE
        || '';

    const explicitTargetPath = getExplicitTargetPath(extraArgs);
    const isListMode = isPlaywrightListMode(extraArgs);
    if (hasExplicitPlaywrightTarget(extraArgs)) {
        modeEnv.PW_HAS_EXPLICIT_TARGET = 'true';
    }
    if (explicitTargetPath) {
        modeEnv.PW_TEST_TARGET = explicitTargetPath;
    }

    ensureE2EAssets({
        targetPath: explicitTargetPath,
        env: {
            ...modeEnv,
            PW_E2E_LIST_ONLY: isListMode ? 'true' : 'false',
        },
        runner: runtimeNode,
    });

    const requestedServiceReuse = resolveRequestedServiceReuse(envOverrides);
    const autoPreferSharedSingleRun = (
        requestedServiceReuse === ''
        && shouldAutoPreferSharedSingleRun({ mode, modeEnv, envOverrides, isListMode })
    );
    const preferSharedSingleRun = requestedServiceReuse === 'shared-single' || autoPreferSharedSingleRun;

    const shouldUseManagedSingleRuntime = (
        mode !== 'dev'
        && mode !== 'parallel'
        && modeEnv.PW_HAS_EXPLICIT_TARGET === 'true'
        && !isMultiWorkerRequest(process.env.PW_WORKERS)
        && !isMultiWorkerRequest(envOverrides.PW_WORKERS)
        && !resolveUseDevServers(modeEnv)
        && !isListMode
    );
    const bootstrapMode = resolveBootstrapMode({ isListMode, shouldUseManagedSingleRuntime });
    const commandSource = [runtimeNode, playwrightCli, 'test', ...extraArgs].join(' ');
    modeEnv.PW_E2E_STANDARD_ENTRY = 'true';
    modeEnv.PW_E2E_SESSION_ID = modeEnv.PW_E2E_SESSION_ID
        || process.env.PW_E2E_SESSION_ID
        || createE2ESessionId();
    modeEnv.PW_E2E_ENTRYPOINT = entrypoint;
    modeEnv.PW_E2E_COMMAND_SOURCE = commandSource;
    modeEnv.PW_E2E_LIST_ONLY = isListMode ? 'true' : 'false';
    modeEnv.PW_E2E_BOOTSTRAP_MODE = bootstrapMode;
    modeEnv.PW_E2E_TARGET = explicitTargetPath || (isListMode ? '<list>' : '<all>');
    if (bootstrapMode === 'legacy-global-setup') {
        modeEnv.PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP = 'true';
    }

    if (!modeEnv.PW_RUNTIME_SCOPE) {
        modeEnv.PW_RUNTIME_SCOPE = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    if (preferSharedSingleRun) {
        modeEnv.PW_E2E_SERVICE_REUSE = 'shared-single';
        if (requestedServiceReuse === 'shared-single') {
            console.log('♻️ 显式启用共享单 worker E2E runtime；将尝试复用 shared-single 服务。');
        } else {
            console.log('♻️ 本地显式目标 E2E 默认优先复用同 worktree 的 shared-single runtime；若共享 runtime 不可用，将自动回退到 isolated runtime。');
        }
    } else if (
        !isListMode
        && modeEnv.PW_HAS_EXPLICIT_TARGET === 'true'
        && process.platform === 'win32'
        && process.env.CODEX_MANAGED_BY_NPM === '1'
        && !process.env.CI
    ) {
        console.log('🧭 Codex Windows 显式目标运行：默认使用托管 isolated-single runtime，避免 shared-single 在多 worktree/连续运行下的串扰。');
    }

    if (isListMode) {
        console.log('🧾 检测到 Playwright --list，仅列举用例，跳过托管 runtime 启动。');
    }

    await waitForE2ERuntimeWindow({
        isListMode,
        mode,
        preferSharedSingleRun,
    });

    const preflightCache = readPreflightCache();
    const preflightKey = getPreflightCacheKey(mode, {
        explicitTargetPath,
        preferSharedSingleRun,
    });

    if (!isListMode) {
        await assertChildProcessSupport('E2E', { probeFork: true, probeEsbuild: true });
    }

    if (mode === 'ci' && !isListMode) {
        const cleanupCacheKey = `${preflightKey}::cleanup`;
        if (shouldReusePreflight(preflightCache, cleanupCacheKey, CLEANUP_CACHE_TTL_MS)) {
            console.log('♻️ 跳过重复的 E2E 清理检查（近期已执行）。');
        } else {
            await cleanupTestConnections([]);
            markPreflightDone(preflightCache, cleanupCacheKey);
        }
    }

    if (!isListMode) {
        const encodingCacheKey = `${preflightKey}::encoding`;
        if (shouldReusePreflight(preflightCache, encodingCacheKey, ENCODING_CACHE_TTL_MS)) {
            console.log('♻️ 跳过重复的编码检查（近期已执行）。');
        } else {
            runEncodingCheck([]);
            markPreflightDone(preflightCache, encodingCacheKey);
        }
    }

    if (mode !== 'parallel' && !isListMode) {
        const safetyCacheKey = `${preflightKey}::safety`;
        if (shouldReusePreflight(preflightCache, safetyCacheKey, SAFETY_CACHE_TTL_MS)) {
            console.log('♻️ 跳过重复的 E2E 环境检查（近期已执行）。');
        } else {
            await runE2ESafetyCheck(modeEnv);
            markPreflightDone(preflightCache, safetyCacheKey);
        }
    }

    let heldRuntimeManager = null;
    let globalBudgetHandle = null;
    let managedRuntime = null;
    const taskGuard = isListMode
        ? null
        : await acquireTaskGuardWithQueue({
            name: 'e2e-run',
            conflicts: ['quality-gate'],
            command: [runtimeNode, playwrightCli, 'test', ...extraArgs].join(' '),
            metadata: {
                mode,
                target: explicitTargetPath || '<all>',
                managedRuntime: shouldUseManagedSingleRuntime,
                runtimeScope: modeEnv.PW_RUNTIME_SCOPE || '',
                serviceReuse: preferSharedSingleRun ? 'shared-single' : 'isolated',
                listOnly: isListMode,
                sessionId: modeEnv.PW_E2E_SESSION_ID,
                entrypoint,
            },
        });
    try {
        if (isListMode) {
            console.log('🪶 --list 属于轻量命令，跳过清理、编码检查、环境检查、重任务排队和全局内存门禁。');
        } else {
            globalBudgetHandle = await acquireGlobalHeavyBudget({
                group: 'e2e',
                command: [runtimeNode, playwrightCli, 'test', ...extraArgs].join(' '),
                waitForBudget: true,
                waitTimeoutMs: parsePositiveIntegerEnv(
                    'BG_HEAVY_WAIT_TIMEOUT_MS',
                    HEAVY_TASK_GUARD_WAIT_TIMEOUT_MS,
                ),
                metadata: {
                    mode,
                    target: explicitTargetPath || '<all>',
                    runtimeScope: modeEnv.PW_RUNTIME_SCOPE || '',
                    serviceReuse: preferSharedSingleRun ? 'shared-single' : 'isolated',
                    listOnly: isListMode,
                    sessionId: modeEnv.PW_E2E_SESSION_ID,
                    entrypoint,
                },
            });
        }

        if (shouldUseManagedSingleRuntime) {
            let managedBootstrap;
            if (preferSharedSingleRun) {
                try {
                    managedBootstrap = await ensureManagedRuntimeWithHold(runtimeNode, buildManagedRuntimeArgs({
                        explicitTargetPath,
                        preferSharedSingleRun: true,
                        runtimeScope: modeEnv.PW_RUNTIME_SCOPE,
                    }), modeEnv);
                } catch (error) {
                    console.warn(
                        [
                            '⚠️ shared-single runtime 复用失败，将自动回退到 isolated runtime。',
                            summarizeRuntimeBootstrapFailure(error),
                        ].join('\n'),
                    );
                    managedBootstrap = await ensureManagedRuntimeWithHold(runtimeNode, buildManagedRuntimeArgs({
                        explicitTargetPath,
                        preferSharedSingleRun: false,
                        runtimeScope: modeEnv.PW_RUNTIME_SCOPE,
                    }), modeEnv);
                }
            } else {
                managedBootstrap = await ensureManagedRuntimeWithHold(runtimeNode, buildManagedRuntimeArgs({
                    explicitTargetPath,
                    preferSharedSingleRun: false,
                    runtimeScope: modeEnv.PW_RUNTIME_SCOPE,
                }), modeEnv);
            }

            const { child, payload } = managedBootstrap;
            heldRuntimeManager = child;
            managedRuntime = payload;
            const runtimeMode = payload.mode;
            const runtimePorts = payload.ports;
            modeEnv.PW_MANAGED_RUNTIME_ID = payload.runtimeId;
            modeEnv.PW_SKIP_RUNTIME_BOOTSTRAP = 'true';
            modeEnv.PW_RUNTIME_MODE = runtimeMode;
            modeEnv.PW_RUNTIME_SCOPE = payload.scope;
            modeEnv.PW_PORT = String(runtimePorts.frontend);
            modeEnv.PW_GAME_SERVER_PORT = String(runtimePorts.gameServer);
            modeEnv.GAME_SERVER_PORT = String(runtimePorts.gameServer);
            modeEnv.PW_API_SERVER_PORT = String(runtimePorts.apiServer);
            modeEnv.API_SERVER_PORT = String(runtimePorts.apiServer);
            if (runtimeMode === 'isolated-single') {
                modeEnv.PW_ISOLATE_PORTS = 'true';
                console.log(`🧭 Explicit target detected; using managed isolated runtime: frontend=${runtimePorts.frontend}, game=${runtimePorts.gameServer}, api=${runtimePorts.apiServer}`);
            } else {
                console.log(`♻️ 复用/附着共享 runtime: frontend=${runtimePorts.frontend}, game=${runtimePorts.gameServer}, api=${runtimePorts.apiServer}`);
            }
        }

        const playwrightArgs = ['test'];

        if (mode === 'critical') {
            playwrightArgs.push('e2e/smashup/smashup.e2e.ts', 'e2e/tictactoe/tictactoe-rematch.e2e.ts');
        }

        if (mode === 'parallel') {
            playwrightArgs.push('--config=playwright.config.parallel.ts');
        }

        playwrightArgs.push(...extraArgs);

        const exitCode = run(runtimeNode, [playwrightCli, ...playwrightArgs], modeEnv);
        if (exitCode !== 0) {
            process.exitCode = exitCode;
        }
    } finally {
        await stopHeldManager(heldRuntimeManager);
        if (managedRuntime?.mode === 'isolated-single' && !heldRuntimeManager) {
            stopManagedRuntime(managedRuntime.runtimeId, modeEnv);
        }
        globalBudgetHandle?.release?.();
        taskGuard?.release?.();
    }
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    await runE2ECommand({
        mode: process.argv[2],
        extraArgs: process.argv.slice(3),
    });
}
