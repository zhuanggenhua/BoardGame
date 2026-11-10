import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** 以 SQLite 事务持有跨进程锁；进程退出时由操作系统释放。 */
export async function withSqliteProcessLock(lockPath, task, { timeoutMs = 10000, pollMs = 100 } = {}) {
    fs.mkdirSync(path.dirname(path.resolve(lockPath)), { recursive: true });
    const db = new DatabaseSync(lockPath, { timeout: 0 });
    let locked = false;
    let primaryError;
    const started = Date.now();
    try {
        while (!locked) {
            try {
                db.exec('BEGIN IMMEDIATE');
                locked = true;
            } catch (error) {
                const code = Number(error?.errcode) & 0xff;
                if (![5, 6].includes(code)) throw error;
                if (Date.now() - started >= timeoutMs) throw new Error(`等待跨进程锁超时: ${lockPath}`, { cause: error });
                await sleep(pollMs);
            }
        }
        const result = await task();
        db.exec('COMMIT');
        locked = false;
        return result;
    } catch (error) {
        primaryError = error;
        throw error;
    } finally {
        const errors = [];
        try { if (locked) db.exec('ROLLBACK'); } catch (error) { errors.push(error); }
        try { db.close(); } catch (error) { errors.push(error); }
        if (errors.length) throw new AggregateError(primaryError ? [primaryError, ...errors] : errors, `释放跨进程锁失败: ${lockPath}`);
    }
}
