import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { build as nativeBuild, context as nativeContext } from 'esbuild';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import { resolveWorkspaceNodeModuleFile } from './node-module-resolver.mjs';
import { withWindowsHide } from './windows-hide.js';

await assertChildProcessSupport('bundle-runner / esbuild watch', { probeEsbuild: true });

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));

const label = args.label || 'bundle-runner';
const entry = requireArg(args, 'entry');
const outfile = requireArg(args, 'outfile');
const tsconfig = requireArg(args, 'tsconfig');
const onceMode = args.once === 'true';
const absOutfile = path.resolve(repoRoot, outfile);

let currentBuildStartedAt = 0;
let child = null;
let shuttingDown = false;
let buildVersion = 0;
let restartQueue = Promise.resolve();
let wasmEsbuildPromise = null;

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const value = argv[index + 1];
        parsed[key] = value;
        index += 1;
    }
    return parsed;
}

function requireArg(parsed, key) {
    const value = parsed[key];
    if (!value) {
        throw new Error(`missing required arg --${key}`);
    }
    return value;
}

function prefixOutput(prefix, stream, target) {
    let buffer = '';
    stream.on('data', (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            target.write(`[${prefix}] ${line}\n`);
        }
    });
    stream.on('end', () => {
        if (buffer.length > 0) {
            target.write(`[${prefix}] ${buffer}\n`);
            buffer = '';
        }
    });
}

function collectErrorMessages(error) {
    if (!error) {
        return [];
    }

    const messages = [];
    if (error instanceof Error && error.message) {
        messages.push(error.message);
    }

    if (typeof error === 'object' && error && 'errors' in error && Array.isArray(error.errors)) {
        for (const nested of error.errors) {
            if (nested && typeof nested === 'object' && 'text' in nested && typeof nested.text === 'string') {
                messages.push(nested.text);
            }
        }
    }

    return messages;
}

function isSpawnEpermError(error) {
    const messages = collectErrorMessages(error);
    return messages.some((message) => message.includes('spawn EPERM'));
}

async function loadWasmEsbuild() {
    if (!wasmEsbuildPromise) {
        wasmEsbuildPromise = (async () => {
            const wasm = await import('esbuild-wasm');
            const wasmPath = resolveWorkspaceNodeModuleFile('esbuild-wasm/esbuild.wasm', {
                label: 'esbuild-wasm',
                cwd: repoRoot,
            }).filePath;
            await wasm.initialize({
                wasmURL: pathToFileURL(wasmPath).href,
                worker: false,
            });
            return wasm;
        })();
    }

    return wasmEsbuildPromise;
}

async function buildWithFallback(options) {
    try {
        return await nativeBuild(options);
    } catch (error) {
        const allowWasmFallback = process.env.BG_ESBUILD_WASM_FALLBACK !== 'false';
        if (!allowWasmFallback || !isSpawnEpermError(error)) {
            throw error;
        }

        console.warn(`[bundle-runner] ${label} native esbuild unavailable (spawn EPERM), fallback to esbuild-wasm`);
        const wasmEsbuild = await loadWasmEsbuild();
        return wasmEsbuild.build(options);
    }
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isProcessAlive(pid) {
    if (!pid || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

async function waitForProcessTermination(proc, timeoutMs) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
        if (!proc || proc.exitCode !== null || !isProcessAlive(proc.pid)) {
            return true;
        }
        await wait(100);
    }

    return !proc || proc.exitCode !== null || !isProcessAlive(proc.pid);
}

async function stopChildProcess(proc) {
    if (!proc || proc.killed || proc.exitCode !== null) {
        return;
    }

    try {
        if (process.platform === 'win32') {
            await new Promise((resolve, reject) => {
                const killer = spawn('taskkill', ['/F', '/T', '/PID', String(proc.pid)], withWindowsHide({
                    stdio: 'ignore',
                }));
                killer.once('error', reject);
                killer.once('exit', () => resolve());
            });

            // Windows 上 taskkill 返回不代表子进程已完全退出，端口也可能还没释放。
            await waitForProcessTermination(proc, 5000);
            await wait(200);
            return;
        }

        proc.kill('SIGTERM');
        const terminated = await waitForProcessTermination(proc, 1000);
        if (!terminated && proc.exitCode === null) {
            proc.kill('SIGKILL');
            await waitForProcessTermination(proc, 3000);
        }
    } catch {
    }
}

async function restartRuntime(reason) {
    if (child) {
        const previous = child;
        child = null;
        await stopChildProcess(previous);
    }

    if (shuttingDown) {
        return;
    }

    console.log(`[bundle-runner] ${label} ${reason} -> starting ${outfile}`);
    child = spawn(process.execPath, ['--enable-source-maps', absOutfile], withWindowsHide({
        cwd: repoRoot,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
    }));
    prefixOutput(`${label}:runtime`, child.stdout, process.stdout);
    prefixOutput(`${label}:runtime`, child.stderr, process.stderr);
    child.on('exit', (code, signal) => {
        if (shuttingDown) {
            return;
        }
        const detail = signal ? `signal=${signal}` : `code=${code ?? 0}`;
        console.error(`[bundle-runner] ${label} runtime exited (${detail})`);
        child = null;
        if (onceMode) {
            process.exit(code ?? 1);
        }
    });
}

function queueRestart(reason) {
    restartQueue = restartQueue.then(() => restartRuntime(reason)).catch((error) => {
        console.error(`[bundle-runner] ${label} restart failed:`, error instanceof Error ? error.message : String(error));
    });
    return restartQueue;
}

async function shutdown(code = 0, buildContext = null) {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    if (buildContext) {
        try {
            await buildContext.dispose();
        } catch {
        }
    }
    if (child) {
        const previous = child;
        child = null;
        await stopChildProcess(previous);
    }
    process.exit(code);
}

const rebuildPlugin = {
    name: 'restart-runtime-on-build',
    setup(build) {
        build.onStart(() => {
            currentBuildStartedAt = Date.now();
            console.log(`[bundle-runner] ${label} building ${entry}`);
        });

        build.onEnd(async (result) => {
            const durationMs = Date.now() - currentBuildStartedAt;
            if (result.errors.length > 0) {
                console.error(`[bundle-runner] ${label} build failed (${result.errors.length} errors, ${durationMs}ms); keeping previous runtime`);
                return;
            }

            buildVersion += 1;
            const action = buildVersion === 1 ? 'initial build ready' : 'rebuilt';
            console.log(`[bundle-runner] ${label} ${action} in ${durationMs}ms`);
            await queueRestart(buildVersion === 1 ? 'ready' : 'reloaded');
        });
    },
};

const sharedBuildOptions = {
    absWorkingDir: repoRoot,
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    sourcemap: true,
    logLevel: 'info',
    tsconfig,
};

if (onceMode) {
    process.on('SIGINT', () => {
        void shutdown(0, null);
    });
    process.on('SIGTERM', () => {
        void shutdown(0, null);
    });

    currentBuildStartedAt = Date.now();
    console.log(`[bundle-runner] ${label} building ${entry}`);
    try {
        await buildWithFallback(sharedBuildOptions);
        console.log(`[bundle-runner] ${label} initial build ready in ${Date.now() - currentBuildStartedAt}ms`);
        await restartRuntime('ready');
    } catch (error) {
        console.error(`[bundle-runner] ${label} build failed:`, error instanceof Error ? error.message : String(error));
        await shutdown(1, null);
    }

    await new Promise(() => {});
}

const buildContext = await nativeContext({
    ...sharedBuildOptions,
    plugins: [rebuildPlugin],
});

process.on('SIGINT', () => {
    void shutdown(0, buildContext);
});
process.on('SIGTERM', () => {
    void shutdown(0, buildContext);
});

try {
    await buildContext.watch();
} catch (error) {
    console.error(`[bundle-runner] ${label} watch failed:`, error instanceof Error ? error.message : String(error));
    await shutdown(1, buildContext);
}
