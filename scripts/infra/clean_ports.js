import 'dotenv/config';
import { execSync } from 'node:child_process';

const defaultPorts = [5173, 18000, 18001];
const envPorts = process.env.CLEAN_PORTS
    ? process.env.CLEAN_PORTS.split(',').map((value) => Number(value.trim()))
    : [];
const configPorts = [
    process.env.VITE_DEV_PORT,
    process.env.GAME_SERVER_PORT,
    process.env.API_SERVER_PORT,
].map((value) => Number(value));
const ports = Array.from(new Set([...envPorts, ...configPorts, ...defaultPorts]))
    .filter((port) => Number.isFinite(port));
const repoPath = process.cwd().replace(/\\/g, '/').toLowerCase();
const devProcessMatchers = [
    'concurrently.js',
    'nodemon.js',
    'node_modules/tsx/dist/cli.mjs',
    'node_modules/vite/bin/vite.js',
    'vite-with-logging.js',
    'wait_for_ports.js',
    'apps/api/src/main.ts',
    'server.ts',
];

function killPids(pids, label, { tree = false } = {}) {
    for (const rawPid of pids) {
        const pid = Number(rawPid);
        if (!Number.isFinite(pid) || pid <= 0 || pid === process.pid) {
            continue;
        }

        try {
            if (process.platform === 'win32') {
                const treeFlag = tree ? '/T ' : '';
                execSync(`taskkill /F ${treeFlag}/PID ${pid}`, { stdio: 'pipe' });
            } else {
                if (tree) {
                    try {
                        execSync(`pkill -TERM -P ${pid}`, { stdio: 'pipe' });
                    } catch {
                    }
                }
                execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
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

function isRepoDevProcess(commandLine = '') {
    if (typeof commandLine !== 'string' || commandLine.length === 0) {
        return false;
    }

    const normalizedCommandLine = commandLine.replace(/\\/g, '/').toLowerCase();
    return normalizedCommandLine.includes(repoPath)
        && devProcessMatchers.some((matcher) => normalizedCommandLine.includes(matcher));
}

function collectResidualDevProcessPids() {
    if (process.platform === 'win32') {
        const output = execSync(
            'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress"',
            { encoding: 'utf8' }
        ).trim();

        if (!output) {
            return [];
        }

        const parsed = JSON.parse(output);
        const entries = Array.isArray(parsed) ? parsed : [parsed];
        return entries
            .filter((entry) => Number(entry?.ProcessId) !== process.pid && isRepoDevProcess(entry?.CommandLine))
            .map((entry) => Number(entry.ProcessId))
            .filter((pid) => Number.isFinite(pid) && pid > 0);
    }

    const output = execSync('ps -axo pid=,command=', { encoding: 'utf8' });
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
        if (pid === process.pid || !isRepoDevProcess(commandLine)) {
            continue;
        }

        pids.push(pid);
    }

    return pids;
}

function cleanResidualDevProcesses() {
    const pids = Array.from(new Set(collectResidualDevProcessPids()));
    if (pids.length === 0) {
        return;
    }

    killPids(pids, '开发启动器', { tree: true });
}

async function cleanPorts() {
    if (ports.length === 0) {
        console.log('未配置需要清理的端口');
        cleanResidualDevProcesses();
        return;
    }

    const portSet = new Set(ports);
    let killedAny = false;

    if (process.platform === 'win32') {
        const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
        const pidsByPort = collectWindowsPids(output, portSet);

        for (const port of ports) {
            const pids = pidsByPort.get(port);
            if (!pids || pids.size === 0) {
                continue;
            }

            killedAny = true;
            killPids(pids, `端口 ${port}`);
        }
    } else {
        for (const port of ports) {
            try {
                const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
                if (!output) {
                    continue;
                }

                killedAny = true;
                const pids = new Set(output.split(/\s+/).map((value) => Number(value)));
                killPids(pids, `端口 ${port}`);
            } catch {
            }
        }
    }

    if (killedAny) {
        console.log('等待端口释放...');
        await sleep(500);
    }

    cleanResidualDevProcesses();
}

cleanPorts().catch((error) => {
    console.error('清理端口失败', error);
    process.exit(1);
});
