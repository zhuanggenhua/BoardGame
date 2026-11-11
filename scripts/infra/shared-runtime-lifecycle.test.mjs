import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { getSharedRegistryFilePath } from './e2e-runtime-registry.js';

const manager = new URL('./e2e-runtime-manager.mjs', import.meta.url).href;
const registry = new URL('./e2e-runtime-registry.js', import.meta.url).href;

test('存活进程持有的旧注册锁不会被并发启动者删除', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-lock-test-'));
    execFileSync('git', ['init', '--quiet'], { cwd, windowsHide: true });
    const lockPath = `${getSharedRegistryFilePath(cwd)}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: '2000-01-01T00:00:00.000Z' }));
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        const { acquireSharedRegistryLock } = await import(${JSON.stringify(registry)});
        console.log('WAITING');
        const release = acquireSharedRegistryLock(process.cwd());
        console.log('ACQUIRED');
        release();
    `], { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = new Promise(resolve => child.once('exit', resolve));
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    try {
        const deadline = Date.now() + 10000;
        while (!output.includes('WAITING')) {
            if (Date.now() > deadline || child.exitCode !== null) throw new Error(`启动等待进程失败: ${output}`);
            await new Promise(resolve => setTimeout(resolve, 25));
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        assert.equal(output.includes('ACQUIRED'), false, '持锁进程仍存活时不能删除锁');
        fs.unlinkSync(lockPath);
        while (!output.includes('ACQUIRED')) {
            if (Date.now() > deadline || child.exitCode !== null) throw new Error(`释放后未取得锁: ${output}`);
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    } finally {
        if (child.exitCode === null) child.kill();
        await exited;
        fs.rmSync(cwd, { recursive: true, force: true });
    }
});

test('发起测试结束后共享服务 owner 继续存活，后续清理不得将其当孤儿', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-owner-test-'));
    execFileSync('git', ['init', '--quiet'], { cwd, windowsHide: true });
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        const { holdRuntimeOwner } = await import(${JSON.stringify(manager)});
        const { upsertRuntime } = await import(${JSON.stringify(registry)});
        upsertRuntime({ scope: 'shared-single', mode: 'shared-single', ownerPids: [process.pid], health: { ready: true } });
        const failurePromise = new Promise(() => {});
        setInterval(() => {}, 1000);
        process.stdin.once('end', () => console.log('DETACHED'));
        console.log('READY');
        await holdRuntimeOwner({ runtime: { mode: 'shared-single' }, controller: { failurePromise } });
    `], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const exited = new Promise(resolve => child.once('exit', resolve));
    let stdout = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    const waitText = async value => {
        const deadline = Date.now() + 10000;
        while (!stdout.includes(value)) {
            if (Date.now() > deadline || child.exitCode !== null) throw new Error(`等待 ${value} 失败: ${stdout}`);
            await new Promise(resolve => setTimeout(resolve, 25));
        }
    };
    try {
        await waitText('READY');
        child.stdin.end();
        await waitText('DETACHED');
        const result = execFileSync(process.execPath, ['--input-type=module', '-e', `
            const { pruneStaleRuntimes } = await import(${JSON.stringify(registry)});
            const result = pruneStaleRuntimes(process.cwd(), { killOrphans: true });
            console.log(JSON.stringify({ stale: result.stale.length, active: result.active.length }));
        `], { cwd, windowsHide: true, encoding: 'utf8' });
        assert.deepEqual(JSON.parse(result), { stale: 0, active: 1 });
        assert.equal(child.exitCode, null);
    } finally {
        child.kill();
        await exited;
        fs.rmSync(cwd, { recursive: true, force: true });
    }
});
