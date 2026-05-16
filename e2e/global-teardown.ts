import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS, toPortArray } from '../scripts/infra/e2e-port-config.js';
import { assertSafeE2EServerMode, resolveUseDevServers } from '../scripts/infra/e2e-mode-config.js';
import {
    allocatePorts,
    cleanupAllWorkerPortFiles,
    cleanupPorts,
    cleanupWorkerPorts,
    loadWorkerPorts,
    releaseReservedPortsForScope,
    waitForPortsFree,
} from '../scripts/infra/port-allocator.js';
import { removeRuntime } from '../scripts/infra/e2e-runtime-registry.js';
import { stopManagedRuntime } from '../scripts/infra/e2e-runtime-manager.mjs';

interface RuntimeRecord {
    workerId: number;
    pid: number;
    reusedExistingServers?: boolean;
    ports?: {
        frontend: number;
        gameServer: number;
        apiServer: number;
    };
}

const PORT_CLEANUP_TIMEOUT_MS = Number.parseInt(process.env.PW_PORT_CLEANUP_TIMEOUT_MS || '10000', 10);

function getRuntimeScope(): string {
    const normalized = (process.env.PW_RUNTIME_SCOPE || 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
    return normalized || 'default';
}

function getProcessFilePath(): string {
    return path.join(process.cwd(), '.tmp', `playwright-worker-runtime-${getRuntimeScope()}.json`);
}

function killProcessTree(pid: number): void {
    try {
        if (process.platform === 'win32') {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            return;
        }

        process.kill(-pid, 'SIGTERM');
    } catch {
        // 进程可能已经退出，后续端口清理会兜底。
    }
}

export default async function globalTeardown() {
    const workers = Number.parseInt(process.env.PW_WORKERS || '1', 10);
    assertSafeE2EServerMode(process.env);
    const useDevServers = resolveUseDevServers(process.env);
    const forceStartServers = process.env.PW_START_SERVERS === 'true';
    const shouldStartServers = forceStartServers || !useDevServers;
    const singleWorkerPorts = useDevServers ? DEV_SERVER_PORTS : E2E_SINGLE_WORKER_PORTS;
    const managedRuntimeId = process.env.PW_MANAGED_RUNTIME_ID?.trim() || '';
    const managedRuntimeMode = process.env.PW_RUNTIME_MODE?.trim() || '';
    const shouldSkipBootstrap = process.env.PW_SKIP_RUNTIME_BOOTSTRAP === 'true';
    const isListOnly = process.env.PW_E2E_LIST_ONLY === 'true';

    if (!shouldStartServers || isListOnly) {
        return;
    }

    if (workers <= 1 && shouldSkipBootstrap && managedRuntimeId) {
        if (managedRuntimeMode === 'isolated-single') {
            await stopManagedRuntime({
                runtimeId: managedRuntimeId,
                scope: getRuntimeScope(),
                logger: console,
            });
        } else {
            console.log(`♻️ 本次运行附着共享 runtime，teardown 不主动停止: ${managedRuntimeId}`);
        }
        cleanupAllWorkerPortFiles();
        return;
    }

    console.log(`\n🧹 清理${workers > 1 ? '多 worker 隔离' : '单 worker'} E2E 服务...\n`);

    const processFile = getProcessFilePath();
    let runtimes: RuntimeRecord[] = [];
    let reusedExistingServers = false;
    if (fs.existsSync(processFile)) {
        try {
            runtimes = JSON.parse(fs.readFileSync(processFile, 'utf-8')) as RuntimeRecord[];
            reusedExistingServers = runtimes.length > 0 && runtimes.every(runtime => runtime.reusedExistingServers === true);
            for (const runtime of runtimes) {
                if (!runtime.reusedExistingServers && Number.isInteger(runtime.pid) && runtime.pid > 0) {
                    killProcessTree(runtime.pid);
                }
            }
        } finally {
            try {
                fs.unlinkSync(processFile);
            } catch {
                // ignore
            }
        }
    }

    if (workers <= 1) {
        const ownedSingleWorkerPorts = runtimes[0]?.ports ?? singleWorkerPorts;
        if (!reusedExistingServers) {
            cleanupPorts(ownedSingleWorkerPorts, 'Single Worker');
            await waitForPortsFree(toPortArray(ownedSingleWorkerPorts), PORT_CLEANUP_TIMEOUT_MS);
        } else {
            console.log('♻️ 本次运行复用了现有单 worker E2E 服务，teardown 不会停止共享服务。');
        }
        cleanupAllWorkerPortFiles();
        releaseReservedPortsForScope(getRuntimeScope());
        removeRuntime(getRuntimeScope());
        return;
    }

    const recordedWorkerPorts = runtimes
        .map(runtime => runtime.ports)
        .filter((ports): ports is NonNullable<RuntimeRecord['ports']> => Boolean(ports));

    if (recordedWorkerPorts.length > 0) {
        for (const ports of recordedWorkerPorts) {
            cleanupPorts(ports, 'Worker Runtime');
        }
    } else {
        for (let workerIndex = 0; workerIndex < workers; workerIndex++) {
            cleanupWorkerPorts(workerIndex);
        }
    }

    const multiWorkerPorts = (recordedWorkerPorts.length > 0
        ? recordedWorkerPorts
        : Array.from({ length: workers }, (_, workerIndex) => (
            loadWorkerPorts(workerIndex) ?? allocatePorts(workerIndex)
        ))).flatMap(ports => toPortArray(ports));
    const released = await waitForPortsFree(multiWorkerPorts, PORT_CLEANUP_TIMEOUT_MS);
    if (!released) {
        console.warn(`⚠️ 多 worker E2E 端口释放超时: ${multiWorkerPorts.join(', ')}`);
    }

    cleanupAllWorkerPortFiles();
    releaseReservedPortsForScope(getRuntimeScope());
    removeRuntime(getRuntimeScope());
}
