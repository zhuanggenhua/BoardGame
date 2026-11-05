import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const guardModule = new URL('./heavy-task-guard.mjs', import.meta.url).href;

for (const secondName of ['e2e-run', 'quality-gate']) {
    test(`登记 ${secondName} 不因另一个 E2E 存活而拒绝启动`, async () => {
        const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'task-registration-test-'));
        const owner = spawn(process.execPath, ['--input-type=module', '-e', `
            const { acquireTaskGuard } = await import(${JSON.stringify(guardModule)});
            acquireTaskGuard({ name: 'e2e-run', allowConcurrency: false });
            console.log('READY');
            process.stdin.resume();
        `], { cwd, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
        const exited = new Promise(resolve => owner.once('exit', resolve));
        try {
            await new Promise((resolve, reject) => {
                owner.once('error', reject);
                owner.stdout.once('data', resolve);
                owner.once('exit', () => reject(new Error('登记持有进程提前退出')));
            });
            const output = execFileSync(process.execPath, ['--input-type=module', '-e', `
                const { acquireTaskGuard, listTaskGuards } = await import(${JSON.stringify(guardModule)});
                const registration = acquireTaskGuard({ name: ${JSON.stringify(secondName)}, conflicts: ['e2e-run'], allowConcurrency: false });
                console.log(JSON.stringify(listTaskGuards().map(record => record.pid)));
                registration.release();
            `], { cwd, windowsHide: true, timeout: 5000, encoding: 'utf8' });
            assert.equal(JSON.parse(output.trim()).length, 2);
            assert.equal(owner.exitCode, null, '不得终止另一个正在运行的 E2E');
        } finally {
            owner.stdin.end();
            await exited;
            fs.rmSync(cwd, { recursive: true, force: true });
        }
    });
}
