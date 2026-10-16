import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import { getGitCommonDir } from './e2e-runtime-registry.js';
import { pruneGlobalHeavyBudget } from './global-heavy-budget.mjs';

function createTemporaryRepo() {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'global-heavy-budget-test-'));
    execFileSync('git', ['init', '--quiet'], { cwd, stdio: 'ignore' });
    return cwd;
}

function getLockPath(cwd) {
    return path.join(getGitCommonDir(cwd), 'boardgame-heavy-budget', 'registry.lock');
}

test('permission errors propagate immediately without changing the original error', async () => {
    for (const code of ['EPERM', 'EACCES']) {
        const cwd = createTemporaryRepo();
        const lockPath = getLockPath(cwd);
        const originalOpenSync = fs.openSync;
        const injectedError = Object.assign(new Error('injected ' + code), {
            code,
            errno: code === 'EPERM' ? -4048 : -4092,
            syscall: 'open',
            path: lockPath,
        });
        let attempts = 0;
        const stub = mock.method(fs, 'openSync', (filePath, ...args) => {
            if (path.resolve(String(filePath)) === lockPath) {
                attempts += 1;
                throw injectedError;
            }
            return Reflect.apply(originalOpenSync, fs, [filePath, ...args]);
        });

        try {
            await assert.rejects(
                pruneGlobalHeavyBudget({ cwd, logger: { log() {} } }),
                error => error === injectedError,
            );
            assert.equal(attempts, 1, code + ' must not be treated as lock contention');
        } finally {
            stub.mock.restore();
            fs.rmSync(cwd, { recursive: true, force: true });
        }
    }
});

test('an existing lock still waits for the owner to release it', async () => {
    const cwd = createTemporaryRepo();
    const lockPath = getLockPath(cwd);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, 'held by another process');
    const originalOpenSync = fs.openSync;
    let attempts = 0;
    const stub = mock.method(fs, 'openSync', (filePath, ...args) => {
        if (path.resolve(String(filePath)) === lockPath) attempts += 1;
        return Reflect.apply(originalOpenSync, fs, [filePath, ...args]);
    });
    const releaseTimer = setTimeout(() => {
        try { fs.unlinkSync(lockPath); } catch {}
    }, 250);
    const startedAt = Date.now();

    try {
        await pruneGlobalHeavyBudget({ cwd, logger: { log() {} } });
        assert.ok(attempts >= 2, 'expected EEXIST retries, got ' + attempts + ' attempt(s)');
        assert.ok(Date.now() - startedAt >= 150, 'the active lock should not be bypassed');
    } finally {
        clearTimeout(releaseTimer);
        stub.mock.restore();
        fs.rmSync(cwd, { recursive: true, force: true });
    }
});

test('a real lock timeout reports the current owner PID and lock age', async () => {
    const cwd = createTemporaryRepo();
    const lockPath = getLockPath(cwd);
    const createdAt = new Date().toISOString();
    const command = 'unit-test-lock-holder';
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, command, createdAt }));
    const startedAt = Date.now();

    try {
        await assert.rejects(
            pruneGlobalHeavyBudget({ cwd, logger: { log() {} } }),
            error => {
                assert.match(error.message, /获取全局重任务预算锁超时/);
                assert.match(error.message, new RegExp(`holderPid=${process.pid}`));
                assert.ok(error.message.includes(`holderCommand=${command}`), error.message);
                assert.ok(error.message.includes(`holderCreatedAt=${createdAt}`), error.message);
                assert.match(error.message, /lockAgeMs=\d+/);
                assert.match(error.message, /attempts=\d+/);
                assert.ok(error.message.includes(lockPath), error.message);
                return true;
            },
        );
        assert.ok(Date.now() - startedAt >= 9_000, 'the active lock must be honored until timeout');
    } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
    }
});
