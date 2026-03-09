import 'dotenv/config';
import net from 'node:net';

const args = process.argv.slice(2);

// 前端需要等游戏服务器和 API 服务器都就绪后再启动，
// 避免 Vite 代理 WebSocket 连接到未就绪的游戏服务器时报 ECONNABORTED。
const defaultPorts = [
    Number(process.env.GAME_SERVER_PORT) || 18000,
    Number(process.env.API_SERVER_PORT) || 18001,
];

const portsFromArgs = args.map((value) => Number(value)).filter((value) => Number.isFinite(value));
const ports = portsFromArgs.length > 0 ? portsFromArgs : defaultPorts;

const host = process.env.WAIT_PORT_HOST || '127.0.0.1';
const intervalMs = Number(process.env.WAIT_PORT_INTERVAL || 1000);
const probeTimeoutMs = Number(process.env.WAIT_PORT_PROBE_TIMEOUT || 3000); // 增加到 3 秒
const logIntervalMs = 15000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probePort = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    
    const finalize = (result, reason) => {
        if (resolved) return;
        resolved = true;
        socket.destroy();
        if (!result && process.env.DEBUG_WAIT_PORTS) {
            console.log(`[wait_for_ports] ${host}:${port} probe failed: ${reason}`);
        }
        resolve(result);
    };

    socket.setTimeout(probeTimeoutMs);
    socket.once('connect', () => finalize(true, 'connected'));
    socket.once('error', (err) => finalize(false, `error: ${err.code || err.message}`));
    socket.once('timeout', () => finalize(false, 'timeout'));
    socket.connect(port, host);
});

const run = async () => {
    if (ports.length === 0) {
        return;
    }

    const pending = new Set(ports);
    const start = Date.now();
    let lastLog = 0;

    while (pending.size > 0) {
        for (const port of [...pending]) {
            const ok = await probePort(port);
            if (ok) {
                const elapsed = ((Date.now() - start) / 1000).toFixed(1);
                console.log(`[wait_for_ports] ${host}:${port} ready (${elapsed}s)`);
                pending.delete(port);
            }
        }

        if (pending.size > 0) {
            const now = Date.now();
            if (now - lastLog >= logIntervalMs) {
                const elapsed = ((now - start) / 1000).toFixed(0);
                const remaining = [...pending].join(', ');
                console.log(`[wait_for_ports] waiting ${elapsed}s... pending: ${remaining}`);
                lastLog = now;
            }
            await sleep(intervalMs);
        }
    }

    const total = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[wait_for_ports] all ports ready in ${total}s`);
};

run().catch((error) => {
    console.error('[wait_for_ports] failed:', error.message || error);
    process.exit(1);
});
