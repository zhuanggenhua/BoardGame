import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ports = {
    frontend: 4273,
    gameServer: 18000,
    apiServer: 18001,
};

describe('dev-port-runtime', () => {
    let tempDir = '';
    let runtimeFile = '';

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boardgame-dev-runtime-'));
        runtimeFile = path.join(tempDir, 'runtime.json');
        vi.stubEnv('BG_DEV_RUNTIME_PORTS_FILE', runtimeFile);
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('从同一组端口生成前端、游戏服务和 API 的完整运行时环境', async () => {
        const { createDevRuntimeEnv } = await import('../../../scripts/infra/dev-port-runtime.js');

        expect(createDevRuntimeEnv(ports, { NODE_ENV: 'test' })).toMatchObject({
            NODE_ENV: 'test',
            VITE_DEV_PORT: '4273',
            GAME_SERVER_PORT: '18000',
            API_SERVER_PORT: '18001',
            GAME_SERVER_PROXY_TARGET: 'http://127.0.0.1:18000',
            API_SERVER_PROXY_TARGET: 'http://127.0.0.1:18001',
        });
    });

    it('默认忽略已退出持有者留下的旧端口记录', async () => {
        fs.writeFileSync(runtimeFile, JSON.stringify({
            ports,
            ownerPid: 0,
            updatedAt: new Date().toISOString(),
        }));
        const { loadDevRuntimePorts } = await import('../../../scripts/infra/dev-port-runtime.js');

        expect(loadDevRuntimePorts()).toBeNull();
        expect(loadDevRuntimePorts({ requireLiveOwner: false })).toEqual(ports);
    });

    it('当前编排器仍持有运行时记录时可以读取同一组端口', async () => {
        fs.writeFileSync(runtimeFile, JSON.stringify({
            ports,
            ownerPid: process.pid,
            updatedAt: new Date().toISOString(),
        }));
        const { loadDevRuntimePorts } = await import('../../../scripts/infra/dev-port-runtime.js');

        expect(loadDevRuntimePorts()).toEqual(ports);
    });
});
