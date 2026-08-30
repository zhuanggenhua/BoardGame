import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

const activeServers: net.Server[] = [];

async function listenOnRandomPort() {
    const server = net.createServer();
    activeServers.push(server);

    const port = await new Promise<number>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                reject(new Error('无法获取监听端口'));
                return;
            }
            resolve(address.port);
        });
    });

    return { server, port };
}

async function getFreePort() {
    const { server, port } = await listenOnRandomPort();
    await new Promise<void>((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
    return port;
}

async function loadResolveDevPortsFromEnv() {
    vi.resetModules();
    const module = await import('../../../scripts/infra/dev-orchestrator.js');
    return module.resolveDevPortsFromEnv;
}

afterEach(async () => {
    await Promise.all(
        activeServers.splice(0).map((server) => new Promise<void>((resolve) => {
            if (!server.listening) {
                resolve();
                return;
            }
            server.close(() => resolve());
        })),
    );
});

describe('resolveDevPortsFromEnv', () => {
    it('在首选端口空闲时保持原端口', async () => {
        const resolveDevPortsFromEnv = await loadResolveDevPortsFromEnv();
        const preferredPorts = {
            frontend: await getFreePort(),
            gameServer: await getFreePort(),
            apiServer: await getFreePort(),
        };

        const resolved = await resolveDevPortsFromEnv({}, { preferredPorts });

        expect(resolved).toEqual(preferredPorts);
    });

    it('在默认端口被占用时自动切到空闲端口', async () => {
        const resolveDevPortsFromEnv = await loadResolveDevPortsFromEnv();
        const occupiedFrontend = await listenOnRandomPort();
        const occupiedGameServer = await listenOnRandomPort();
        const freeApiPort = await getFreePort();
        const preferredPorts = {
            frontend: occupiedFrontend.port,
            gameServer: occupiedGameServer.port,
            apiServer: freeApiPort,
        };

        const resolved = await resolveDevPortsFromEnv({}, { preferredPorts });

        expect(resolved.frontend).not.toBe(occupiedFrontend.port);
        expect(resolved.gameServer).not.toBe(occupiedGameServer.port);
        expect(resolved.apiServer).not.toBe(occupiedFrontend.port);
        expect(resolved.apiServer).not.toBe(occupiedGameServer.port);
        expect(resolved.apiServer).toBeGreaterThan(0);
        expect(new Set(Object.values(resolved)).size).toBe(3);
    });

    it('显式指定端口时保持用户端口不自动改写', async () => {
        const resolveDevPortsFromEnv = await loadResolveDevPortsFromEnv();
        const occupiedFrontend = await listenOnRandomPort();
        const preferredPorts = {
            frontend: occupiedFrontend.port,
            gameServer: await getFreePort(),
            apiServer: await getFreePort(),
        };

        const resolved = await resolveDevPortsFromEnv(
            { VITE_DEV_PORT: String(occupiedFrontend.port) },
            { preferredPorts },
        );

        expect(resolved.frontend).toBe(occupiedFrontend.port);
        expect(resolved.gameServer).toBe(preferredPorts.gameServer);
        expect(resolved.apiServer).toBe(preferredPorts.apiServer);
    });

    it('非固定端口入口将显式端口视为首选端口，冲突时自动切换', async () => {
        const resolveDevPortsFromEnv = await loadResolveDevPortsFromEnv();
        const occupiedFrontend = await listenOnRandomPort();
        const preferredPorts = {
            frontend: occupiedFrontend.port,
            gameServer: await getFreePort(),
            apiServer: await getFreePort(),
        };

        const resolved = await resolveDevPortsFromEnv(
            { VITE_DEV_PORT: String(occupiedFrontend.port) },
            { preferredPorts, respectExplicitPorts: false },
        );

        expect(resolved.frontend).not.toBe(occupiedFrontend.port);
        expect(resolved.frontend).toBeGreaterThan(0);
    });

    it('非固定端口入口即使继承严格端口环境变量，关闭尊重显式端口后仍能自动切换', async () => {
        const resolveDevPortsFromEnv = await loadResolveDevPortsFromEnv();
        const occupiedFrontend = await listenOnRandomPort();
        const preferredPorts = {
            frontend: occupiedFrontend.port,
            gameServer: await getFreePort(),
            apiServer: await getFreePort(),
        };

        const resolved = await resolveDevPortsFromEnv(
            { BG_DEV_STRICT_PORTS: '1', VITE_DEV_PORT: String(occupiedFrontend.port) },
            { preferredPorts, respectExplicitPorts: false },
        );

        expect(resolved.frontend).not.toBe(occupiedFrontend.port);
    });

    it('lite 入口固定使用首选端口，不因占用而递增', async () => {
        const resolveDevPortsFromEnv = await loadResolveDevPortsFromEnv();
        const occupiedFrontend = await listenOnRandomPort();
        const preferredPorts = {
            frontend: occupiedFrontend.port,
            gameServer: await getFreePort(),
            apiServer: await getFreePort(),
        };

        const resolved = await resolveDevPortsFromEnv(
            {},
            { preferredPorts, fixedPorts: true },
        );

        expect(resolved).toEqual(preferredPorts);
    });
});
