import 'dotenv/config';
import net from 'node:net';

const args = process.argv.slice(2);

// 前端只需要等 API 服务器就绪即可启动。
// 游戏服务器（18000）通过 Vite proxy 访问，启动慢时代理返回 502 不影响前端。
const defaultPorts = [Number(process.env.API_SERVER_PORT) || 18001];

const portsFromArgs = args.map((value) => Number(value)).filter((value) => Number.isFinite(value));
const ports = portsFromArgs.length > 0 ? portsFromArgs : defaultPorts;

const host = process.env.WAIT_PORT_HOST || '127.0.0.1';
const intervalMs = Number(process.env.WAIT_PORT_INTERVAL || 1000);
const probeTimeoutMs = Number(process.env.WAIT_PORT_PROBE_TIMEOUT || 1000);
const logIntervalMs = 15000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const probePort = (port) => new Promise((resolve) => {
    const socket = new net.Socket();
    const finalize = (result) => {
        socket.destroy();
        resolve(result);
    };

    socket.setTimeout(probeTimeoutMs);
    socket.once('connect', () => finalize(true));
    socket.once('error', () => finalize(false));
    socket.once('timeout', () => finalize(false));
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
