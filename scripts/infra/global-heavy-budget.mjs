import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGitCommonDir, getWorktreeRoot } from './e2e-runtime-registry.js';

const BUDGET_DIR_NAME = 'boardgame-heavy-budget';
const REGISTRY_FILE_NAME = 'registry.json';
const LOCK_FILE_NAME = 'registry.lock';
const LOCK_TIMEOUT_MS = 10000;
const LOCK_RETRY_MS = 100;
const LOCK_STALE_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TTL_MS = 15000;

function nowIso() {
    return new Date().toISOString();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRegistryLockContention(error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('获取全局重任务预算锁超时');
}

function normalizeName(value, fallback) {
    const normalized = String(value ?? fallback).trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    return normalized || fallback;
}

function isPidAlive(pid) {
    if (!Number.isInteger(pid) || pid <= 0) {
        return false;
    }

    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error?.code === 'EPERM';
    }
}

function getBudgetDir(cwd = process.cwd()) {
    return path.join(getGitCommonDir(cwd), BUDGET_DIR_NAME);
}

function getRegistryFilePath(cwd = process.cwd()) {
    return path.join(getBudgetDir(cwd), REGISTRY_FILE_NAME);
}

function getRegistryLockPath(cwd = process.cwd()) {
    return path.join(getBudgetDir(cwd), LOCK_FILE_NAME);
}

function describeRegistryLockHolder(lockPath) {
    let stats;
    try {
        stats = fs.statSync(lockPath);
    } catch (error) {
        return error?.code === 'ENOENT'
            ? 'holder=not-present-at-timeout'
            : `holder=unreadable; inspectError=${error?.code ?? 'unknown'}`;
    }

    const lockAgeMs = Math.max(0, Math.round(Date.now() - stats.mtimeMs));
    try {
        const owner = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
        const pid = Number(owner?.pid);
        const holderPid = Number.isInteger(pid) && pid > 0 ? pid : 'unknown';
        const holderCommand = typeof owner?.command === 'string' && owner.command.trim() ? owner.command : 'unknown';
        const createdAt = typeof owner?.createdAt === 'string' ? owner.createdAt : 'unknown';
        return `holderPid=${holderPid}; holderCommand=${holderCommand}; holderCreatedAt=${createdAt}; lockAgeMs=${lockAgeMs}`;
    } catch (error) {
        return `holder=metadata-unreadable; lockAgeMs=${lockAgeMs}; inspectError=${error?.code ?? 'invalid-json'}`;
    }
}

function ensureBudgetDir(cwd = process.cwd()) {
    fs.mkdirSync(getBudgetDir(cwd), { recursive: true });
}

function readRegistry(cwd = process.cwd()) {
    try {
        return JSON.parse(fs.readFileSync(getRegistryFilePath(cwd), 'utf8'));
    } catch {
        return { entries: [], updatedAt: null };
    }
}

function writeRegistry(registry, cwd = process.cwd()) {
    ensureBudgetDir(cwd);
    const filePath = getRegistryFilePath(cwd);
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify({
        entries: registry.entries ?? [],
        updatedAt: nowIso(),
    }, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
}

async function acquireRegistryLock(cwd = process.cwd()) {
    const lockPath = getRegistryLockPath(cwd);
    ensureBudgetDir(cwd);
    const startedAt = Date.now();
    let attempts = 0;

    while (Date.now() - startedAt < LOCK_TIMEOUT_MS) {
        attempts += 1;
        try {
            const fd = fs.openSync(lockPath, 'wx');
            fs.writeFileSync(fd, JSON.stringify({
                pid: process.pid,
                command: path.basename(process.argv[1] || process.execPath),
                createdAt: nowIso(),
            }, null, 2));

            return () => {
                try {
                    fs.closeSync(fd);
                } catch {
                    // ignore
                }
                try {
                    fs.unlinkSync(lockPath);
                } catch {
                    // ignore
                }
            };
        } catch (error) {
            const code = error?.code;
            if (code !== 'EEXIST') {
                throw error;
            }

            let removedStaleLock = false;
            try {
                const stats = fs.statSync(lockPath);
                if (Date.now() - stats.mtimeMs > LOCK_STALE_MS) {
                    fs.unlinkSync(lockPath);
                    removedStaleLock = true;
                }
            } catch {
                // Windows can transiently deny stat/unlink while another process is closing the lock.
            }

            if (removedStaleLock) {
                continue;
            }

            await sleep(LOCK_RETRY_MS);
        }
    }

    const elapsedMs = Date.now() - startedAt;
    const holder = describeRegistryLockHolder(lockPath);
    throw new Error(`获取全局重任务预算锁超时: ${lockPath}; elapsedMs=${elapsedMs}; attempts=${attempts}; ${holder}`);
}

async function withRegistryLock(fn, cwd = process.cwd()) {
    const release = await acquireRegistryLock(cwd);
    try {
        return await fn();
    } finally {
        release();
    }
}

function inspectEntry(entry) {
    const leaseExpiresAt = Date.parse(entry?.leaseExpiresAt ?? '');
    const heartbeatFresh = Number.isFinite(leaseExpiresAt) ? leaseExpiresAt > Date.now() : false;
    const alive = isPidAlive(Number(entry?.pid));
    return {
        alive,
        heartbeatFresh,
        stale: !alive || !heartbeatFresh,
    };
}

function normalizeEntry(entry, cwd = process.cwd()) {
    return {
        entryId: String(entry.entryId || `${process.pid}-${Date.now()}`),
        pid: Number(entry.pid || process.pid),
        group: normalizeName(entry.group, 'default'),
        weight: Math.max(1, Number(entry.weight || 1)),
        worktreeRoot: path.resolve(entry.worktreeRoot || getWorktreeRoot(cwd)),
        worktreeName: path.basename(path.resolve(entry.worktreeRoot || getWorktreeRoot(cwd))),
        command: String(entry.command || process.argv.join(' ')),
        metadata: entry.metadata ?? {},
        startedAt: entry.startedAt || nowIso(),
        updatedAt: entry.updatedAt || nowIso(),
        leaseExpiresAt: entry.leaseExpiresAt || new Date(Date.now() + HEARTBEAT_TTL_MS).toISOString(),
    };
}

export async function pruneGlobalHeavyBudget({ logger = console, cwd = process.cwd() } = {}) {
    return await withRegistryLock(async () => {
        const registry = readRegistry(cwd);
        const removed = [];
        const activeEntries = [];

        for (const rawEntry of registry.entries ?? []) {
            const entry = normalizeEntry(rawEntry, cwd);
            const inspected = inspectEntry(entry);
            if (inspected.stale) {
                removed.push(entry);
                continue;
            }
            activeEntries.push(entry);
        }

        writeRegistry({ entries: activeEntries }, cwd);
        if (removed.length > 0) {
            logger.log?.(`[global-heavy-budget] 已清理 ${removed.length} 个失效预算占用。`);
        }
        return { removed, entries: activeEntries };
    }, cwd);
}

export async function listGlobalHeavyBudgetEntries({ includeStale = false, cwd = process.cwd() } = {}) {
    const registry = readRegistry(cwd);
    const entries = (registry.entries ?? []).map(entry => normalizeEntry(entry, cwd));
    if (includeStale) {
        return entries.map(entry => ({
            ...entry,
            active: !inspectEntry(entry).stale,
        }));
    }
    return entries.filter(entry => !inspectEntry(entry).stale);
}

function sumWeight(entries, predicate = () => true) {
    return entries
        .filter(predicate)
        .reduce((total, entry) => total + Math.max(1, Number(entry.weight || 1)), 0);
}

function parseEnvNumber(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isFinite(value) ? value : fallback;
}

function parseOptionalEnvNumber(name) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

function resolveAdaptiveMemoryMinFreeGb() {
    return 1;
}

function resolveDefaultMemoryMinFreeGb(group) {
    if (normalizeName(group, 'default') === 'e2e') {
        return 1;
    }

    return resolveAdaptiveMemoryMinFreeGb();
}

function resolveMemoryMinFreeGb(group) {
    const isE2EGroup = normalizeName(group, 'default') === 'e2e';
    const normalizedGroup = normalizeName(group, 'default').toUpperCase().replace(/-/g, '_');
    const groupOverride = parseOptionalEnvNumber(`BG_HEAVY_${normalizedGroup}_MEMORY_MIN_FREE_GB`);
    if (groupOverride !== null) {
        return isE2EGroup ? Math.max(1, groupOverride) : groupOverride;
    }

    const globalOverride = parseOptionalEnvNumber('BG_HEAVY_MEMORY_MIN_FREE_GB');
    if (globalOverride !== null) {
        return isE2EGroup ? Math.max(1, globalOverride) : globalOverride;
    }

    return resolveDefaultMemoryMinFreeGb(group);
}

function readBudgetConfig(group) {
    const normalizedGroup = normalizeName(group, 'default');
    const defaultGroupWeight = normalizedGroup === 'quality-gate' ? 2 : 1;
    return {
        weight: parseEnvNumber(`BG_HEAVY_${normalizedGroup.toUpperCase().replace(/-/g, '_')}_WEIGHT`, defaultGroupWeight),
        waitForBudget: process.env.BG_HEAVY_WAIT_FOR_BUDGET === '1',
        waitTimeoutMs: parseEnvNumber('BG_HEAVY_WAIT_TIMEOUT_MS', 120000),
        waitPollMs: parseEnvNumber('BG_HEAVY_WAIT_POLL_MS', 2000),
        cpuSoftLimit: parseEnvNumber('BG_HEAVY_CPU_SOFT_LIMIT', 90),
        cpuHardLimit: parseEnvNumber('BG_HEAVY_CPU_HARD_LIMIT', 90),
        cpuSampleCount: parseEnvNumber('BG_HEAVY_CPU_SAMPLE_COUNT', 3),
        cpuSampleIntervalMs: parseEnvNumber('BG_HEAVY_CPU_SAMPLE_INTERVAL_MS', 250),
        memoryMinFreeGb: resolveMemoryMinFreeGb(normalizedGroup),
    };
}

function readCpuTimes() {
    return os.cpus().map(cpu => ({
        idle: cpu.times.idle,
        total: Object.values(cpu.times).reduce((sum, value) => sum + value, 0),
    }));
}

async function sampleCpuUsagePercent({ sampleCount, sampleIntervalMs }) {
    let totalUsage = 0;
    let samples = 0;

    for (let index = 0; index < sampleCount; index += 1) {
        const before = readCpuTimes();
        await sleep(sampleIntervalMs);
        const after = readCpuTimes();

        let idleDelta = 0;
        let totalDelta = 0;
        for (let cpuIndex = 0; cpuIndex < before.length; cpuIndex += 1) {
            idleDelta += after[cpuIndex].idle - before[cpuIndex].idle;
            totalDelta += after[cpuIndex].total - before[cpuIndex].total;
        }
        if (totalDelta <= 0) {
            continue;
        }

        totalUsage += (1 - (idleDelta / totalDelta)) * 100;
        samples += 1;
    }

    return samples > 0 ? totalUsage / samples : 0;
}

export async function evaluateBudgetGate({ group = 'e2e', weight = 1, cwd = process.cwd() } = {}) {
    const config = readBudgetConfig(group);
    const entries = await listGlobalHeavyBudgetEntries({ cwd });
    const totalWeight = sumWeight(entries);
    const groupWeight = sumWeight(entries, entry => entry.group === normalizeName(group, 'default'));
    const cpuUsagePercent = await sampleCpuUsagePercent({
        sampleCount: config.cpuSampleCount,
        sampleIntervalMs: config.cpuSampleIntervalMs,
    });
    const freeMemoryGb = os.freemem() / (1024 ** 3);
    const projectedTotalWeight = totalWeight + weight;
    const projectedGroupWeight = groupWeight + weight;
    let allowed = true;
    let reason = '';

    if (cpuUsagePercent >= config.cpuHardLimit) {
        allowed = false;
        reason = `CPU 过高：${cpuUsagePercent.toFixed(1)}% >= ${config.cpuHardLimit}%`;
    } else if (freeMemoryGb < config.memoryMinFreeGb) {
        allowed = false;
        reason = `可用内存不足：${freeMemoryGb.toFixed(2)}GB < ${config.memoryMinFreeGb}GB`;
    } else if (entries.length > 0 && cpuUsagePercent >= config.cpuSoftLimit) {
        allowed = false;
        reason = `CPU 已处于高压区：${cpuUsagePercent.toFixed(1)}% >= ${config.cpuSoftLimit}%`;
    }

    return {
        allowed,
        reason,
        snapshot: {
            totalWeight,
            groupWeight,
            projectedTotalWeight,
            projectedGroupWeight,
            activeEntryCount: entries.length,
            cpuUsagePercent,
            freeMemoryGb,
            config,
            entries,
        },
    };
}

export function formatGlobalHeavyBudgetEntry(entry) {
    return [
        `group=${entry.group}`,
        `weight=${entry.weight}`,
        `pid=${entry.pid}`,
        `worktree=${entry.worktreeName}`,
        entry.command ? `command=${entry.command}` : '',
        entry.startedAt ? `startedAt=${entry.startedAt}` : '',
    ].filter(Boolean).join(' | ');
}

export function formatGlobalHeavyBudgetStatus(status) {
    const lines = [];
    lines.push(status.reason || '预算检查通过');
    lines.push(`activeEntries=${status.snapshot.activeEntryCount}`);
    lines.push(`totalWeight=${status.snapshot.totalWeight} -> ${status.snapshot.projectedTotalWeight}`);
    lines.push(`groupWeight=${status.snapshot.groupWeight} -> ${status.snapshot.projectedGroupWeight}`);
    lines.push(`cpu=${status.snapshot.cpuUsagePercent.toFixed(1)}%`);
    lines.push(`freeMemory=${status.snapshot.freeMemoryGb.toFixed(2)}GB`);
    if (status.snapshot.entries.length > 0) {
        lines.push('active:');
        for (const entry of status.snapshot.entries) {
            lines.push(`- ${formatGlobalHeavyBudgetEntry(entry)}`);
        }
    }
    return lines.join('\n');
}

export async function waitForHeavyResources({ group = 'e2e', weight = 1, cwd = process.cwd(), logger = console, waitForBudget = true, waitTimeoutMs, waitPollMs } = {}) {
    const config = readBudgetConfig(group);
    const startedAt = Date.now();
    while (true) {
        const status = await evaluateBudgetGate({ group, weight, cwd });
        if (status.allowed) return status;
        if (!waitForBudget || Date.now() - startedAt >= (waitTimeoutMs ?? config.waitTimeoutMs)) throw new Error(formatGlobalHeavyBudgetStatus(status));
        logger.log?.(`[global-heavy-budget] 启动前资源压力过高，等待重采样: ${status.reason}`);
        await sleep(waitPollMs ?? config.waitPollMs);
    }
}

export async function acquireGlobalHeavyBudget({
    group,
    weight,
    command = '',
    metadata = {},
    logger = console,
    cwd = process.cwd(),
    waitForBudget,
    waitTimeoutMs,
    waitPollMs,
    bypass = process.env.BG_BYPASS_GLOBAL_HEAVY_BUDGET === '1',
} = {}) {
    if (bypass) {
        logger.log?.('[global-heavy-budget] 已显式绕过全局预算门控。');
        return {
            release() {},
            entry: null,
            bypassed: true,
            status: null,
            async waitForResources() {},
        };
    }

    const normalizedGroup = normalizeName(group, 'default');
    const config = readBudgetConfig(normalizedGroup);
    const normalizedWeight = Math.max(1, Number(weight || config.weight));
    const shouldWait = waitForBudget ?? config.waitForBudget;
    const timeoutMs = waitTimeoutMs ?? config.waitTimeoutMs;
    const pollMs = waitPollMs ?? config.waitPollMs;
    const startedAt = Date.now();
    const entryId = `${normalizedGroup}-${process.pid}-${randomUUID()}`;

    while (true) {
        let status;
        try {
            await pruneGlobalHeavyBudget({ logger, cwd });
            status = await evaluateBudgetGate({
                group: normalizedGroup,
                weight: normalizedWeight,
                cwd,
            });
        } catch (error) {
            if (!shouldWait || !isRegistryLockContention(error) || (Date.now() - startedAt >= timeoutMs)) {
                throw error;
            }

            logger.log?.(`[global-heavy-budget] 注册表锁忙，${Math.ceil(pollMs / 1000)}s 后重试。原因: ${error instanceof Error ? error.message : String(error)}`);
            await sleep(pollMs);
            continue;
        }

        if (status.allowed) {
            const entry = normalizeEntry({
                entryId,
                pid: process.pid,
                group: normalizedGroup,
                weight: normalizedWeight,
                worktreeRoot: getWorktreeRoot(cwd),
                command: command || process.argv.join(' '),
                metadata,
            }, cwd);

            try {
                await withRegistryLock(async () => {
                    const registry = readRegistry(cwd);
                    const activeEntries = [];
                    for (const rawEntry of registry.entries ?? []) {
                        const normalizedEntry = normalizeEntry(rawEntry, cwd);
                        if (!inspectEntry(normalizedEntry).stale) {
                            activeEntries.push(normalizedEntry);
                        }
                    }

                    // 注册与启动之间重新采样，避免并发申请都消费同一个过时的资源快照。
                    const currentStatus = await evaluateBudgetGate({ group: normalizedGroup, weight: normalizedWeight, cwd });
                    if (!currentStatus.allowed) throw new Error(formatGlobalHeavyBudgetStatus(currentStatus));
                    status = currentStatus;

                    activeEntries.push(entry);
                    writeRegistry({ entries: activeEntries }, cwd);
                }, cwd);
            } catch (error) {
                if (!shouldWait || (Date.now() - startedAt >= timeoutMs)) {
                    throw error;
                }

                logger.log?.(`[global-heavy-budget] 资源检查或登记竞争，${Math.ceil(pollMs / 1000)}s 后重试。原因: ${error instanceof Error ? error.message : String(error)}`);
                await sleep(pollMs);
                continue;
            }

            const heartbeat = setInterval(() => {
                withRegistryLock(async () => {
                    const registry = readRegistry(cwd);
                    registry.entries = (registry.entries ?? []).map(rawEntry => {
                        const normalizedEntry = normalizeEntry(rawEntry, cwd);
                        if (normalizedEntry.entryId !== entryId) {
                            return normalizedEntry;
                        }
                        return normalizeEntry({
                            ...normalizedEntry,
                            updatedAt: nowIso(),
                            leaseExpiresAt: new Date(Date.now() + HEARTBEAT_TTL_MS).toISOString(),
                        }, cwd);
                    });
                    writeRegistry(registry, cwd);
                }, cwd).catch(() => {
                    // ignore heartbeat write failure
                });
            }, HEARTBEAT_INTERVAL_MS);
            if (typeof heartbeat.unref === 'function') {
                heartbeat.unref();
            }

            let released = false;
            const release = () => {
                if (released) {
                    return;
                }
                released = true;
                clearInterval(heartbeat);

                const releasePromise = withRegistryLock(async () => {
                    const registry = readRegistry(cwd);
                    registry.entries = (registry.entries ?? [])
                        .map(rawEntry => normalizeEntry(rawEntry, cwd))
                        .filter(existingEntry => existingEntry.entryId !== entryId);
                    writeRegistry(registry, cwd);
                }, cwd).catch(() => {
                    // ignore release failure
                });

                process.removeListener('exit', release);
                return releasePromise;
            };

            process.once('exit', release);
            logger.log?.(`[global-heavy-budget] 资源检查通过: CPU=${status.snapshot.cpuUsagePercent.toFixed(1)}%, 可用内存=${status.snapshot.freeMemoryGb.toFixed(2)}GB, 其它活跃任务=${status.snapshot.activeEntryCount}（不设任务数量上限）。`);
            return {
                release,
                entry,
                bypassed: false,
                status,
                waitForResources: () => waitForHeavyResources({ group: normalizedGroup, weight: normalizedWeight, cwd, logger, waitForBudget: shouldWait, waitTimeoutMs: timeoutMs, waitPollMs: pollMs }),
            };
        }

        if (!shouldWait || (Date.now() - startedAt >= timeoutMs)) {
            throw new Error(formatGlobalHeavyBudgetStatus(status));
        }

        logger.log?.(`[global-heavy-budget] 当前资源压力过高，${Math.ceil(pollMs / 1000)}s 后重试。原因: ${status.reason}`);
        await sleep(pollMs);
    }
}

function printStatus(entries) {
    console.log(`Global heavy budget registry: ${getRegistryFilePath()}`);
    if (entries.length === 0) {
        console.log('No active global heavy budget entries.');
        return;
    }

    const totalWeight = sumWeight(entries);
    console.log(`Active entries: ${entries.length}`);
    console.log(`Total weight: ${totalWeight}`);
    for (const entry of entries) {
        console.log('---');
        console.log(formatGlobalHeavyBudgetEntry(entry));
    }
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    const command = (process.argv[2] || 'status').trim().toLowerCase();
    if (command === 'status') {
        await pruneGlobalHeavyBudget();
        const entries = await listGlobalHeavyBudgetEntries();
        printStatus(entries);
    } else {
        console.error('用法: node scripts/infra/global-heavy-budget.mjs [status]');
        process.exit(1);
    }
}
