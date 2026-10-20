import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const managerModule = new URL('./e2e-runtime-manager.mjs', import.meta.url).href;

async function holdStartup(cwd) {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
        const { withRuntimeStartupLock } = await import(${JSON.stringify(managerModule)});
        await withRuntimeStartupLock('shared-single', async () => {
            console.log('READY');
            await new Promise(resolve => { process.stdin.once('end', resolve); process.stdin.resume(); });
        });
    `], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const exited = new Promise(resolve => child.once('exit', resolve));
    await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.stdout.once('data', resolve);
        child.once('exit', () => reject(new Error('服务启动持有者提前退出')));
    });
    return { child, exited };
}

for (const sameScope of [true, false]) {
    test(sameScope ? '同一共享服务的启动必须等待原启动者，不得重复起服' : '不同 scope 的服务启动可并发，不受全局互斥限制', async () => {
        const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-startup-test-'));
        execFileSync('git', ['init', '--quiet'], { cwd, windowsHide: true });
        const owner = await holdStartup(cwd);
        try {
            const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
                const { withRuntimeStartupLock } = await import(${JSON.stringify(managerModule)});
                try {
                    await withRuntimeStartupLock(${JSON.stringify(sameScope ? 'shared-single' : 'isolated-single-second')}, async () => console.log('STARTED'), { timeoutMs: 300 });
                } catch (error) { console.log(error.message); }
            `], { cwd, windowsHide: true, encoding: 'utf8', timeout: 10000 });
            if (sameScope) {
                assert.match(output, new RegExp(`等待同一服务启动超时:.*ownerPid=${owner.child.pid}`));
                assert.doesNotMatch(output, /STARTED/);
            } else assert.match(output, /STARTED/);
            assert.equal(owner.child.exitCode, null, '不能终止仍在启动服务的 owner');
        } finally {
            owner.child.stdin.end();
            await owner.exited;
        }
        const after = execFileSync(process.execPath, ['--input-type=module', '-e', `
            const { withRuntimeStartupLock } = await import(${JSON.stringify(managerModule)});
            await withRuntimeStartupLock('shared-single', async () => console.log('REUSE_READY'));
        `], { cwd, windowsHide: true, encoding: 'utf8', timeout: 10000 });
        assert.match(after, /REUSE_READY/, '启动完毕即释放，不锁住后续测试执行');
        fs.rmSync(cwd, { recursive: true, force: true });
    });
}
