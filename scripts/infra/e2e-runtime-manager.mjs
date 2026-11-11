import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { E2E_SINGLE_WORKER_PORTS } from './e2e-port-config.js';
import {
    releaseReservedPortsForScope,
    reserveAvailablePorts,
    reservePorts,
    waitForPortsFree,
} from './port-allocator.js';
import {
    acquireSharedRegistryLock,
    describeRuntimeConflict,
    findRuntimeById,
    findRuntimesByPorts,
    formatRuntimeSummary,
    getWorktreeRoot,
    listRuntimes,
    pruneStaleRuntimes,
    removeRuntimeById,
    stopRuntime,
    touchRuntime,
    upsertRuntime,
} from './e2e-runtime-registry.js';
import { startSingleWorkerRuntime } from './single-worker-runtime.js';
import { withE2ELocalAssetEnv } from './e2e-local-assets-env.mjs';
import { getFrontendSourceHash, readRuntimeSourceIdentity, sourceIdentityMatches, selectRuntimeSourceIdentity } from './e2e-source-identity.mjs';

const TMP_DIR = path.join(process.cwd(), '.tmp');
const RUNTIME_READY_TIMEOUT_MS = Number.parseInt(process.env.PW_SERVICE_READY_TIMEOUT_MS || '420000', 10);
const RUNTIME_STOP_TIMEOUT_MS = Number.parseInt(process.env.PW_PORT_CLEANUP_TIMEOUT_MS || '20000', 10);
const HEALTH_POLL_INTERVAL_MS = 1000;
const HEALTH_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.PW_HEALTH_REQUEST_TIMEOUT_MS || '8000', 10);

/** 只保护同一服务的检查与冷启动；就绪后释放，不占用测试执行期。 */
export async function withRuntimeStartupLock(scope, start, { cwd = process.cwd(), timeoutMs = RUNTIME_READY_TIMEOUT_MS } = {}) {
    const directory = path.join(cwd, '.tmp', 'runtime-startup-locks');
    const lockPath = path.join(directory, `${normalizeScope(scope)}.json`);
    fs.mkdirSync(directory, { recursive: true });
    const startedAt = Date.now();
    let ownerPid;
    while (true) {
        const releaseRegistry = acquireSharedRegistryLock(cwd);
        let claimed = false;
        try {
            if (fs.existsSync(lockPath)) {
                ownerPid = Number(JSON.parse(fs.readFileSync(lockPath, 'utf8')).pid);
                if (!Number.isInteger(ownerPid) || ownerPid <= 0) throw new Error(`服务启动锁缺少有效 owner PID: ${lockPath}`);
                if (!isPidAlive(ownerPid)) fs.unlinkSync(lockPath);
            }
            if (!fs.existsSync(lockPath)) {
                const fd = fs.openSync(lockPath, 'wx');
                try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, scope, createdAt: new Date().toISOString() })); }
                finally { fs.closeSync(fd); }
                claimed = true;
            }
        } finally { releaseRegistry(); }
        if (claimed) break;
        if (Date.now() - startedAt >= timeoutMs) throw new Error(`等待同一服务启动超时: scope=${scope}, ownerPid=${ownerPid}, lock=${lockPath}`);
        await sleep(100);
    }
    try { return await start(); }
    finally {
        const releaseRegistry = acquireSharedRegistryLock(cwd);
        try {
            const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
            if (Number(owner.pid) !== process.pid) throw new Error(`服务启动锁 owner 已变化: ${lockPath}`);
            fs.unlinkSync(lockPath);
        } finally { releaseRegistry(); }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeScope(scope, fallback = 'default') {
    const normalized = String(scope ?? fallback).trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return normalized || fallback;
}

function getSharedSingleScope() {
    return 'shared-single';
}

function getIsolatedSingleScope(requestedScope) {
    const normalized = normalizeScope(requestedScope, `pw-${Date.now()}`);
    return normalized.startsWith('isolated-single-') ? normalized : `isolated-single-${normalized}`;
}

function getBootstrapLogFile(scope) {
    return path.join(TMP_DIR, `playwright-runtime-${normalizeScope(scope)}.log`);
}

function isPidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === 'EPERM';
    }
}

function getLogTail(logFile, maxChars = 4000) {
    try {
        const content = fs.readFileSync(logFile, 'utf-8');
        if (!content) {
            return '(启动日志为空)';
        }
        if (content.length <= maxChars) {
            return content;
        }

        return content.slice(content.length - maxChars);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return '(启动日志不存在)';
        }

        return `(读取启动日志失败: ${error instanceof Error ? error.message : String(error)})`;
    }
}

function getSingleWorkerUrls(ports) {
    return {
        frontendReady: `http://127.0.0.1:${ports.frontend}/__ready`,
        viteClient: `http://127.0.0.1:${ports.frontend}/@vite/client`,
        mainEntry: `http://127.0.0.1:${ports.frontend}/src/main.tsx`,
        gameServer: `http://127.0.0.1:${ports.gameServer}/games`,
        apiServer: `http://127.0.0.1:${ports.apiServer}/health`,
    };
}

async function isUrlReady(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            redirect: 'manual',
            signal: controller.signal,
        });
        return response.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

export async function probeSingleWorkerRuntimeHealth(ports) {
    const urls = getSingleWorkerUrls(ports);
    const [frontendReady, viteClient, mainEntry, gameServer, apiServer] = await Promise.all([
        isUrlReady(urls.frontendReady),
        isUrlReady(urls.viteClient),
        isUrlReady(urls.mainEntry),
        isUrlReady(urls.gameServer),
        isUrlReady(urls.apiServer),
    ]);

    return {
        ready: frontendReady && viteClient && mainEntry && gameServer && apiServer,
        checks: {
            frontendReady,
            viteClient,
            mainEntry,
            gameServer,
            apiServer,
        },
        urls,
        lastHealthCheckAt: new Date().toISOString(),
    };
}

function createRuntimeEnv(runtime) {
    return {
        PW_MANAGED_RUNTIME_ID: runtime.runtimeId,
        PW_RUNTIME_SCOPE: runtime.scope,
        PW_RUNTIME_MODE: runtime.mode,
        PW_SKIP_RUNTIME_BOOTSTRAP: 'true',
        PW_E2E_SESSION_ID: runtime.sessionId ?? '',
        PW_E2E_ENTRYPOINT: runtime.entrypoint ?? '',
        PW_E2E_COMMAND_SOURCE: runtime.commandSource ?? '',
        PW_E2E_TARGET: runtime.targetLabel ?? runtime.target ?? '',
        PW_PORT: String(runtime.ports.frontend),
        PW_GAME_SERVER_PORT: String(runtime.ports.gameServer),
        GAME_SERVER_PORT: String(runtime.ports.gameServer),
        PW_API_SERVER_PORT: String(runtime.ports.apiServer),
        API_SERVER_PORT: String(runtime.ports.apiServer),
    };
}

function buildSingleWorkerPlan({ preferSharedSingleRun = false, requestedScope = '', target = '' } = {}) {
    if (preferSharedSingleRun) {
        return {
            scope: getSharedSingleScope(),
            mode: 'shared-single',
            target,
            ports: { ...E2E_SINGLE_WORKER_PORTS },
        };
    }

    return {
        scope: getIsolatedSingleScope(requestedScope),
        mode: 'isolated-single',
        target,
        ports: null,
    };
}

function getLocalRuntimeByScope(scope, cwd = process.cwd()) {
    const worktreeRoot = getWorktreeRoot(cwd);
    return listRuntimes(cwd, { includeStopped: true }).find(runtime => (
        runtime.worktreeRoot === worktreeRoot
        && runtime.scope === normalizeScope(scope)
    )) ?? null;
}

async function cleanupManagedRuntimeGracefully(runtime, controller, logger = console) {
    if (!runtime) {
        return;
    }

    logger.log?.(`🛑 停止 E2E runtime: ${formatRuntimeSummary(runtime)}`);

    if (controller) {
        controller.stop('runtime-manager graceful shutdown');
    } else {
        stopRuntime(runtime, { logger });
    }

    await waitForPortsFree(Object.values(runtime.ports ?? {}), RUNTIME_STOP_TIMEOUT_MS);
    await releaseReservedPortsForScope(runtime.scope, process.cwd(), runtime.ownerPid);
    removeRuntimeById(runtime.runtimeId, process.cwd(), { ownerPid: runtime.ownerPid });
}

function getRuntimeBootstrapLogFile(scope) {
    const logFile = getBootstrapLogFile(scope);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    return logFile;
}

async function waitForRuntimeReady(runtime, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs) ? options.timeoutMs : RUNTIME_READY_TIMEOUT_MS;
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const health = await probeSingleWorkerRuntimeHealth(runtime.ports);
        const inspected = touchRuntime(runtime.scope, {
            target: runtime.target,
            ports: runtime.ports,
            mode: runtime.mode,
            workers: 1,
            health,
        });

        if (health.ready) {
            return {
                ...inspected,
                health,
                status: 'active',
            };
        }

        if (!isPidAlive(runtime.ownerPid)) {
            throw new Error(
                [
                    `E2E runtime 启动进程已退出: ${formatRuntimeSummary(runtime)}`,
                    `启动日志: ${runtime.bootstrapLogFiles?.[0] ?? '<unknown>'}`,
                    '--- 启动日志尾部 ---',
                    getLogTail(runtime.bootstrapLogFiles?.[0] ?? ''),
                ].join('\n'),
            );
        }

        await sleep(HEALTH_POLL_INTERVAL_MS);
    }

    throw new Error(
        [
            `等待 E2E runtime 就绪超时: ${formatRuntimeSummary(runtime)}`,
            `启动日志: ${runtime.bootstrapLogFiles?.[0] ?? '<unknown>'}`,
            '--- 启动日志尾部 ---',
            getLogTail(runtime.bootstrapLogFiles?.[0] ?? ''),
        ].join('\n'),
    );
}

export async function inspectManagedRuntime({ runtimeId = '', scope = '' } = {}) {
    const runtime = runtimeId
        ? findRuntimeById(runtimeId, process.cwd(), { includeStopped: true })
        : getLocalRuntimeByScope(scope || getSharedSingleScope(), process.cwd());

    if (!runtime) {
        return null;
    }

    const health = await probeSingleWorkerRuntimeHealth(runtime.ports);
    const updated = touchRuntime(runtime.scope, {
        target: runtime.target,
        ports: runtime.ports,
        mode: runtime.mode,
        workers: runtime.workers ?? 1,
        health,
    });

    return {
        ...updated,
        health,
        status: health.ready ? 'active' : 'active-unhealthy',
    };
}

export async function stopManagedRuntime({ runtimeId = '', scope = '', logger = console } = {}) {
    const runtime = runtimeId
        ? findRuntimeById(runtimeId, process.cwd(), { includeStopped: true })
        : getLocalRuntimeByScope(scope || getSharedSingleScope(), process.cwd());

    if (!runtime) {
        return { stopped: false, runtime: null };
    }

    logger.log?.(`🛑 停止 E2E runtime: ${formatRuntimeSummary(runtime)}`);
    stopRuntime(runtime, { logger });
    await waitForPortsFree(Object.values(runtime.ports ?? {}), RUNTIME_STOP_TIMEOUT_MS);
    await releaseReservedPortsForScope(runtime.scope, process.cwd(), runtime.ownerPid);
    removeRuntimeById(runtime.runtimeId, process.cwd(), { ownerPid: runtime.ownerPid });

    return { stopped: true, runtime };
}

export async function ensureSingleWorkerRuntime(options = {}) {
    const plan = buildSingleWorkerPlan({
        preferSharedSingleRun: options.preferSharedSingleRun === true,
        requestedScope: options.requestedScope ?? process.env.PW_RUNTIME_SCOPE ?? '',
        target: options.target ?? '',
    });
    return withRuntimeStartupLock(plan.scope, () => ensureSingleWorkerRuntimeUnlocked(options, plan), { timeoutMs: options.timeoutMs });
}

async function ensureSingleWorkerRuntimeUnlocked(options, plan) {
    const logger = options.logger ?? console;
    const target = options.target ?? '';
    const targetGameId = target.replaceAll('\\', '/').match(/^e2e\/([^/]+)\//)?.[1];
    const serverRuntime = process.env.PW_SERVER_RUNTIME || 'bundle';
    const frontendSourceHash = getFrontendSourceHash(process.cwd());
    const currentWorktreeRoot = getWorktreeRoot(process.cwd());

    pruneStaleRuntimes(process.cwd(), { killOrphans: true, logger });

    if (plan.mode === 'shared-single') {
        const conflicts = findRuntimesByPorts(plan.ports, process.cwd(), { includeStopped: true })
            .filter(runtime => runtime.status === 'active' || runtime.status === 'active-unhealthy');
        const foreignConflicts = conflicts.filter(runtime => runtime.worktreeRoot !== currentWorktreeRoot);
        if (foreignConflicts.length > 0) {
            throw new Error(describeRuntimeConflict(conflicts, process.cwd()));
        }
    }

    const existingRuntime = getLocalRuntimeByScope(plan.scope, process.cwd());
    if (existingRuntime) {
        const inspected = await inspectManagedRuntime({ runtimeId: existingRuntime.runtimeId });
        if (inspected?.health?.ready && inspected.serverRuntime === serverRuntime
            && inspected.frontendSourceHash === frontendSourceHash
            && sourceIdentityMatches(selectRuntimeSourceIdentity(inspected.sourceIdentity, targetGameId))) {
            const consumerPids = [...new Set([...(inspected.consumerPids ?? []).filter(isPidAlive), Number(process.env.PW_E2E_CLIENT_PID || process.pid)])];
            touchRuntime(inspected.scope, { consumerPids });
            logger.log?.(`♻️ 复用已就绪的 E2E runtime: ${formatRuntimeSummary(inspected)}`);
            return {
                runtime: inspected,
                env: createRuntimeEnv(inspected),
                reused: true,
            };
        }

        if (!existingRuntime.sourceIdentity || existingRuntime.consumerPids?.some(isPidAlive)) {
            throw new Error(`现有 E2E 服务不满足健康或源码身份要求，且仍有消费者或缺少可验证身份；保留它，不重启他人服务: ${formatRuntimeSummary(inspected ?? existingRuntime)}`);
        }
        await stopManagedRuntime({ runtimeId: existingRuntime.runtimeId, logger });
    }

    let ports;
    if (plan.mode === 'shared-single') {
        ports = await reservePorts(0, plan.ports, {
            scope: plan.scope,
            ownerPid: process.pid,
            target,
        });
    } else {
        await releaseReservedPortsForScope(plan.scope, process.cwd(), process.pid);
        ports = await reserveAvailablePorts(0, {
            scope: plan.scope,
            ownerPid: process.pid,
            target,
        });
    }

    const logFile = getRuntimeBootstrapLogFile(plan.scope);
    let controller = null;
    let provisionalRuntime = null;
    let directSourceIdentity = null;

    try {
        directSourceIdentity = serverRuntime !== 'bundle' ? readRuntimeSourceIdentity(plan.scope) : null;
        controller = await startSingleWorkerRuntime({
            env: withE2ELocalAssetEnv({
                ...process.env,
                PW_RUNTIME_SCOPE: plan.scope,
                PW_TEST_TARGET: target,
                PW_BOOTSTRAP_LOG_FILE: logFile,
                PW_SERVER_WATCH: process.env.PW_SERVER_WATCH ?? 'false',
                E2E_PROXY_QUIET: process.env.E2E_PROXY_QUIET ?? 'true',
                PW_E2E_DAEMON: plan.mode,
                PW_PORT: String(ports.frontend),
                PW_GAME_SERVER_PORT: String(ports.gameServer),
                GAME_SERVER_PORT: String(ports.gameServer),
                PW_API_SERVER_PORT: String(ports.apiServer),
                API_SERVER_PORT: String(ports.apiServer),
                PW_E2E_TARGET: process.env.PW_E2E_TARGET?.trim() || target,
            }),
            logger,
            logFile,
            childStdio: ['ignore', 'pipe', 'pipe'],
            runtimeScope: plan.scope,
            runtimeMode: plan.mode,
            target,
            targetLabel: process.env.PW_E2E_TARGET?.trim() || target,
            sessionId: process.env.PW_E2E_SESSION_ID?.trim() || '',
            entrypoint: process.env.PW_E2E_ENTRYPOINT?.trim() || '',
            commandSource: process.env.PW_E2E_COMMAND_SOURCE?.trim() || '',
        });

        provisionalRuntime = upsertRuntime({
            scope: plan.scope,
            active: true,
            mode: plan.mode,
            workers: 1,
            target,
            targetLabel: process.env.PW_E2E_TARGET?.trim() || target,
            ports,
            ownerPids: [process.pid],
            consumerPids: [Number(process.env.PW_E2E_CLIENT_PID || process.pid)],
            serverRuntime,
            frontendSourceHash,
            servicePids: controller.getServicePids(),
            pids: [process.pid, ...controller.getServicePids()],
            bootstrapLogFiles: [logFile],
            sessionId: process.env.PW_E2E_SESSION_ID?.trim() || '',
            entrypoint: process.env.PW_E2E_ENTRYPOINT?.trim() || '',
            commandSource: process.env.PW_E2E_COMMAND_SOURCE?.trim() || '',
            health: {
                ready: false,
                checks: {},
                urls: getSingleWorkerUrls(ports),
                lastHealthCheckAt: null,
            },
            createdAt: new Date().toISOString(),
        }, process.cwd());

        const readyRuntime = await Promise.race([
            waitForRuntimeReady(provisionalRuntime, {
                timeoutMs: options.timeoutMs,
            }),
            controller.failurePromise.then((error) => {
                throw error;
            }),
        ]);
        const sourceIdentity = directSourceIdentity ?? readRuntimeSourceIdentity(plan.scope);
        if (!sourceIdentityMatches(selectRuntimeSourceIdentity(sourceIdentity, targetGameId))) throw new Error('服务启动期间目标依赖发生变化，请按当前源码重新启动。');
        if (frontendSourceHash !== getFrontendSourceHash(process.cwd())) throw new Error('前端启动配置在服务启动期间发生变化，请按当前配置重新启动。');
        touchRuntime(plan.scope, { sourceIdentity });
        logger.log?.(`✅ E2E runtime 已就绪: ${formatRuntimeSummary(readyRuntime)}`);

        return {
            runtime: readyRuntime,
            env: createRuntimeEnv(readyRuntime),
            reused: false,
            controller,
        };
    } catch (error) {
        if (controller) {
            controller.stop('runtime startup failed');
            await waitForPortsFree(Object.values(ports ?? {}), RUNTIME_STOP_TIMEOUT_MS);
        }
        await releaseReservedPortsForScope(plan.scope, process.cwd(), process.pid);
        if (provisionalRuntime?.runtimeId) {
            removeRuntimeById(provisionalRuntime.runtimeId, process.cwd(), { ownerPid: provisionalRuntime.ownerPid });
        }
        throw error;
    }
}

function formatStatus(runtime) {
    if (!runtime) {
        return '未找到对应 E2E runtime。';
    }

    const checks = runtime.health?.checks
        ? Object.entries(runtime.health.checks).map(([name, ok]) => `${name}=${ok ? 'ok' : 'down'}`).join(', ')
        : 'n/a';

    return [
        formatRuntimeSummary(runtime),
        `ready=${runtime.health?.ready === true}`,
        `checks=${checks}`,
        runtime.health?.lastHealthCheckAt ? `lastHealthCheckAt=${runtime.health.lastHealthCheckAt}` : '',
    ].filter(Boolean).join('\n');
}

function createLogger(quiet) {
    if (!quiet) {
        return console;
    }

    return {
        log() {},
        warn() {},
        error() {},
    };
}

/** 共享服务独立于发起测试存活；控制连接关闭后继续承载后续测试。 */
export async function holdRuntimeOwner(result, input = process.stdin) {
    const keepSharedOwner = result.runtime.mode === 'shared-single' && Boolean(result.controller);
    let finish;
    const released = new Promise(resolve => { finish = resolve; });
    const onInputEnd = () => { if (!keepSharedOwner) finish(); };
    process.once('SIGINT', finish);
    process.once('SIGTERM', finish);
    input.once('end', onInputEnd);
    input.resume();
    try { await Promise.race([released, result.controller?.failurePromise ?? new Promise(() => {})]); }
    finally {
        process.removeListener('SIGINT', finish);
        process.removeListener('SIGTERM', finish);
        input.removeListener('end', onInputEnd);
    }
}

async function main() {
    const [command, ...args] = process.argv.slice(2);
    const argMap = new Map();
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (!arg.startsWith('--')) {
            continue;
        }
        const [key, inlineValue] = arg.split('=', 2);
        const value = inlineValue ?? args[index + 1] ?? '';
        argMap.set(key, value);
        if (inlineValue === undefined && args[index + 1] && !args[index + 1].startsWith('--')) {
            index += 1;
        }
    }
    const jsonMode = argMap.has('--json');
    const holdMode = argMap.has('--hold');
    const logger = createLogger(jsonMode);

    if (command === 'start' || command === 'ensure') {
        const result = await ensureSingleWorkerRuntime({
            preferSharedSingleRun: argMap.get('--mode') === 'shared-single',
            requestedScope: argMap.get('--scope') || '',
            target: argMap.get('--target') || '',
            logger,
        });
        const payload = {
            runtimeId: result.runtime.runtimeId,
            scope: result.runtime.scope,
            mode: result.runtime.mode,
            ports: result.runtime.ports,
            reused: result.reused,
        };
        console.log(jsonMode ? JSON.stringify(payload) : JSON.stringify(payload, null, 2));
        if (holdMode) {
            try {
                await holdRuntimeOwner(result);
            } finally {
                if (payload.mode === 'isolated-single' || result.controller) {
                    if (result.controller) {
                        await cleanupManagedRuntimeGracefully(result.runtime, result.controller, logger);
                    } else {
                        await stopManagedRuntime({
                            runtimeId: payload.runtimeId,
                            logger,
                        });
                    }
                }
            }
        } else if (result.controller) {
            await cleanupManagedRuntimeGracefully(result.runtime, result.controller, logger);
            throw new Error('start/ensure 创建新 runtime 时必须使用 --hold，避免 owner 进程提前退出。');
        }
        return;
    }

    if (command === 'status') {
        const runtime = await inspectManagedRuntime({
            runtimeId: argMap.get('--runtimeId') || '',
            scope: argMap.get('--scope') || '',
        });
        if (jsonMode) {
            console.log(JSON.stringify(runtime));
        } else {
            console.log(formatStatus(runtime));
        }
        return;
    }

    if (command === 'stop') {
        const result = await stopManagedRuntime({
            runtimeId: argMap.get('--runtimeId') || '',
            scope: argMap.get('--scope') || '',
            logger,
        });
        if (jsonMode) {
            console.log(JSON.stringify({
                stopped: result.stopped,
                runtimeId: result.runtime?.runtimeId ?? null,
            }));
        } else {
            console.log(result.stopped ? '已停止指定 E2E runtime。' : '未找到可停止的 E2E runtime。');
        }
        return;
    }

    console.error('用法: node scripts/infra/e2e-runtime-manager.mjs <start|ensure|status|stop> [--mode shared-single] [--scope xxx] [--runtimeId xxx] [--target e2e/xxx.e2e.ts]');
    process.exit(1);
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    try {
        await main();
        process.exit(0);
    } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        console.error(message);
        process.exit(1);
    }
}
