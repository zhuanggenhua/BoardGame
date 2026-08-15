import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS, toPortArray } from '../scripts/infra/e2e-port-config.js';
import { assertSafeE2EServerMode, resolveUseDevServers } from '../scripts/infra/e2e-mode-config.js';
import { withWindowsHide } from '../scripts/infra/windows-hide.js';
import {
    cleanupAllWorkerPortFiles,
    loadWorkerPorts,
    reserveAvailablePorts,
    reservePorts,
    saveWorkerPorts,
    waitForPortsFree,
} from '../scripts/infra/port-allocator.js';
import {
    describeRuntimeConflict,
    findRuntimesByPorts,
    getWorktreeRoot,
    pruneStaleRuntimes,
    upsertRuntime,
} from '../scripts/infra/e2e-runtime-registry.js';
import { inspectManagedRuntime } from '../scripts/infra/e2e-runtime-manager.mjs';

interface RuntimeRecord {
    workerId: number;
    pid: number;
    logFile: string;
    reusedExistingServers?: boolean;
    ports: {
        frontend: number;
        gameServer: number;
        apiServer: number;
    };
}

const TMP_DIR = path.join(process.cwd(), '.tmp');
// 冷启动场景（Vite 依赖重优化 + API 首次初始化）可能超过 4 分钟，默认给到 7 分钟避免误判超时
const SERVICE_READY_TIMEOUT_MS = Number.parseInt(process.env.PW_SERVICE_READY_TIMEOUT_MS || '420000', 10);
const PORT_CLEANUP_TIMEOUT_MS = Number.parseInt(process.env.PW_PORT_CLEANUP_TIMEOUT_MS || '20000', 10);
assertSafeE2EServerMode(process.env);
const useDevServers = resolveUseDevServers(process.env);
const forceStartServers = process.env.PW_START_SERVERS === 'true';
const shouldStartServers = forceStartServers || !useDevServers;
const shouldReuseExistingServers = process.env.PW_REUSE_EXISTING_SERVERS === 'true';
const runtimeNode = process.env.PW_NODE_BINARY || process.execPath;
const isStandardEntry = process.env.PW_E2E_STANDARD_ENTRY === 'true';
const bootstrapMode = process.env.PW_E2E_BOOTSTRAP_MODE?.trim() || '';
const allowLegacyGlobalBootstrap = process.env.PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP === 'true';
const isListOnly = process.env.PW_E2E_LIST_ONLY === 'true';

function resolveSingleWorkerPorts() {
    if (useDevServers) {
        return DEV_SERVER_PORTS;
    }

    return loadWorkerPorts(0) ?? E2E_SINGLE_WORKER_PORTS;
}

const singleWorkerPorts = resolveSingleWorkerPorts();

function getRuntimeMetadata() {
    return {
        sessionId: process.env.PW_E2E_SESSION_ID?.trim() || `${getRuntimeScope()}-legacy`,
        entrypoint: process.env.PW_E2E_ENTRYPOINT?.trim() || 'playwright-global-setup',
        commandSource: process.env.PW_E2E_COMMAND_SOURCE?.trim() || 'playwright-global-setup',
        targetLabel: process.env.PW_E2E_TARGET?.trim() || process.env.PW_TEST_TARGET?.trim() || '',
    };
}

function getRuntimeScope(): string {
    const normalized = (process.env.PW_RUNTIME_SCOPE || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return normalized || 'default';
}

function getProcessFilePath(): string {
    return path.join(TMP_DIR, `playwright-worker-runtime-${getRuntimeScope()}.json`);
}

function getBootstrapLogFile(workerId: number): string {
    return path.join(TMP_DIR, `playwright-bootstrap-${getRuntimeScope()}-worker-${workerId}.log`);
}

function isProcessAlive(pid: number): boolean {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        // EPERM 说明进程存在但当前进程无权限操作
        return code === 'EPERM';
    }
}

function getLogTail(logFile: string, maxChars = 4000): string {
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
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
            return '(启动日志不存在)';
        }

        return `(读取启动日志失败: ${error instanceof Error ? error.message : String(error)})`;
    }
}

async function isUrlReady(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { redirect: 'manual' });
        return response.ok;
    } catch {
        return false;
    }
}

async function sleep(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForUrl(runtime: RuntimeRecord, url: string, timeoutMs = SERVICE_READY_TIMEOUT_MS): Promise<void> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (!isProcessAlive(runtime.pid)) {
            throw new Error(
                [
                    `服务启动进程已退出: worker=${runtime.workerId}, pid=${runtime.pid}`,
                    `目标 URL: ${url}`,
                    `启动日志: ${runtime.logFile}`,
                    '--- 启动日志尾部 ---',
                    getLogTail(runtime.logFile),
                ].join('\n'),
            );
        }

        if (await isUrlReady(url)) {
            return;
        }

        await sleep(1000);
    }

    throw new Error(
        [
            `等待服务就绪超时: ${url}`,
            `worker=${runtime.workerId}, pid=${runtime.pid}`,
            `启动日志: ${runtime.logFile}`,
            '--- 启动日志尾部 ---',
            getLogTail(runtime.logFile),
        ].join('\n'),
    );
}

async function waitForManagedRuntimeReady(managedRuntimeId: string, scope: string, timeoutMs = 30000) {
    const startedAt = Date.now();
    let lastRuntime = null as Awaited<ReturnType<typeof inspectManagedRuntime>> | null;

    while (Date.now() - startedAt < timeoutMs) {
        lastRuntime = await inspectManagedRuntime({
            runtimeId: managedRuntimeId,
            scope,
        });
        if (lastRuntime?.health?.ready) {
            return lastRuntime;
        }
        await sleep(1000);
    }

    return lastRuntime;
}

async function waitForManagedRuntimeUrls(
    runtime: {
        ports?: {
            frontend?: number;
            gameServer?: number;
            apiServer?: number;
        };
    } | null,
    timeoutMs = 15000,
): Promise<boolean> {
    const frontendPort = Number(runtime?.ports?.frontend);
    const gameServerPort = Number(runtime?.ports?.gameServer);
    const apiServerPort = Number(runtime?.ports?.apiServer);

    if (!Number.isFinite(frontendPort) || !Number.isFinite(gameServerPort) || !Number.isFinite(apiServerPort)) {
        return false;
    }

    const urls = [
        `http://127.0.0.1:${frontendPort}/__ready`,
        `http://127.0.0.1:${frontendPort}/@vite/client`,
        `http://127.0.0.1:${frontendPort}/src/main.tsx`,
        `http://127.0.0.1:${gameServerPort}/games`,
        `http://127.0.0.1:${apiServerPort}/health`,
    ];
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        const ready = await Promise.all(urls.map(isUrlReady));
        if (ready.every(Boolean)) {
            return true;
        }
        await sleep(1000);
    }

    return false;
}

async function cleanupSingleWorkerPorts(): Promise<void> {
    const conflicts = findRuntimesByPorts(singleWorkerPorts);
    if (conflicts.length > 0) {
        throw new Error(describeRuntimeConflict(conflicts));
    }

    const released = await waitForPortsFree(toPortArray(singleWorkerPorts), PORT_CLEANUP_TIMEOUT_MS);
    if (!released) {
        throw new Error(
            [
                `单 worker E2E 端口被未知进程占用: ${toPortArray(singleWorkerPorts).join(', ')}`,
                '已拒绝盲目清理这些共享端口，避免误杀其他 AI / worktree / 手工调试进程。',
                '请先运行 `npm run test:e2e:list` 定位 owner，或改用 isolated 端口。',
            ].join('\n'),
        );
    }
}

function spawnDetachedServer(script: string, args: string[] = [], portsOverride = singleWorkerPorts): RuntimeRecord {
    const workerId = args[0] ? Number.parseInt(args[0], 10) : 0;
    const logFile = getBootstrapLogFile(workerId);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const logFd = fs.openSync(logFile, 'a');
    const shouldDetachBootstrap = !(
        process.platform === 'win32'
        && process.env.CODEX_MANAGED_BY_NPM === '1'
    );

    let child;
    try {
        child = spawn(runtimeNode, [script, ...args], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                PW_BOOTSTRAP_LOG_FILE: logFile,
            },
            detached: shouldDetachBootstrap,
            stdio: ['ignore', logFd, logFd],
            ...withWindowsHide({}, process.env),
        });
    } finally {
        fs.closeSync(logFd);
    }

    if (!child.pid) {
        throw new Error(`启动服务失败，未获取到进程 PID: ${script}`);
    }

    if (shouldDetachBootstrap) {
        child.unref();
    }

    return {
        workerId,
        pid: child.pid,
        logFile,
        ports: portsOverride,
    };
}

function registerSingleWorkerRuntime(record: RuntimeRecord, mode: 'shared-single' | 'isolated-single', reusedExistingServers = false): void {
    const metadata = getRuntimeMetadata();
    upsertRuntime({
        scope: getRuntimeScope(),
        active: true,
        mode,
        workers: 1,
        target: process.env.PW_TEST_TARGET || '',
        targetLabel: metadata.targetLabel,
        ports: record.ports,
        ownerPids: Number.isInteger(record.pid) && record.pid > 0 ? [record.pid] : [],
        pids: Number.isInteger(record.pid) && record.pid > 0 ? [record.pid] : [],
        bootstrapLogFiles: record.logFile ? [record.logFile] : [],
        sessionId: metadata.sessionId,
        entrypoint: metadata.entrypoint,
        commandSource: metadata.commandSource,
        reusedExistingServers,
        createdAt: new Date().toISOString(),
    });
}

function killProcessTree(pid: number): void {
    try {
        if (process.platform === 'win32') {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            return;
        }

        process.kill(-pid, 'SIGTERM');
    } catch {
        // 进程可能已经退出，后续端口清理兜底。
    }
}

function cleanupRecordedRuntimes(): void {
    const processFile = getProcessFilePath();
    if (!fs.existsSync(processFile)) {
        return;
    }

    try {
        const runtimes = JSON.parse(fs.readFileSync(processFile, 'utf-8')) as RuntimeRecord[];
        for (const runtime of runtimes) {
            if (!runtime.reusedExistingServers && Number.isInteger(runtime.pid) && runtime.pid > 0) {
                killProcessTree(runtime.pid);
            }
        }
    } catch {
        // ignore
    } finally {
        try {
            fs.unlinkSync(processFile);
        } catch {
            // ignore
        }
    }
}

export default async function globalSetup() {
    const workers = Number.parseInt(process.env.PW_WORKERS || '1', 10);
    const currentWorktreeRoot = getWorktreeRoot();
    const managedRuntimeId = process.env.PW_MANAGED_RUNTIME_ID?.trim() || '';
    const shouldSkipBootstrap = process.env.PW_SKIP_RUNTIME_BOOTSTRAP === 'true';

    if (!shouldStartServers || isListOnly) {
        return;
    }

    if (workers <= 1 && shouldSkipBootstrap && managedRuntimeId) {
        let runtime = await waitForManagedRuntimeReady(
            managedRuntimeId,
            getRuntimeScope(),
            Number.parseInt(process.env.PW_MANAGED_RUNTIME_ATTACH_TIMEOUT_MS || '30000', 10),
        );
        if (!runtime?.health?.ready) {
            const directReady = await waitForManagedRuntimeUrls(runtime, Number.parseInt(process.env.PW_MANAGED_RUNTIME_ATTACH_TIMEOUT_MS || '30000', 10));
            if (directReady && runtime) {
                runtime = {
                    ...runtime,
                    health: {
                        ...(runtime.health ?? {}),
                        ready: true,
                        checks: {
                            ...(runtime.health?.checks ?? {}),
                            frontendReady: true,
                            viteClient: true,
                            mainEntry: true,
                            gameServer: true,
                            apiServer: true,
                        },
                    },
                };
            }
        }
        if (!runtime?.health?.ready) {
            throw new Error(
                [
                    `托管 E2E runtime 不可用: runtimeId=${managedRuntimeId}`,
                    runtime ? `runtime=${JSON.stringify({ scope: runtime.scope, mode: runtime.mode, ports: runtime.ports, health: runtime.health }, null, 2)}` : 'runtime=missing',
                    'run-e2e-command 应先确保 runtime 已就绪；若此处失败，说明 runtime manager 或 registry 出现了假 ready。',
                ].join('\n'),
            );
        }

        process.env.PW_PORT = String(runtime.ports.frontend);
        process.env.PW_GAME_SERVER_PORT = String(runtime.ports.gameServer);
        process.env.GAME_SERVER_PORT = String(runtime.ports.gameServer);
        process.env.PW_API_SERVER_PORT = String(runtime.ports.apiServer);
        process.env.API_SERVER_PORT = String(runtime.ports.apiServer);
        console.log(`♻️ globalSetup 附着托管 runtime: ${runtime.runtimeId}`);
        return;
    }

    if (isStandardEntry && bootstrapMode === 'attach-managed') {
        throw new Error(
            [
                '当前运行已标记为标准 E2E supervisor 入口，但 globalSetup 没拿到可附着的 managed runtime。',
                '为避免再次旁路启动 detached 测试服务，globalSetup 已拒绝自行起服。',
                '请重新通过项目脚本发起运行，并确认 run-e2e-command / runtime-manager 没有提前退出。',
            ].join('\n'),
        );
    }

    if (!allowLegacyGlobalBootstrap && bootstrapMode !== 'legacy-global-setup') {
        throw new Error(
            [
                '已阻止裸 Playwright 入口在 globalSetup 中直接起服。',
                '请改用项目标准入口，例如：',
                '1. node scripts/infra/run-e2e-command.mjs ci e2e/<相关文件>.e2e.ts',
                '2. node scripts/infra/run-e2e-single.mjs ci e2e/<相关文件>.e2e.ts "可选用例名"',
                '若确需沿用旧 globalSetup 起服链，请显式设置 PW_ALLOW_LEGACY_GLOBAL_BOOTSTRAP=true。',
            ].join('\n'),
        );
    }

    fs.mkdirSync(TMP_DIR, { recursive: true });
    pruneStaleRuntimes(process.cwd(), { killOrphans: true, logger: console });

    if (workers <= 1) {
        const urls = [
            `http://127.0.0.1:${singleWorkerPorts.gameServer}/games`,
            `http://127.0.0.1:${singleWorkerPorts.apiServer}/health`,
            `http://127.0.0.1:${singleWorkerPorts.frontend}/__ready`,
        ];
        const singleWorkerMode = process.env.PW_ISOLATE_PORTS === 'true' ? 'isolated-single' : 'shared-single';
        const conflictingRuntimes = findRuntimesByPorts(singleWorkerPorts);
        const foreignRuntimes = conflictingRuntimes.filter(runtime => runtime.worktreeRoot !== currentWorktreeRoot);
        const localRuntimes = conflictingRuntimes.filter(runtime => runtime.worktreeRoot === currentWorktreeRoot);

        if (shouldReuseExistingServers) {
            const ready = await Promise.all(urls.map(isUrlReady));
            if (ready.every(Boolean)) {
                if (foreignRuntimes.length > 0) {
                    throw new Error(describeRuntimeConflict(conflictingRuntimes));
                }

                if (localRuntimes.length === 0) {
                    throw new Error(
                        [
                            '检测到单 worker E2E 端口已就绪，但共享 runtime registry 中没有当前 worktree 的 owner。',
                            '已拒绝盲目复用未知来源的共享服务，避免误连到其他 AI / worktree 的测试环境。',
                            '请先运行 `npm run test:e2e:list` 确认 owner，或改用 isolated 端口。',
                        ].join('\n'),
                    );
                }

                console.log('\n♻️ 复用现有单 worker E2E 服务\n');
                fs.writeFileSync(getProcessFilePath(), JSON.stringify([{
                    workerId: 0,
                    pid: Number.NaN,
                    logFile: '',
                    ports: singleWorkerPorts,
                    reusedExistingServers: true,
                }], null, 2));
                return;
            }
        }

        cleanupRecordedRuntimes();
        await cleanupSingleWorkerPorts();
        if (singleWorkerMode === 'isolated-single') {
            await reservePorts(0, singleWorkerPorts, {
                scope: getRuntimeScope(),
                ownerPid: process.pid,
                target: process.env.PW_TEST_TARGET || '',
            });
        }

        const runtime = spawnDetachedServer('scripts/infra/start-single-worker-servers.js', [], singleWorkerPorts);
        fs.writeFileSync(getProcessFilePath(), JSON.stringify([runtime], null, 2));
        registerSingleWorkerRuntime(runtime, singleWorkerMode);

        await Promise.all(urls.map(url => waitForUrl(runtime, url)));
        console.log('\n✅ 单 worker E2E 服务已就绪\n');
        return;
    }

    cleanupRecordedRuntimes();
    cleanupAllWorkerPortFiles();

    const runtimes: RuntimeRecord[] = [];
    console.log(`\n🚀 启动 ${workers} 个并行 worker 的隔离服务...\n`);

    for (let workerId = 0; workerId < workers; workerId++) {
        const ports = await reserveAvailablePorts(workerId, {
            scope: getRuntimeScope(),
            ownerPid: process.pid,
            target: process.env.PW_TEST_TARGET || '',
        });
        saveWorkerPorts(workerId, ports);

        const runtime = spawnDetachedServer('scripts/infra/start-worker-servers.js', [String(workerId)]);
        runtimes.push({
            ...runtime,
            workerId,
            ports,
        });

        console.log(
            `Worker ${workerId}: Frontend=${ports.frontend}, GameServer=${ports.gameServer}, API=${ports.apiServer}, PID=${runtime.pid}`,
        );
    }

    fs.writeFileSync(getProcessFilePath(), JSON.stringify(runtimes, null, 2));
    upsertRuntime({
        scope: getRuntimeScope(),
        active: true,
        mode: 'isolated-multi',
        workers,
        target: process.env.PW_TEST_TARGET || '',
        targetLabel: getRuntimeMetadata().targetLabel,
        ports: runtimes.map(runtime => runtime.ports),
        ownerPids: runtimes.map(runtime => runtime.pid),
        pids: runtimes.map(runtime => runtime.pid),
        bootstrapLogFiles: runtimes.map(runtime => runtime.logFile),
        sessionId: getRuntimeMetadata().sessionId,
        entrypoint: getRuntimeMetadata().entrypoint,
        commandSource: getRuntimeMetadata().commandSource,
        createdAt: new Date().toISOString(),
    });

    await Promise.all(runtimes.map(async (runtime) => {
        const { workerId, ports } = runtime;
        await waitForUrl(runtime, `http://127.0.0.1:${ports.gameServer}/games`);
        await waitForUrl(runtime, `http://127.0.0.1:${ports.apiServer}/health`);
        await waitForUrl(runtime, `http://127.0.0.1:${ports.frontend}/__ready`);
        console.log(`✅ Worker ${workerId} 服务已就绪`);
    }));
}
