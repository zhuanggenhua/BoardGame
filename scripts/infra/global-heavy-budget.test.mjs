import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mock, test } from 'node:test';
import { getGitCommonDir } from './e2e-runtime-registry.js';
import { acquireGlobalHeavyBudget, listGlobalHeavyBudgetEntries, pruneGlobalHeavyBudget } from './global-heavy-budget.mjs';
import { getHeavyProcessIdentities, getHeavyProcessIdentity } from './heavy-process-identity.mjs';

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

test('资源不足时等待，内存恢复后自动登记并继续', async () => {
    await withResourceReadings({ freeGb: 0.5 }, async cwd => {
        let freeGb = 0.5;
        const memory = mock.method(os, 'freemem', () => freeGb * 1024 ** 3);
        const logs = [];
        let admitted = false;
        let admissionError;
        const pending = acquireGlobalHeavyBudget({
            group: 'e2e', cwd, waitForBudget: true, waitTimeoutMs: 5000, waitPollMs: 50,
            logger: { log: message => logs.push(message) },
        }).then(handle => { admitted = true; return handle; }, error => { admissionError = error; return null; });
        let handle;
        try {
            const deadline = Date.now() + 3000;
            while (!logs.some(message => message.includes('资源压力过高'))) {
                if (admissionError) throw admissionError;
                if (Date.now() > deadline) throw new Error('没有观察到资源等待');
                await new Promise(resolve => setTimeout(resolve, 20));
            }
            assert.equal(admitted, false);
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 0);
            freeGb = 8;
            handle = await pending;
            if (admissionError) throw admissionError;
            assert.equal(admitted, true);
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 1);
        } finally {
            // 保证失败时挂起的申请也能退出，不让它占用后续测试。
            freeGb = 8;
            try {
                if (!handle) handle = await pending;
                await handle?.release();
            } finally { memory.mock.restore(); }
        }
    });
});

test('等待模式下登记失败应立即返回实际磁盘错误', async () => {
    await withResourceReadings({}, async cwd => {
        const injected = Object.assign(new Error('registry write denied'), { code: 'EACCES' });
        const originalRename = fs.renameSync;
        let registryWrites = 0;
        const stub = mock.method(fs, 'renameSync', (source, target) => {
            if (String(target).endsWith(`${path.sep}boardgame-heavy-budget${path.sep}registry.json`)) {
                registryWrites += 1;
                if (registryWrites === 2) throw injected;
            }
            return Reflect.apply(originalRename, fs, [source, target]);
        });
        try {
            await assert.rejects(acquireGlobalHeavyBudget({
                group: 'e2e', cwd, waitForBudget: true, waitTimeoutMs: 1500, waitPollMs: 50,
                logger: { log() {} },
            }), error => error === injected);
        } finally { stub.mock.restore(); }
    });
});

test('登记前资源复查变差后会等待并重试', async () => {
    await withResourceReadings({}, async cwd => {
        let reads = 0;
        const memory = mock.method(os, 'freemem', () => (++reads === 2 ? 0.5 : 8) * 1024 ** 3);
        const logs = [];
        let handle;
        try {
            handle = await acquireGlobalHeavyBudget({
                group: 'e2e', cwd, waitForBudget: true, waitTimeoutMs: 5000, waitPollMs: 50,
                logger: { log: message => logs.push(message) },
            });
            assert.ok(logs.some(message => message.includes('资源检查或登记竞争')));
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 1);
        } finally {
            try { await handle?.release(); } finally { memory.mock.restore(); }
        }
    });
});

test('预算登记文件损坏时拒绝覆盖原数据', async () => {
    await withResourceReadings({}, async cwd => {
        const registryPath = path.join(getGitCommonDir(cwd), 'boardgame-heavy-budget', 'registry.json');
        fs.mkdirSync(path.dirname(registryPath), { recursive: true });
        fs.writeFileSync(registryPath, '{broken');
        await assert.rejects(acquireGlobalHeavyBudget({
            group: 'e2e', cwd, waitForBudget: true, waitTimeoutMs: 1000, waitPollMs: 50,
            logger: { log() {} },
        }), SyntaxError);
        assert.equal(fs.readFileSync(registryPath, 'utf8'), '{broken');
    });
});

test('缺少登记列表的有效 JSON 不能当空表覆盖', async () => {
    await withResourceReadings({}, async cwd => {
        const registryPath = path.join(getGitCommonDir(cwd), 'boardgame-heavy-budget', 'registry.json');
        fs.mkdirSync(path.dirname(registryPath), { recursive: true });
        fs.writeFileSync(registryPath, '{"unexpected":true}');
        await assert.rejects(acquireGlobalHeavyBudget({
            group: 'e2e', cwd, waitForBudget: false, logger: { log() {} },
        }), /登记.*格式/);
        assert.equal(fs.readFileSync(registryPath, 'utf8'), '{"unexpected":true}');
    });
});

test('过期登记按进程实例辨别心跳故障与 PID 复用', async t => {
    const identity = await getHeavyProcessIdentity(process.pid);
    if (!identity) return t.skip('当前平台无法读取进程实例身份');
    const cwd = createTemporaryRepo();
    const registryPath = path.join(getGitCommonDir(cwd), 'boardgame-heavy-budget', 'registry.json');
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    const common = { pid: process.pid, group: 'e2e', weight: 1, worktreeRoot: cwd, leaseExpiresAt: '2000-01-01T00:00:00.000Z' };
    fs.writeFileSync(registryPath, JSON.stringify({ entries: [
        { ...common, entryId: 'same-instance', processIdentity: identity },
        { ...common, entryId: 'reused-pid', processIdentity: `${identity}-old` },
        { ...common, entryId: 'unknown-instance' },
    ] }));
    const warnings = [];
    try {
        const result = await pruneGlobalHeavyBudget({ cwd, logger: { log() {}, warn: message => warnings.push(message) } });
        assert.deepEqual(result.removed.map(entry => entry.entryId), ['reused-pid']);
        assert.deepEqual((await listGlobalHeavyBudgetEntries({ cwd })).map(entry => entry.entryId), ['same-instance', 'unknown-instance']);
        assert.ok(warnings.some(message => message.includes('无法核实')));
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('外部 PID 批量查询不阻塞心跳，锁内保留已恢复的登记', async t => {
    if (process.platform !== 'win32') return t.skip('此用例验证 Windows 异步进程查询');
    const cwd = createTemporaryRepo();
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { windowsHide: true, stdio: 'ignore' });
    const exited = new Promise(resolve => child.once('exit', resolve));
    const registryPath = path.join(getGitCommonDir(cwd), 'boardgame-heavy-budget', 'registry.json');
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    const entry = { entryId: 'external', pid: child.pid, processIdentity: 'windows:1', group: 'e2e', weight: 1,
        worktreeRoot: cwd, leaseExpiresAt: '2000-01-01T00:00:00.000Z' };
    fs.writeFileSync(registryPath, JSON.stringify({ entries: [entry] }));
    let heartbeatRan = false;
    const heartbeat = setTimeout(() => {
        heartbeatRan = true;
        fs.writeFileSync(registryPath, JSON.stringify({ entries: [{ ...entry, leaseExpiresAt: new Date(Date.now() + 60000).toISOString() }] }));
    }, 20);
    try {
        const result = await pruneGlobalHeavyBudget({ cwd, logger: { log() {}, warn() {} } });
        assert.equal(heartbeatRan, true, '外部身份查询不能阻塞事件循环');
        assert.equal(result.removed.length, 0, '心跳恢复后不能使用旧查询结果删除');
        const identities = await getHeavyProcessIdentities([child.pid, child.pid]);
        assert.match(identities.get(child.pid) ?? '', /^windows:\d+$/);
        assert.equal(identities.size, 1);
    } finally {
        clearTimeout(heartbeat);
        child.kill();
        await exited;
        fs.rmSync(cwd, { recursive: true, force: true });
    }
});

test('身份正向缓存过期后能识别 PID 已被复用', async () => {
    const cwd = createTemporaryRepo();
    const registryPath = path.join(getGitCommonDir(cwd), 'boardgame-heavy-budget', 'registry.json');
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    const token = `test-instance-${Date.now()}`;
    fs.writeFileSync(registryPath, JSON.stringify({ entries: [{ entryId: token, pid: process.pid, processIdentity: token,
        group: 'e2e', worktreeRoot: cwd, leaseExpiresAt: '2000-01-01T00:00:00.000Z' }] }));
    let currentTime = Date.now();
    let actualIdentity = token;
    let queries = 0;
    const options = { cwd, logger: { log() {}, warn() {} }, now: () => currentTime,
        resolveIdentities: async pids => { queries += 1; return new Map(pids.map(pid => [pid, actualIdentity])); } };
    try {
        assert.equal((await pruneGlobalHeavyBudget(options)).removed.length, 0);
        assert.equal(queries, 1);
        actualIdentity = `${token}-new`;
        currentTime += 1000;
        assert.equal((await pruneGlobalHeavyBudget(options)).removed.length, 0);
        assert.equal(queries, 1, '短期缓存只延迟删除，不重新消耗查询资源');
        currentTime += 5000;
        assert.equal((await pruneGlobalHeavyBudget(options)).removed.length, 1);
        assert.equal(queries, 2);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
});

test('释放登记发生临时写入错误后可以重试', async () => {
    await withResourceReadings({}, async cwd => {
        const warnings = [];
        const handle = await acquireGlobalHeavyBudget({ group: 'e2e', cwd, waitForBudget: false, logger: { log() {}, warn: message => warnings.push(message) } });
        const injected = Object.assign(new Error('temporary registry error'), { code: 'EACCES' });
        const originalRename = fs.renameSync;
        let fail = true;
        const stub = mock.method(fs, 'renameSync', (source, target) => {
            if (fail && String(target).endsWith(`${path.sep}boardgame-heavy-budget${path.sep}registry.json`)) {
                fail = false;
                throw injected;
            }
            return Reflect.apply(originalRename, fs, [source, target]);
        });
        try {
            assert.equal(await handle.release(), false);
            assert.ok(warnings.some(message => message.includes(injected.message)));
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 1);
            assert.equal(await handle.release(), true);
            assert.equal((await listGlobalHeavyBudgetEntries({ cwd })).length, 0);
        } finally {
            stub.mock.restore();
            await handle.release();
        }
    });
});

test('调用方不重试时临时释放错误也能自动恢复', async () => {
    await withResourceReadings({}, async cwd => {
        const handle = await acquireGlobalHeavyBudget({ group: 'e2e', cwd, waitForBudget: false, logger: { log() {}, warn() {} } });
        const originalRename = fs.renameSync;
        let fail = true;
        const stub = mock.method(fs, 'renameSync', (source, target) => {
            if (fail && String(target).endsWith(`${path.sep}boardgame-heavy-budget${path.sep}registry.json`)) {
                fail = false;
                throw Object.assign(new Error('temporary registry error'), { code: 'EACCES' });
            }
            return Reflect.apply(originalRename, fs, [source, target]);
        });
        try {
            assert.equal(await handle.release(), false);
            const deadline = Date.now() + 5000;
            while ((await listGlobalHeavyBudgetEntries({ cwd })).length) {
                if (Date.now() > deadline) throw new Error('释放登记未自动重试成功');
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            assert.equal(await handle.release(), true);
        } finally { stub.mock.restore(); await handle.release(); }
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

test('预算锁即使超过超时时间，活 owner 未释放时也不能被删除', async () => {
    const cwd = createTemporaryRepo();
    const lockPath = getLockPath(cwd);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, createdAt: '2000-01-01T00:00:00.000Z' }));
    const old = new Date('2000-01-01T00:00:00.000Z');
    fs.utimesSync(lockPath, old, old);
    let finished = false;
    const pending = pruneGlobalHeavyBudget({ cwd, logger: { log() {} } }).then(() => { finished = true; });
    try {
        await new Promise(resolve => setTimeout(resolve, 400));
        assert.equal(finished, false);
        assert.equal(fs.existsSync(lockPath), true);
        fs.unlinkSync(lockPath);
        await pending;
        assert.equal(finished, true);
    } finally {
        if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
        await pending;
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
