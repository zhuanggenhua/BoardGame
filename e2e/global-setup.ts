import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS, toPortArray } from '../scripts/infra/e2e-port-config.js';
import { withWindowsHide } from '../scripts/infra/windows-hide.js';
import {
    allocateAvailablePorts,
    cleanupAllWorkerPortFiles,
    cleanupPorts,
    cleanupWorkerPorts,
    saveWorkerPorts,
    waitForPortsFree,
} from '../scripts/infra/port-allocator.js';
import { upsertRuntime } from '../scripts/infra/e2e-runtime-registry.js';

interface RuntimeRecord {
    workerId: number;
    pid: number;
    logFile: string;
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
const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
const forceStartServers = process.env.PW_START_SERVERS === 'true';
const shouldStartServers = forceStartServers || !useDevServers;
const shouldReuseExistingServers = process.env.PW_REUSE_EXISTING_SERVERS === 'true';
const singleWorkerPorts = useDevServers ? DEV_SERVER_PORTS : E2E_SINGLE_WORKER_PORTS;
const runtimeNode = process.env.PW_NODE_BINARY || process.execPath;

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

        await new Promise(resolve => setTimeout(resolve, 1000));
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

async function cleanupSingleWorkerPorts(): Promise<void> {
    cleanupPorts(singleWorkerPorts, 'Single Worker');

    const released = await waitForPortsFree(toPortArray(singleWorkerPorts), PORT_CLEANUP_TIMEOUT_MS);
    if (!released) {
        throw new Error(`单 worker E2E 端口释放超时: ${toPortArray(singleWorkerPorts).join(', ')}`);
    }
}

function spawnDetachedServer(script: string, args: string[] = [], portsOverride = singleWorkerPorts): RuntimeRecord {
    const workerId = args[0] ? Number.parseInt(args[0], 10) : 0;
    const logFile = getBootstrapLogFile(workerId);
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const logFd = fs.openSync(logFile, 'a');

    let child;
    try {
        child = spawn(runtimeNode, [script, ...args], {
            cwd: process.cwd(),
            env: {
                ...process.env,
                PW_BOOTSTRAP_LOG_FILE: logFile,
            },
            detached: true,
            stdio: ['ignore', logFd, logFd],
            ...withWindowsHide({}, process.env),
        });
    } finally {
        fs.closeSync(logFd);
    }

    if (!child.pid) {
        throw new Error(`启动服务失败，未获取到进程 PID: ${script}`);
    }

    child.unref();

    return {
        workerId,
        pid: child.pid,
        logFile,
        ports: portsOverride,
    };
}

function registerSingleWorkerRuntime(record: RuntimeRecord, mode: 'shared-single' | 'isolated-single', reusedExistingServers = false): void {
    upsertRuntime({
        scope: getRuntimeScope(),
        active: true,
        mode,
        workers: 1,
        target: process.env.PW_TEST_TARGET || '',
        ports: record.ports,
        pids: Number.isInteger(record.pid) && record.pid > 0 ? [record.pid] : [],
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
            killProcessTree(runtime.pid);
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

    if (!shouldStartServers) {
        return;
    }

    fs.mkdirSync(TMP_DIR, { recursive: true });

    if (workers <= 1) {
        const urls = [
            `http://127.0.0.1:${singleWorkerPorts.gameServer}/games`,
            `http://127.0.0.1:${singleWorkerPorts.apiServer}/health`,
            `http://127.0.0.1:${singleWorkerPorts.frontend}/__ready`,
        ];
        const singleWorkerMode = process.env.PW_ISOLATE_PORTS === 'true' ? 'isolated-single' : 'shared-single';

        if (shouldReuseExistingServers) {
            const ready = await Promise.all(urls.map(isUrlReady));
            if (ready.every(Boolean)) {
                console.log('\n♻️ 复用现有单 worker E2E 服务\n');
                registerSingleWorkerRuntime({
                    workerId: 0,
                    pid: Number.NaN,
                    logFile: '',
                    ports: singleWorkerPorts,
                }, singleWorkerMode, true);
                return;
            }
        }

        cleanupRecordedRuntimes();
        await cleanupSingleWorkerPorts();

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
        cleanupWorkerPorts(workerId);

        const ports = await allocateAvailablePorts(workerId);
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
        ports: runtimes.map(runtime => runtime.ports),
        pids: runtimes.map(runtime => runtime.pid),
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
