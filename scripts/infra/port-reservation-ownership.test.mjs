import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { reserveAvailablePorts, releaseReservedPorts, releaseReservedPortsForScope } from './port-allocator.js';

test('释放当前 scope 只删除本工作目录的保留记录，兼容旧文件名', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'port-ownership-test-'));
    execFileSync('git', ['init', '--quiet'], { cwd, windowsHide: true });
    const directory = path.join(cwd, '.git', 'boardgame-e2e', 'port-reservations');
    try {
        const first = await reserveAvailablePorts(0, { cwd, scope: 'same-scope' });
        const ownPath = fs.readdirSync(directory).find(name => name.endsWith('.json'));
        const own = JSON.parse(fs.readFileSync(path.join(directory, ownPath)));
        const foreignPath = path.join(directory, 'same-scope-worker-0.json');
        const foreign = { ...own, worktreeRoot: path.join(cwd, 'foreign'), ports: { frontend: first.frontend + 1 } };
        fs.writeFileSync(foreignPath, JSON.stringify(foreign));
        const second = await reserveAvailablePorts(0, { cwd, scope: 'same-scope' });
        assert.notEqual(second.frontend, foreign.ports.frontend, '同 scope 的其它工作目录仍占用其端口');
        assert.ok(fs.existsSync(foreignPath), '申请不能覆盖旧格式的外部记录');
        await releaseReservedPorts(0, 'same-scope', cwd);
        assert.ok(fs.existsSync(foreignPath), '按 worker 释放不能删除外部记录');
        await reserveAvailablePorts(0, { cwd, scope: 'same-scope' });
        await releaseReservedPortsForScope('same-scope', cwd, process.pid + 1000000);
        assert.equal(fs.readdirSync(directory).filter(name => name.endsWith('.json')).length, 2, '迟到的旧 owner 不能释放新 owner 的端口记录');
        const ownRecordPath = path.join(directory, ownPath);
        const lockPath = path.join(directory, 'port-reservations.lock');
        fs.writeFileSync(lockPath, JSON.stringify({ ownerPid: process.pid, createdAt: new Date().toISOString() }));
        const delayedRelease = releaseReservedPortsForScope('same-scope', cwd, process.pid);
        fs.writeFileSync(ownRecordPath, JSON.stringify({ ...own, ownerPid: process.pid + 1000000 }));
        await new Promise(resolve => setTimeout(resolve, 150));
        assert.ok(fs.existsSync(ownRecordPath), '申请持锁时释放必须等待，不能提前读取并删除');
        fs.unlinkSync(lockPath);
        await delayedRelease;
        assert.ok(fs.existsSync(ownRecordPath), '换代后迟到释放不能删除新记录');
        await releaseReservedPortsForScope('same-scope', cwd);
        assert.deepEqual(fs.readdirSync(directory), ['same-scope-worker-0.json']);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});
