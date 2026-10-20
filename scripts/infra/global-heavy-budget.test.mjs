import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import { getGitCommonDir } from './e2e-runtime-registry.js';
import { acquireGlobalHeavyBudget, listGlobalHeavyBudgetEntries, pruneGlobalHeavyBudget } from './global-heavy-budget.mjs';

async function withResourceReadings({ freeGb = 8, busy = false }, run) {
    const cwd = createTemporaryRepo();
    const keys = ['BG_HEAVY_STARTUP_COOLDOWN_MS', 'BG_HEAVY_CPU_SAMPLE_COUNT', 'BG_HEAVY_CPU_SAMPLE_INTERVAL_MS', 'BG_HEAVY_GLOBAL_MAX_WEIGHT', 'BG_HEAVY_E2E_GROUP_MAX_WEIGHT'];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    Object.assign(process.env, {
        BG_HEAVY_STARTUP_COOLDOWN_MS: '0', BG_HEAVY_CPU_SAMPLE_COUNT: '1', BG_HEAVY_CPU_SAMPLE_INTERVAL_MS: '1',
        BG_HEAVY_GLOBAL_MAX_WEIGHT: '1', BG_HEAVY_E2E_GROUP_MAX_WEIGHT: '1',
    });
    let ticks = 0;
    const memory = mock.method(os, 'freemem', () => freeGb * 1024 ** 3);
    const cpu = mock.method(os, 'cpus', () => {
        ticks += 100;
        return [{ times: { user: busy ? ticks : 0, idle: busy ? 0 : ticks, nice: 0, sys: 0, irq: 0 } }];
    });
    try { await run(cwd); }
    finally {
        memory.mock.restore(); cpu.mock.restore();
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key]; else process.env[key] = value;
        }
        await new Promise(resolve => setImmediate(resolve));
        fs.rmSync(cwd, { recursive: true, force: true });
    }
}

test('资源充足时多个 E2E 同时登记，旧的固定名额配置不再拦截', async () => {
    await withResourceReadings({}, async cwd => {
        const handles = [];
        try {
            for (let i = 0; i < 5; i++) handles.push(await acquireGlobalHeavyBudget({ group: 'e2e', cwd, waitForBudget: false }));
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 5);
            assert.ok(handles.every(handle => !handle.bypassed), '必须经过实际资源检查');
        } finally {
            for (const handle of handles) await handle.release();
        }
    });
});

test('CPU 压力过高时即使没有其它任务也拒绝启动', async () => {
    await withResourceReadings({ busy: true }, async cwd => {
        await assert.rejects(acquireGlobalHeavyBudget({ group: 'e2e', cwd, waitForBudget: false }), /CPU 过高/);
        assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 0);
    });
});

test('等待服务后资源恶化时，浏览器启动前重新检查并阻止启动', async () => {
    await withResourceReadings({}, async cwd => {
        const handle = await acquireGlobalHeavyBudget({ group: 'e2e', cwd, waitForBudget: false });
        const pressure = mock.method(os, 'freemem', () => 0.5 * 1024 ** 3);
        let browserStarted = false;
        try {
            await assert.rejects(async () => {
                await handle.waitForResources();
                browserStarted = true;
            }, /可用内存不足/);
            assert.equal(browserStarted, false);
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 1, '重采样不能重复登记');
        } finally { pressure.mock.restore(); await handle.release(); }
    });
});

test('可用内存低于下限时即使没有其它任务也拒绝启动', async () => {
    await withResourceReadings({ freeGb: 0.5 }, async cwd => {
        await assert.rejects(acquireGlobalHeavyBudget({ group: 'e2e', cwd, waitForBudget: false }), /可用内存不足/);
        assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 0);
    });
});

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
