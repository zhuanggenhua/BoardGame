import fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withWindowsHide } from './windows-hide.js';

const execFileAsync = promisify(execFile);
let ownIdentity = null;
let lastQueryWarningAt = 0;

/** 在锁外批量查询；查询失败或平台不支持时保留未知身份。 */
export async function getHeavyProcessIdentities(pids) {
    const unique = [...new Set(pids.filter(pid => Number.isInteger(pid) && pid > 0))];
    const result = new Map();
    if (ownIdentity && unique.includes(process.pid)) result.set(process.pid, ownIdentity);
    const pending = unique.filter(pid => !result.has(pid));
    if (!pending.length) return result;
    try {
        if (process.platform === 'win32') {
            const script = `foreach ($targetProcessId in @(${pending.join(',')})) { try { $targetProcess = Get-Process -Id $targetProcessId -ErrorAction Stop; Write-Output ("{0}:{1}" -f $targetProcessId,$targetProcess.StartTime.ToUniversalTime().Ticks) } catch {} }`;
            const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
                withWindowsHide({ encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 }));
            for (const line of stdout.split(/\r?\n/)) {
                const match = line.trim().match(/^(\d+):(\d+)$/);
                if (match) result.set(Number(match[1]), `windows:${match[2]}`);
            }
        } else if (process.platform === 'linux') {
            const bootId = (await fs.readFile('/proc/sys/kernel/random/boot_id', 'utf8')).trim();
            await Promise.all(pending.map(async pid => {
                try {
                    const stat = await fs.readFile(`/proc/${pid}/stat`, 'utf8');
                    const close = stat.lastIndexOf(')');
                    const fields = stat.slice(close + 2).split(' ');
                    if (close >= 0 && /^\d+$/.test(fields[19] ?? '') && bootId) result.set(pid, `linux:${bootId}:${fields[19]}`);
                } catch { /* 无法读取身份时保守保留。 */ }
            }));
        }
    } catch (error) {
        if (Date.now() - lastQueryWarningAt > 30000) {
            lastQueryWarningAt = Date.now();
            console.warn(`[global-heavy-budget] 无法查询进程实例身份，将保守保留活跃 PID: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (pending.some(pid => !result.has(pid) && isAlive(pid)) && Date.now() - lastQueryWarningAt > 30000) {
        lastQueryWarningAt = Date.now();
        console.warn('[global-heavy-budget] 部分活跃进程缺少实例身份，将保守保留登记。');
    }
    if (result.has(process.pid)) ownIdentity = result.get(process.pid);
    return result;
}

function isAlive(pid) {
    try { process.kill(pid, 0); return true; }
    catch (error) { return error?.code !== 'ESRCH'; }
}

export async function getHeavyProcessIdentity(pid) {
    return (await getHeavyProcessIdentities([pid])).get(pid) ?? null;
}
