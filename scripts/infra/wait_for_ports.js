import 'dotenv/config';
import net from 'node:net';

const args = process.argv.slice(2);
const defaultPorts = [18000, 18001];
const envPorts = [
    process.env.GAME_SERVER_PORT,
    process.env.API_SERVER_PORT,
].map((value) => Number(value)).filter((value) => Number.isFinite(value));
const portsFromArgs = args.map((value) => Number(value)).filter((value) => Number.isFinite(value));
const ports = portsFromArgs.length > 0
    ? portsFromArgs
    : Array.from(new Set([...envPorts, ...defaultPorts]));

const host = process.env.WAIT_PORT_HOST || '127.0.0.1';
const timeoutMs = Number(process.env.WAIT_PORT_TIMEOUT || 60000);
const intervalMs = Number(process.env.WAIT_PORT_INTERVAL || 500);
const probeTimeoutMs = Number(process.env.WAIT_PORT_PROBE_TIMEOUT || 1000);

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

const waitForPort = async (port) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const ok = await probePort(port);
        if (ok) {
            return;
        }
        await sleep(intervalMs);
    }
    throw new Error(`Timeout waiting for ${host}:${port}`);
};

const run = async () => {
    if (ports.length === 0) {
        return;
    }
    for (const port of ports) {
        await waitForPort(port);
    }
};

run().catch((error) => {
    console.error('[wait_for_ports] failed:', error.message || error);
    process.exit(1);
});
