import { execSync } from 'node:child_process';

const defaultPorts = [5173, 18000, 18001];
const envPorts = process.env.CLEAN_PORTS
    ? process.env.CLEAN_PORTS.split(',').map((value) => Number(value.trim()))
    : [];
const ports = Array.from(new Set([...envPorts, ...defaultPorts])).filter((port) => Number.isFinite(port));

function killPids(pids, label) {
    for (const pid of pids) {
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } else {
                execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            }
            console.log(`已清理端口进程(${label}): ${pid}`);
        } catch {
            console.log(`清理端口进程失败(${label}): ${pid}`);
        }
    }
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
        const pid = parts[4];
        if (state !== 'LISTENING') {
            continue;
        }
        const lastColonIndex = localAddress.lastIndexOf(':');
        if (lastColonIndex === -1) {
            continue;
        }
        const portText = localAddress.slice(lastColonIndex + 1);
        const port = Number(portText);
        if (!portSet.has(port)) {
            continue;
        }
        const pids = result.get(port) || new Set();
        pids.add(pid);
        result.set(port, pids);
    }
    return result;
}

function cleanPorts() {
    if (ports.length === 0) {
        console.log('未配置需要清理的端口');
        return;
    }

    const portSet = new Set(ports);
    if (process.platform === 'win32') {
        const output = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
        const pidsByPort = collectWindowsPids(output, portSet);
        for (const port of ports) {
            const pids = pidsByPort.get(port);
            if (!pids || pids.size === 0) {
                continue;
            }
            killPids(pids, `端口 ${port}`);
        }
        return;
    }

    for (const port of ports) {
        try {
            const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
            if (!output) {
                continue;
            }
            const pids = new Set(output.split(/\s+/));
            killPids(pids, `端口 ${port}`);
        } catch {
            console.log(`查询端口失败: ${port}`);
        }
    }
}

cleanPorts();
