import { fork, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { withWindowsHide } from './windows-hide.js';

const probeChildPath = fileURLToPath(new URL('./noop-child-process-probe.mjs', import.meta.url));

function formatReason(reason) {
    return typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : '当前命令';
}

function normalizeError(error, stage) {
    if (error instanceof Error) {
        return {
            stage,
            error,
        };
    }

    return {
        stage,
        error: new Error(String(error)),
    };
}

function probeSpawnSupport() {
    try {
        const result = spawnSync(process.execPath, ['-e', 'process.exit(0)'], withWindowsHide({
            stdio: 'ignore',
        }));

        if (result.error) {
            return { ok: false, ...normalizeError(result.error, 'spawn') };
        }

        if (typeof result.status === 'number' && result.status !== 0) {
            return {
                ok: false,
                ...normalizeError(new Error(`child process probe exited with status ${result.status}`), 'spawn'),
            };
        }

        return { ok: true, stage: 'spawn', error: null };
    } catch (error) {
        return { ok: false, ...normalizeError(error, 'spawn') };
    }
}

async function probeForkSupport() {
    return await new Promise((resolve) => {
        try {
            const child = fork(probeChildPath, [], withWindowsHide({ silent: true }));
            let settled = false;
            const finish = (result) => {
                if (settled) {
                    return;
                }
                settled = true;
                resolve(result);
            };

            child.once('error', (error) => {
                finish({ ok: false, ...normalizeError(error, 'fork') });
            });

            child.once('exit', (code) => {
                if (typeof code === 'number' && code !== 0) {
                    finish({
                        ok: false,
                        ...normalizeError(new Error(`fork probe exited with status ${code}`), 'fork'),
                    });
                    return;
                }

                finish({ ok: true, stage: 'fork', error: null });
            });

            setTimeout(() => {
                finish({
                    ok: false,
                    ...normalizeError(new Error('fork probe timed out after 1500ms'), 'fork'),
                });
            }, 1500);
        } catch (error) {
            resolve({ ok: false, ...normalizeError(error, 'fork') });
        }
    });
}

async function probeEsbuildSupport() {
    try {
        const { context } = await import('esbuild');
        const ctx = await context({
            entryPoints: [probeChildPath],
            bundle: true,
            write: false,
            platform: 'node',
            format: 'esm',
            logLevel: 'silent',
        });
        await ctx.dispose();
        return { ok: true, stage: 'esbuild', error: null };
    } catch (error) {
        return { ok: false, ...normalizeError(error, 'esbuild') };
    }
}

export async function checkChildProcessSupport(options = {}) {
    const {
        probeFork = false,
        probeEsbuild = false,
    } = options;

    const spawnProbe = probeSpawnSupport();
    if (!spawnProbe.ok) {
        return spawnProbe;
    }

    if (probeFork) {
        const forkProbe = await probeForkSupport();
        if (!forkProbe.ok) {
            return forkProbe;
        }
    }

    if (probeEsbuild) {
        const esbuildProbe = await probeEsbuildSupport();
        if (!esbuildProbe.ok) {
            return esbuildProbe;
        }
    }

    return { ok: true, stage: 'ready', error: null };
}

export function printChildProcessSupportError(reason, stage, error) {
    const normalizedReason = formatReason(reason);
    const code = (error && typeof error === 'object' && 'code' in error) ? String(error.code) : 'UNKNOWN';
    const syscall = (error && typeof error === 'object' && 'syscall' in error) ? String(error.syscall) : 'unknown';
    const message = error instanceof Error ? error.message : String(error);

    console.error('❌ 当前运行环境不允许测试基建所需的 Node 子进程能力。');
    console.error(`   场景: ${normalizedReason}`);
    console.error(`   失败阶段: ${stage}`);
    console.error(`   错误: ${code} (${syscall})`);
    console.error(`   详情: ${message}`);
    console.error('');
    console.error('   这会直接阻塞以下链路:');
    console.error('   - Playwright worker (fork)');
    console.error('   - Vitest / E2E bundle-runner (esbuild service)');
    console.error('   - E2E 三服务启动与端口清理');
    console.error('');
    console.error('   处理方式:');
    console.error('   - 改在本地终端、CI Runner 或允许 child_process 的环境执行');
    console.error('   - 如果只是当前沙箱受限，不要继续重试同一条测试命令');
}

export async function assertChildProcessSupport(reason = '当前命令', options = {}) {
    // Codex 的 Windows 受管环境里，这层预检会稳定误报；以实际 spawn 结果为准。
    const isCodexManagedWindows = process.platform === 'win32'
        && (
            process.env.CODEX_MANAGED_BY_NPM === '1'
            || typeof process.env.CODEX_THREAD_ID === 'string'
        );

    if (isCodexManagedWindows) {
        return;
    }

    const probe = await checkChildProcessSupport(options);
    if (probe.ok) {
        return;
    }

    printChildProcessSupportError(reason, probe.stage, probe.error);
    process.exit(1);
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    await assertChildProcessSupport(process.argv[2] || '当前命令', {
        probeFork: process.argv.includes('--probe-fork'),
        probeEsbuild: process.argv.includes('--probe-esbuild'),
    });
}
