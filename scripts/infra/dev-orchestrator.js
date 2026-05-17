import net from 'node:net';
import os from 'node:os';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveDevRuntimePorts, removeDevRuntimePorts } from './dev-port-runtime.js';
import { withWindowsHide } from './windows-hide.js';

const managedChildren = [];
let shuttingDown = false;
const repoRoot = process.cwd();
const devBundleDir = process.env.DEV_BUNDLE_DIR || path.join('temp', 'dev-bundles');
const devStartupTimeoutMs = Number(process.env.DEV_STARTUP_TIMEOUT_MS) || 300000;
const defaultLocalDevMongoUri = 'mongodb://127.0.0.1:27017/boardgame';
const devLiteMode = process.env.BG_DEV_LITE === '1';
const skipApiMode = process.env.BG_DEV_SKIP_API === '1';
const DEFAULT_DEV_PORTS = Object.freeze({
    frontend: 4273,
    gameServer: 18000,
    apiServer: 18001,
});
let disableHotReload = false;
const LOW_MEMORY_DEFAULT_MIN_FREE_GB = 4;

function isTruthyFlag(value) {
    return /^(1|true|yes|on)$/i.test((value || '').trim());
}

function getBundleOutfile(...segments) {
    return path.join(devBundleDir, ...segments);
}

function isHotReloadDisabled(env) {
    if (isTruthyFlag(env.BG_DEV_HOT_RELOAD)) {
        return false;
    }

    if (env.BG_DEV_DISABLE_HOT_RELOAD === '1') {
        return true;
    }

    if (/^(off|false|0)$/i.test(env.BG_DEV_HOT_RELOAD?.trim() || '')) {
        return true;
    }

    const threshold = Number(env.BG_DEV_AUTO_DISABLE_HOT_RELOAD_MIN_FREE_GB || LOW_MEMORY_DEFAULT_MIN_FREE_GB);
    if (process.platform === 'win32' && Number.isFinite(threshold) && threshold > 0) {
        const freeMemoryGb = os.freemem() / (1024 ** 3);
        if (freeMemoryGb < threshold) {
            console.warn(
                `[dev-orchestrator] free memory ${freeMemoryGb.toFixed(2)}GB < ${threshold}GB; auto-disabling hot reload for this run`,
            );
            return true;
        }
    }

    return false;
}

function createBundleRunnerArgs({ label, entry, outfile, tsconfig }) {
    const args = [
        'scripts/infra/dev-bundle-runner.mjs',
        '--label', label,
        '--entry', entry,
        '--outfile', outfile,
        '--tsconfig', tsconfig,
    ];

    if (disableHotReload) {
        args.push('--once', 'true');
    }

    return args;
}

function resolveConfiguredPort(value, fallback) {
    const port = Number(value);
    return Number.isFinite(port) && port > 0 ? port : fallback;
}

export async function resolveDevPortsFromEnv(env = process.env) {
    return {
        frontend: resolveConfiguredPort(env.VITE_DEV_PORT, DEFAULT_DEV_PORTS.frontend),
        gameServer: resolveConfiguredPort(env.GAME_SERVER_PORT, DEFAULT_DEV_PORTS.gameServer),
        apiServer: resolveConfiguredPort(env.API_SERVER_PORT, DEFAULT_DEV_PORTS.apiServer),
    };
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
    removeDevRuntimePorts();

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

async function resolveLocalDevMongoUri() {
    const explicitMongoUri = process.env.MONGO_URI?.trim();
    if (explicitMongoUri) {
        return explicitMongoUri;
    }

    if (devLiteMode || process.env.BG_DEV_SKIP_AUTO_MONGO === '1') {
        return null;
    }

    const mongoReachable = await probePort(27017, '127.0.0.1', 750);
    if (!mongoReachable) {
        return null;
    }

    return defaultLocalDevMongoUri;
}

function resolveGameDevEnv(mongoUri) {
    if (devLiteMode) {
        return { USE_PERSISTENT_STORAGE: 'false' };
    }

    if (mongoUri) {
        return { MONGO_URI: mongoUri };
    }

    return { USE_PERSISTENT_STORAGE: 'false' };
}

async function main() {
    disableHotReload = isHotReloadDisabled(process.env);
    removeDevRuntimePorts();
    const resolvedPorts = await resolveDevPortsFromEnv();
    const resolvedMongoUri = await resolveLocalDevMongoUri();
    saveDevRuntimePorts(resolvedPorts);
    const sharedDevEnv = {
        VITE_DEV_PORT: String(resolvedPorts.frontend),
        GAME_SERVER_PORT: String(resolvedPorts.gameServer),
        API_SERVER_PORT: String(resolvedPorts.apiServer),
        VITE_DEV_SKIP_API: skipApiMode ? 'true' : 'false',
        GAME_SERVER_PROXY_TARGET: `http://127.0.0.1:${resolvedPorts.gameServer}`,
        ...(resolvedMongoUri ? { MONGO_URI: resolvedMongoUri } : {}),
        ...(disableHotReload
            ? {
                PW_SERVER_WATCH: 'false',
                VITE_DISABLE_WATCH: 'true',
            }
            : {}),
    };

    console.log('[dev-orchestrator] resolved dev ports:', resolvedPorts);
    if (devLiteMode) {
        console.log('[dev-orchestrator] dev:lite mode enabled: game uses in-memory storage');
    }
    if (skipApiMode) {
        console.log('[dev-orchestrator] API startup is disabled for this run');
    } else if (resolvedMongoUri && !process.env.MONGO_URI) {
        console.log(`[dev-orchestrator] auto-detected local Mongo and injected MONGO_URI=${resolvedMongoUri}`);
    }
    if (disableHotReload) {
        console.log('[dev-orchestrator] hot reload disabled: game/api run once, Vite HMR/watch disabled');
    }
    console.log('[dev-orchestrator] starting api and game in parallel');
    const apiChild = skipApiMode
        ? null
        : startCommand('dev:api', process.execPath, createBundleRunnerArgs({
            label: 'api',
            entry: 'apps/api/src/main.ts',
            outfile: getBundleOutfile('api', 'main.mjs'),
            tsconfig: 'apps/api/tsconfig.json',
        }), sharedDevEnv, { optional: true });
    const gameExtraEnv = resolveGameDevEnv(resolvedMongoUri);
    startCommand('dev:game', process.execPath, createBundleRunnerArgs({
        label: 'game',
        entry: 'server.ts',
        outfile: getBundleOutfile('game', 'server.mjs'),
        tsconfig: 'tsconfig.server.json',
    }), {
        ...sharedDevEnv,
        ...gameExtraEnv,
    });

    console.log(`[dev-orchestrator] waiting for ports (timeout=${Math.floor(devStartupTimeoutMs / 1000)}s)`);

    const gamePort = resolvedPorts.gameServer;
    const apiPort = resolvedPorts.apiServer;

    await waitForPort(gamePort, 'game');

    let apiReady = false;
    if (!skipApiMode) {
        try {
            await waitForPort(apiPort, 'api', 15000);
            apiReady = true;
        } catch (error) {
            console.warn(`[dev-orchestrator] api 未在 15s 内就绪，降级为前端 + game 模式: ${error instanceof Error ? error.message : String(error)}`);
            if (apiChild && !apiChild.killed) {
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
    }

    console.log('[dev-orchestrator] starting frontend');
    startCommand('dev:frontend', process.execPath, ['scripts/infra/vite-with-logging.js'], sharedDevEnv);

    if (skipApiMode) {
        console.log('[dev-orchestrator] frontend 已启动；API 已按当前模式跳过');
        return;
    }

    if (!apiReady) {
        console.log('[dev-orchestrator] frontend 已启动；API 因本地数据库不可用被跳过');
        return;
    }

    console.log(`[dev-orchestrator] frontend: http://127.0.0.1:${resolvedPorts.frontend}`);
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    main().catch((error) => {
        console.error('[dev-orchestrator] startup failed:', error instanceof Error ? error.message : String(error));
        shutdown(1);
    });
}
