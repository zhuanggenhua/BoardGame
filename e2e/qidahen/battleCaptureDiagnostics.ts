import { writeFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

export type CaptureMode = 'sync' | 'queued';
type CaptureFrame = { path: string; at: number; startedAt: number; endedAt: number; source: 'screencast' };
type FrameEvent = { data: string; sessionId: number; metadata: { timestamp?: number } };
type Timing = { index: number; compositorAt: number; receivedAtMs: number; ackSentAtMs?: number; ackDoneAtMs?: number; writeStartAtMs?: number; writeDoneAtMs?: number; bytes: number };
type CaptureReport = { frames: CaptureFrame[]; timings: Timing[]; maxPendingBytes: number; mode: CaptureMode; timebase: string };

export class BattleCaptureDiagnosticsError extends Error {
    constructor(message: string, public readonly report: CaptureReport) { super(message); }
}

/** 诊断专用：保留每帧原始合成时间，不插帧；队列失败必须显式失败。 */
export function createBattleCaptureDiagnostics(options: {
    mode: CaptureMode;
    pathForIndex: (index: number) => string;
    ack: (sessionId: number) => Promise<unknown>;
    writeSync?: (path: string, data: Buffer) => void;
    writeAsync?: (path: string, data: Buffer) => Promise<void>;
    now?: () => number;
}) {
    const frames: CaptureFrame[] = [];
    const timings: Timing[] = [];
    const acks: Promise<void>[] = [];
    const now = options.now ?? (() => performance.timeOrigin + performance.now());
    const writeSync = options.writeSync ?? writeFileSync;
    const writeAsync = options.writeAsync ?? writeFile;
    let pendingWrites = Promise.resolve();
    let failure: unknown;
    let pendingBytes = 0;
    let maxPendingBytes = 0;
    const maxQueueBytes = 192 * 1024 * 1024;

    function receive(event: FrameEvent) {
        const receivedAtMs = now();
        const at = event.metadata.timestamp;
        const timing: Timing = { index: timings.length, compositorAt: at ?? NaN, receivedAtMs, bytes: 0 };
        timings.push(timing);
        const acknowledge = () => {
            timing.ackSentAtMs = now();
            try {
                acks.push(options.ack(event.sessionId).then(() => { timing.ackDoneAtMs = now(); }, error => { failure ??= error; }));
            } catch (error) { failure ??= error; }
        };
        try {
            if (typeof at !== 'number' || Math.abs(at - Date.now() / 1000) > 60) throw new Error('Missing or invalid compositor timestamp');
            const path = options.pathForIndex(timing.index);
            const frame: CaptureFrame = { path, at, startedAt: at, endedAt: at, source: 'screencast' };
            if (options.mode === 'sync') {
                const data = Buffer.from(event.data, 'base64');
                timing.bytes = data.length;
                timing.writeStartAtMs = now();
                writeSync(path, data);
                timing.writeDoneAtMs = now();
                frames.push(frame);
                acknowledge();
            } else {
                // 先确认再排队写盘；保留原数据，队列过大时整个诊断明确失败。
                acknowledge();
                const data = Buffer.from(event.data, 'base64');
                timing.bytes = data.length;
                pendingBytes += data.length;
                maxPendingBytes = Math.max(maxPendingBytes, pendingBytes);
                if (pendingBytes > maxQueueBytes) throw new Error('Battle capture diagnostics queue exceeded 192 MiB');
                frames.push(frame);
                pendingWrites = pendingWrites.then(async () => {
                    timing.writeStartAtMs = now();
                    await writeAsync(path, data);
                    timing.writeDoneAtMs = now();
                    pendingBytes -= data.length;
                }).catch(error => { failure ??= error; });
            }
        } catch (error) {
            failure ??= error;
            if (timing.ackSentAtMs === undefined) acknowledge();
        }
    }
    async function finish() {
        await pendingWrites;
        await Promise.all(acks);
        const report: CaptureReport = { frames, timings, maxPendingBytes, mode: options.mode, timebase: 'UTC milliseconds (Node monotonic clock anchored to time origin); compositorAt is UTC seconds' };
        if (failure) throw new BattleCaptureDiagnosticsError(String(failure), report);
        return report;
    }
    return { receive, finish, frames };
}
