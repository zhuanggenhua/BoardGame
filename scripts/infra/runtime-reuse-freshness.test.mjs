import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { test } from 'node:test';
import { ensureSingleWorkerRuntime } from './e2e-runtime-manager.mjs';
import { captureSourceIdentity, getFrontendSourceHash } from './e2e-source-identity.mjs';
import { upsertRuntime, removeRuntimeById, findRuntimeById } from './e2e-runtime-registry.js';

test('健康服务可温复用；源码改变且消费者存活时保留原服务并拒绝旧规则', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-reuse-freshness-'));
    execFileSync('git', ['init', '--quiet'], { cwd, windowsHide: true });
    const originalCwd = process.cwd();
    const server = http.createServer((request, response) => response.end('healthy'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    try {
        process.chdir(cwd);
        fs.writeFileSync('domain.ts', 'version-one');
        upsertRuntime({
            scope: 'shared-single', mode: 'shared-single', serverRuntime: 'bundle',
            ownerPids: [process.pid], consumerPids: [process.pid],
            ports: { frontend: port, gameServer: port, apiServer: port },
            sourceIdentity: captureSourceIdentity(['domain.ts']), health: { ready: true },
            frontendSourceHash: getFrontendSourceHash(),
        });
        const first = await ensureSingleWorkerRuntime({ preferSharedSingleRun: true, logger: { log() {} } });
        assert.equal(first.reused, true);
        assert.equal(first.runtime.ports.frontend, port);
        removeRuntimeById(first.runtime.runtimeId, cwd, { ownerPid: process.pid + 1000000 });
        assert.ok(findRuntimeById(first.runtime.runtimeId), '迟到的旧 owner 清理不能删除新一代登记');
        fs.writeFileSync('domain.ts', 'version-two');
        await assert.rejects(ensureSingleWorkerRuntime({ preferSharedSingleRun: true }), /源码身份要求/);
        assert.equal(server.listening, true, '不得因新测试要新规则而中断现有消费者');
        assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
    } finally {
        process.chdir(originalCwd);
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
        fs.rmSync(cwd, { recursive: true, force: true });
    }
});
