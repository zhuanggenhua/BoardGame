import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { withSqliteProcessLock } from './sqlite-process-lock.mjs';

test('活持有者不能被抢占，异常退出后锁自动恢复', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-sqlite-lock-'));
    const lockPath = path.join(dir, 'lock.sqlite');
    const moduleUrl = new URL('./sqlite-process-lock.mjs', import.meta.url).href;
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        const {withSqliteProcessLock}=await import(${JSON.stringify(moduleUrl)});
        await withSqliteProcessLock(${JSON.stringify(lockPath)}, async () => {
            console.log('LOCKED');
            await new Promise(resolve => { process.stdin.once('end', resolve); process.stdin.resume(); });
        });
    `], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const exited = new Promise(resolve => child.once('exit', resolve));
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    try {
        const deadline = Date.now() + 10000;
        while (!output.includes('LOCKED')) {
            if (child.exitCode !== null || Date.now() > deadline) throw new Error('持锁测试进程未就绪');
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        let heartbeat = false;
        const timer = setTimeout(() => { heartbeat = true; }, 30);
        try {
            await assert.rejects(withSqliteProcessLock(lockPath, async () => {}, { timeoutMs: 250, pollMs: 20 }), /等待跨进程锁超时/);
            assert.equal(heartbeat, true, '等待锁时事件循环仍可执行心跳');
        } finally { clearTimeout(timer); }
        child.kill();
        await exited;
        let recovered = false;
        await withSqliteProcessLock(lockPath, async () => { recovered = true; }, { timeoutMs: 5000, pollMs: 20 });
        assert.equal(recovered, true);
    } finally {
        if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; }
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('写入临时文件时进程退出不破坏已发布的登记', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-sqlite-write-'));
    const lockPath = path.join(dir, 'lock.sqlite');
    const registry = path.join(dir, 'registry.json');
    fs.writeFileSync(registry, JSON.stringify({ entries: ['old'] }));
    const moduleUrl = new URL('./sqlite-process-lock.mjs', import.meta.url).href;
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        import fs from 'node:fs';
        const {withSqliteProcessLock}=await import(${JSON.stringify(moduleUrl)});
        await withSqliteProcessLock(${JSON.stringify(lockPath)}, async () => {
            fs.writeFileSync(${JSON.stringify(`${registry}.tmp`)}, '{"entries":');
            console.log('WRITING');
            await new Promise(resolve => { process.stdin.once('end', resolve); process.stdin.resume(); });
        });
    `], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    const exited = new Promise(resolve => child.once('exit', resolve));
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    try {
        const deadline = Date.now() + 10000;
        while (!output.includes('WRITING')) {
            if (child.exitCode !== null || Date.now() > deadline) throw new Error('测试写入进程未就绪');
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        child.kill();
        await exited;
        await withSqliteProcessLock(lockPath, async () => {
            assert.deepEqual(JSON.parse(fs.readFileSync(registry, 'utf8')), { entries: ['old'] });
        }, { timeoutMs: 5000, pollMs: 20 });
    } finally {
        if (child.exitCode === null && child.signalCode === null) { child.kill(); await exited; }
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('锁数据库损坏时拒绝重建或清空', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-sqlite-corrupt-'));
    const lockPath = path.join(dir, 'lock.sqlite');
    fs.writeFileSync(lockPath, 'not a sqlite database');
    try {
        await assert.rejects(withSqliteProcessLock(lockPath, async () => {}));
        assert.equal(fs.readFileSync(lockPath, 'utf8'), 'not a sqlite database');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
