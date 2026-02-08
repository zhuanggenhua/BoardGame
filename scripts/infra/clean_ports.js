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
const ports = Array.from(new Set([...envPorts, ...configPorts, ...defaultPorts])).filter((port) => Number.isFinite(port));

function killPids(pids, label) {
    for (const pid of pids) {
        try {
            if (process.platform === 'win32') {
                execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
            } else {
                execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
            }
            console.log(`已清理端口进程(${label}): PID ${pid}`);
        } catch (err) {
            // 进程可能已经退出，忽略错误
            console.log(`清理端口进程(${label}): PID ${pid} - 已退出或无权限`);
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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

async function cleanPorts() {
    if (ports.length === 0) {
        console.log('未配置需要清理的端口');
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
        
        // 等待端口释放
        if (killedAny) {
            console.log('等待端口释放...');
            await sleep(500);
        }
        return;
    }

    for (const port of ports) {
        try {
            const output = execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' }).trim();
            if (!output) {
                continue;
            }
            killedAny = true;
            const pids = new Set(output.split(/\s+/));
            killPids(pids, `端口 ${port}`);
        } catch {
            // lsof 没找到进程时会返回非零退出码，这是正常的
        }
    }
    
    // 等待端口释放
    if (killedAny) {
        console.log('等待端口释放...');
        await sleep(500);
    }
}

cleanPorts();
