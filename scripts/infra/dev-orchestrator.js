import net from 'node:net';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { withWindowsHide } from './windows-hide.js';

const managedChildren = [];
let shuttingDown = false;
const repoRoot = process.cwd();
const devBundleDir = process.env.DEV_BUNDLE_DIR || path.join('temp', 'dev-bundles');
const devStartupTimeoutMs = Number(process.env.DEV_STARTUP_TIMEOUT_MS) || 300000;

function getBundleOutfile(...segments) {
    return path.join(devBundleDir, ...segments);
}

function prefixOutput(label, stream, target) {
    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            target.write(`[${label}] ${line}\n`);
        }
    });
    stream.on('end', () => {
        if (buffer.length > 0) {
            target.write(`[${label}] ${buffer}\n`);
            buffer = '';
        }
    });
}

function startCommand(label, command, args = [], extraEnv = {}, options = {}) {
    const { optional = false } = options;
    const child = spawn(command, args, withWindowsHide({
        cwd: repoRoot,
        env: {
            ...process.env,
            ...extraEnv,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    }));

    managedChildren.push(child);
    prefixOutput(label, child.stdout, process.stdout);
    prefixOutput(label, child.stderr, process.stderr);

    child.on('exit', (code, signal) => {
        if (shuttingDown) {
            return;
        }
        const detail = signal ? `signal=${signal}` : `code=${code ?? 0}`;
        if (optional) {
            console.warn(`[dev-orchestrator] ${label} exited (${detail})，按可选服务处理`);
            return;
        }
        console.error(`[dev-orchestrator] ${label} exited unexpectedly (${detail})`);
        shutdown(typeof code === 'number' ? code : 1);
    });

    return child;
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function probePort(port, host = '127.0.0.1', timeoutMs = 1000) {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        let settled = false;
        const finish = (ok) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(ok);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => finish(true));
        socket.once('timeout', () => finish(false));
        socket.once('error', () => finish(false));
    });
}

async function waitForPort(port, label, timeoutMs = devStartupTimeoutMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (await probePort(port)) {
            const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2);
            console.log(`[dev-orchestrator] ${label} ready on ${port} in ${elapsed}s`);
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`${label} port ${port} startup timeout`);
}

function shutdown(code = 0) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;

    for (const child of managedChildren) {
        if (child.killed) continue;
        try {
            if (process.platform === 'win32') {
                spawn('taskkill', ['/F', '/T', '/PID', String(child.pid)], withWindowsHide({
                    stdio: 'ignore',
                }));
            } else {
                child.kill('SIGTERM');
            }
        } catch {
        }
    }

    setTimeout(() => process.exit(code), 200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function resolveLocalDevModeEnv() {
    return process.env.MONGO_URI ? {} : { USE_PERSISTENT_STORAGE: 'false' };
}

async function main() {
    console.log('[dev-orchestrator] starting api and game in parallel');
    const apiChild = startCommand('dev:api', process.execPath, [
        'scripts/infra/dev-bundle-runner.mjs',
        '--label', 'api',
        '--entry', 'apps/api/src/main.ts',
        '--outfile', getBundleOutfile('api', 'main.mjs'),
        '--tsconfig', 'apps/api/tsconfig.json',
    ], {}, { optional: true });
    const gameExtraEnv = resolveLocalDevModeEnv();
    startCommand('dev:game', process.execPath, [
        'scripts/infra/dev-bundle-runner.mjs',
        '--label', 'game',
        '--entry', 'server.ts',
        '--outfile', getBundleOutfile('game', 'server.mjs'),
        '--tsconfig', 'tsconfig.server.json',
    ], gameExtraEnv);

    console.log(`[dev-orchestrator] waiting for ports (timeout=${Math.floor(devStartupTimeoutMs / 1000)}s)`);

    const gamePort = Number(process.env.GAME_SERVER_PORT) || 18000;
    const apiPort = Number(process.env.API_SERVER_PORT) || 18001;

    await waitForPort(gamePort, 'game');

    let apiReady = false;
    try {
        await waitForPort(apiPort, 'api', 15000);
        apiReady = true;
    } catch (error) {
        console.warn(`[dev-orchestrator] api 未在 15s 内就绪，降级为前端 + game 模式: ${error instanceof Error ? error.message : String(error)}`);
        if (!apiChild.killed) {
            try {
                if (process.platform === 'win32') {
                    spawn('taskkill', ['/F', '/T', '/PID', String(apiChild.pid)], withWindowsHide({ stdio: 'ignore' }));
                } else {
                    apiChild.kill('SIGTERM');
                }
            } catch {
            }
        }
        await wait(250);
    }

    console.log('[dev-orchestrator] starting frontend');
    startCommand('dev:frontend', process.execPath, ['scripts/infra/vite-with-logging.js']);

    if (!apiReady) {
        console.log('[dev-orchestrator] frontend 已启动；API 因本地数据库不可用被跳过');
    }
}

main().catch((error) => {
    console.error('[dev-orchestrator] startup failed:', error instanceof Error ? error.message : String(error));
    shutdown(1);
});
