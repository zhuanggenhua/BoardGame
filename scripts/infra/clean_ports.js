import 'dotenv/config';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeDevRuntimePorts } from './dev-port-runtime.js';
import { cleanupPorts as cleanupBoundPorts } from './port-allocator.js';
import { waitForPortsFree } from './port-allocator.js';
import { withWindowsHide } from './windows-hide.js';

// 开发默认只清当前开发链路端口，避免把共享 E2E 端口 5173 误当成“本地开发残留”。
export const DEFAULT_DEV_PORTS = [4273, 4173, 18000, 18001];

// 只有显式进入激进模式时，才允许按命令行特征扫描并终止整棵进程树。
export const DEV_PROCESS_MATCHERS = [
    'concurrently.js',
    'nodemon.js',
    'node_modules/tsx/dist/cli.mjs',
    'node_modules/vite/bin/vite.js',
    'vite-with-logging.js',
    'wait_for_ports.js',
    'apps/api/src/main.ts',
    'server.ts',
];

function parsePorts(value) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        return [];
    }

    return value
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((port) => Number.isFinite(port));
}

export function resolveCleanPortsConfig({
    env = process.env,
    args = [],
    cwd = process.cwd(),
} = {}) {
    const envPorts = parsePorts(env.CLEAN_PORTS);
    const configPorts = [
        env.VITE_DEV_PORT,
        env.GAME_SERVER_PORT,
        env.API_SERVER_PORT,
    ]
        .map((value) => Number(value))
        .filter((port) => Number.isFinite(port));
    const ports = Array.from(new Set([...envPorts, ...configPorts, ...DEFAULT_DEV_PORTS]));

    return {
        ports,
        cwd,
        strictPortCleanup: env.DEV_STRICT_PORT_CLEANUP === 'true',
        // 默认不开启进程树扫描，避免误杀其他 AI / worktree / 共享 runtime。
        aggressiveProcessCleanup: args.includes('--aggressive') || env.DEV_CLEAN_ALLOW_PROCESS_SWEEP === '1',
    };
}

function execHidden(command, options = {}) {
    return execSync(command, withWindowsHide(options));
}

function killPids(pids, label, { tree = false } = {}) {
    for (const rawPid of pids) {
        const pid = Number(rawPid);
        if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
            continue;
        }

        try {
            if (process.platform === 'win32') {
                const treeFlag = tree ? '/T ' : '';
                execHidden(`taskkill /F ${treeFlag}/PID ${pid}`, { stdio: 'pipe' });
            } else {
                if (tree) {
                    try {
                        execHidden(`pkill -TERM -P ${pid}`, { stdio: 'pipe' });
                    } catch {
                    }
                }
                execHidden(`kill -9 ${pid}`, { stdio: 'pipe' });
            }
            console.log(`已清理进程(${label}): PID ${pid}`);
        } catch {
            console.log(`清理进程(${label}): PID ${pid} - 已退出或无权限`);
        }
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectWindowsPids(output, portSet) {
    const result = new Map();

    for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('TCP')) {
            continue;
        }

        const parts = trimmed.split(/\s+/);
        if (parts.length < 5) {
            continue;
        }

        const localAddress = parts[1];
        const state = parts[3];
        const pid = Number(parts[4]);
        if (state !== 'LISTENING' || !Number.isFinite(pid) || pid <= 0) {
            continue;
        }

        const lastColonIndex = localAddress.lastIndexOf(':');
        if (lastColonIndex === -1) {
            continue;
        }

        const port = Number(localAddress.slice(lastColonIndex + 1));
        if (!portSet.has(port)) {
            continue;
        }

        const pids = result.get(port) || new Set();
        pids.add(pid);
        result.set(port, pids);
    }

    return result;
}

export function isRepoDevProcess(commandLine = '', {
    cwd = process.cwd(),
    matchers = DEV_PROCESS_MATCHERS,
} = {}) {
    if (typeof commandLine !== 'string' || commandLine.length === 0) {
        return false;
    }

    const repoPath = cwd.replace(/\\/g, '/').toLowerCase();
    const normalizedCommandLine = commandLine.replace(/\\/g, '/').toLowerCase();
    return normalizedCommandLine.includes(repoPath)
        && matchers.some((matcher) => normalizedCommandLine.includes(matcher));
}

function collectResidualDevProcessPids({
    cwd = process.cwd(),
    matchers = DEV_PROCESS_MATCHERS,
} = {}) {
    if (process.platform === 'win32') {
        try {
            const output = execHidden(
                'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
                { encoding: 'utf8' }
            ).trim();

            if (!output) {
                return [];
            }

            const parsed = JSON.parse(output);
            const entries = Array.isArray(parsed) ? parsed : [parsed];
            return entries
                .filter((entry) => Number(entry?.ProcessId) !== process.pid
                    && isRepoDevProcess(entry?.CommandLine, { cwd, matchers }))
                .map((entry) => Number(entry.ProcessId))
                .filter((pid) => Number.isFinite(pid) && pid > 0);
        } catch {
            return [];
        }
    }

    let output = '';
    try {
        output = execHidden('ps -axo pid=,command=', { encoding: 'utf8' });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[Dev] 跳过残留进程扫描：无法执行 ps (${message})`);
        return [];
    }
    const pids = [];

    for (const line of output.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }

        const match = trimmed.match(/^(\d+)\s+(.*)$/);
        if (!match) {
            continue;
        }

        const pid = Number(match[1]);
        const commandLine = match[2];
        if (pid === process.pid || !isRepoDevProcess(commandLine, { cwd, matchers })) {
            continue;
        }

        pids.push(pid);
    }

    return pids;
}

function cleanResidualDevProcesses({
    aggressiveProcessCleanup = false,
    cwd = process.cwd(),
    matchers = DEV_PROCESS_MATCHERS,
} = {}) {
    if (!aggressiveProcessCleanup) {
        return;
    }

    const pids = Array.from(new Set(collectResidualDevProcessPids({ cwd, matchers })));
    if (pids.length === 0) {
        return;
    }

    killPids(pids, '开发启动器', { tree: true });
}

export async function cleanPorts(options = {}) {
    const config = resolveCleanPortsConfig(options);
    const { assertChildProcessSupport } = await import('./assert-child-process-support.mjs');
    await assertChildProcessSupport('开发端口清理');
    removeDevRuntimePorts();

    if (config.ports.length === 0) {
        console.log('未配置需要清理的端口');
        cleanResidualDevProcesses(config);
        return;
    }

    cleanupBoundPorts(config.ports, 'Dev');
    console.log('等待端口释放...');
    await sleep(500);

    cleanResidualDevProcesses(config);

    const portsFreed = await waitForPortsFree(config.ports, 1500);
    if (!portsFreed && config.strictPortCleanup) {
        throw new Error(`以下端口仍被占用且当前进程无权清理: ${config.ports.join(', ')}。请先手动结束占用进程后再启动。`);
    }
    if (!portsFreed) {
        console.warn(`[Dev] 以下端口仍可能被占用，继续启动并交由后续启动流程自行报错: ${config.ports.join(', ')}`);
    }
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    cleanPorts({ args: process.argv.slice(2) }).catch((error) => {
        console.error('清理端口失败', error);
        process.exit(1);
    });
}
