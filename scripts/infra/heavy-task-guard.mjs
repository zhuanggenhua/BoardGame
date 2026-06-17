import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_HEARTBEAT_TTL_MS = 15000;
const GUARD_DIR = path.join(process.cwd(), '.tmp', 'heavy-task-guards');

function nowIso() {
    return new Date().toISOString();
}

function sanitizeGuardName(name) {
    const normalized = String(name ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '-');
    if (!normalized) {
        throw new Error('heavy-task-guard 需要有效的 name。');
    }
    return normalized;
}

function ensureGuardDir() {
    fs.mkdirSync(GUARD_DIR, { recursive: true });
}

function getGuardFilePath(name) {
    return path.join(GUARD_DIR, `${sanitizeGuardName(name)}.json`);
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

function readGuardRecord(name) {
    const filePath = getGuardFilePath(name);
    try {
        const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return {
            ...record,
            filePath,
            active: isGuardActive(record),
        };
    } catch {
        return null;
    }
}

function isGuardActive(record) {
    const pid = Number(record?.pid);
    if (!isPidAlive(pid)) {
        return false;
    }

    const leaseExpiresAt = Date.parse(record?.leaseExpiresAt ?? '');
    if (!Number.isFinite(leaseExpiresAt)) {
        return true;
    }

    return leaseExpiresAt > Date.now();
}

function isDirectParentGuardRecord(record) {
    const pid = Number(record?.pid);
    return Number.isInteger(pid) && pid > 0 && pid === process.ppid;
}

function removeGuardFile(name) {
    try {
        fs.unlinkSync(getGuardFilePath(name));
    } catch {
        // ignore
    }
}

function writeGuardRecord(name, record) {
    ensureGuardDir();
    fs.writeFileSync(
        getGuardFilePath(name),
        JSON.stringify(record, null, 2),
        'utf8',
    );
}

function compareGuardPriority(left, right) {
    const leftStarted = Date.parse(left?.startedAt ?? '') || 0;
    const rightStarted = Date.parse(right?.startedAt ?? '') || 0;
    if (leftStarted !== rightStarted) {
        return leftStarted - rightStarted;
    }

    const leftPid = Number(left?.pid) || 0;
    const rightPid = Number(right?.pid) || 0;
    return leftPid - rightPid;
}

function isSameGuardFamilyName(recordName, baseName) {
    const normalizedRecordName = sanitizeGuardName(recordName);
    const normalizedBaseName = sanitizeGuardName(baseName);
    return normalizedRecordName === normalizedBaseName
        || normalizedRecordName.startsWith(`${normalizedBaseName}--pid-`);
}

function listActiveGuardsByBaseName(baseName) {
    const normalizedBaseName = sanitizeGuardName(baseName);
    return listTaskGuards()
        .filter(record => isSameGuardFamilyName(record.name, normalizedBaseName));
}

function formatMetadata(metadata) {
    const pairs = Object.entries(metadata ?? {}).filter(([, value]) => (
        value !== undefined
        && value !== null
        && value !== ''
    ));

    if (pairs.length === 0) {
        return '';
    }

    return pairs
        .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
        .join(', ');
}

export function formatTaskGuardSummary(record) {
    if (!record) {
        return '未知重任务';
    }

    const summary = [
        `name=${record.name}`,
        `pid=${record.pid}`,
        record.command ? `command=${record.command}` : '',
        record.startedAt ? `startedAt=${record.startedAt}` : '',
        record.updatedAt ? `updatedAt=${record.updatedAt}` : '',
        record.metadata ? `metadata={${formatMetadata(record.metadata)}}` : '',
    ].filter(Boolean);

    return summary.join(' | ');
}

export function listTaskGuards({ includeStale = false } = {}) {
    ensureGuardDir();
    return fs.readdirSync(GUARD_DIR)
        .filter(file => file.endsWith('.json'))
        .map(file => {
            const filePath = path.join(GUARD_DIR, file);
            try {
                const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return {
                    ...record,
                    filePath,
                    active: isGuardActive(record),
                };
            } catch {
                return null;
            }
        })
        .filter(Boolean)
        .filter(record => includeStale || record.active);
}

export function pruneTaskGuards({ logger = console } = {}) {
    const removed = [];
    for (const record of listTaskGuards({ includeStale: true })) {
        if (record.active) {
            continue;
        }
        try {
            fs.unlinkSync(record.filePath);
            removed.push(record);
        } catch {
            // ignore
        }
    }

    if (removed.length > 0) {
        logger.log?.(`[heavy-task-guard] 已清理 ${removed.length} 个失效重任务锁。`);
    }

    return removed;
}

export function acquireTaskGuard({
    name,
    conflicts = [],
    command = '',
    metadata = {},
    logger = console,
    heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
    heartbeatTtlMs = DEFAULT_HEARTBEAT_TTL_MS,
    allowConcurrency = process.env.BG_ALLOW_HEAVY_TASK_CONCURRENCY === '1',
} = {}) {
    const normalizedName = sanitizeGuardName(name);
    const normalizedConflicts = [...new Set(conflicts.map(sanitizeGuardName))];
    const guardRecordName = allowConcurrency
        ? `${normalizedName}--pid-${process.pid}`
        : normalizedName;

    pruneTaskGuards({ logger });

    const existingSameGuard = listActiveGuardsByBaseName(normalizedName)
        .filter(record => Number(record.pid) !== process.pid)
        .sort(compareGuardPriority)[0];
    if (!allowConcurrency && existingSameGuard) {
        throw new Error(
            [
                `已有同类重任务在运行，拒绝重复启动: ${normalizedName}`,
                formatTaskGuardSummary(existingSameGuard),
                '如确需并发，请显式设置 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1。',
            ].join('\n'),
        );
    }

    const startedAt = nowIso();
    const state = {
        name: guardRecordName,
        pid: process.pid,
        startedAt,
        updatedAt: startedAt,
        leaseExpiresAt: new Date(Date.now() + heartbeatTtlMs).toISOString(),
        command: command || process.argv.join(' '),
        conflicts: normalizedConflicts,
        metadata,
    };

    writeGuardRecord(guardRecordName, state);

    if (!allowConcurrency) {
        const activeConflicts = normalizedConflicts
            .flatMap(conflictName => listActiveGuardsByBaseName(conflictName))
            .filter(record => Number(record.pid) !== process.pid)
            // 允许 quality-gate 之类的父流程拉起自己的子重任务，不把同一条链路误判成并发冲突。
            .filter(record => !isDirectParentGuardRecord(record));

        const blockingConflict = activeConflicts
            .sort(compareGuardPriority)[0];

        if (blockingConflict && compareGuardPriority(blockingConflict, state) <= 0) {
            removeGuardFile(guardRecordName);
            throw new Error(
                [
                    `检测到冲突重任务正在运行，拒绝并发启动: ${normalizedName} -> ${blockingConflict.name}`,
                    formatTaskGuardSummary(blockingConflict),
                    '如确需并发，请显式设置 BG_ALLOW_HEAVY_TASK_CONCURRENCY=1。',
                ].join('\n'),
            );
        }
    }

    const heartbeat = setInterval(() => {
        writeGuardRecord(guardRecordName, {
            ...state,
            updatedAt: nowIso(),
            leaseExpiresAt: new Date(Date.now() + heartbeatTtlMs).toISOString(),
        });
    }, heartbeatIntervalMs);
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

        const latest = readGuardRecord(guardRecordName);
        if (latest && Number(latest.pid) === process.pid) {
            removeGuardFile(guardRecordName);
        }

        process.removeListener('exit', release);
    };

    process.once('exit', release);

    return {
        release,
        record: state,
    };
}

function printStatus() {
    const guards = listTaskGuards({ includeStale: true });
    console.log(`Heavy task guard dir: ${GUARD_DIR}`);
    if (guards.length === 0) {
        console.log('No heavy task guards found.');
        return;
    }

    for (const guard of guards) {
        console.log('---');
        console.log(`status: ${guard.active ? 'active' : 'stale'}`);
        console.log(formatTaskGuardSummary(guard));
    }
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    const command = (process.argv[2] || 'status').trim().toLowerCase();
    if (command === 'status') {
        pruneTaskGuards();
        printStatus();
    } else {
        console.error('用法: node scripts/infra/heavy-task-guard.mjs [status]');
        process.exit(1);
    }
}
