import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BattleCaptureDiagnosticsError, createBattleCaptureDiagnostics } from '../../../../e2e/qidahen/battleCaptureDiagnostics';

describe('battle screencast capture diagnostics', () => {
    for (const mode of ['sync', 'queued'] as const) {
        it(`${mode} 保留原始帧顺序与合成时间，并在写盘和确认完成后返回`, async () => {
            const events: string[] = [];
            const images = new Map<string, string>();
            let clock = 100;
            const capture = createBattleCaptureDiagnostics({
                mode,
                pathForIndex: index => `${index}.jpg`,
                now: () => ++clock,
                ack: async id => { events.push(`ack ${id}`); },
                writeSync: (path, data) => { events.push(`write ${path}`); images.set(path, data.toString()); },
                writeAsync: async (path, data) => { events.push(`write ${path}`); images.set(path, data.toString()); },
            });
            const base = Date.now() / 1000;
            capture.receive({ data: Buffer.from('first').toString('base64'), sessionId: 1, metadata: { timestamp: base } });
            capture.receive({ data: Buffer.from('second').toString('base64'), sessionId: 2, metadata: { timestamp: base + 0.01 } });
            const result = await capture.finish();
            expect(result.frames.map(frame => [frame.path, frame.at])).toEqual([['0.jpg', base], ['1.jpg', base + 0.01]]);
            expect([...images.entries()]).toEqual([['0.jpg', 'first'], ['1.jpg', 'second']]);
            expect(result.timings.every(t => t.ackSentAtMs && t.ackDoneAtMs && t.writeStartAtMs && t.writeDoneAtMs)).toBe(true);
            expect(events.indexOf('ack 1') < events.indexOf('write 0.jpg')).toBe(mode === 'queued');
        });
    }

    it('异步写入失败会使采集明确失败，仍确认已经收到的帧', async () => {
        let acked = false;
        const capture = createBattleCaptureDiagnostics({
            mode: 'queued', pathForIndex: () => '0.jpg',
            ack: async () => { acked = true; },
            writeAsync: async () => { throw new Error('disk failed'); },
        });
        capture.receive({ data: 'YQ==', sessionId: 1, metadata: { timestamp: Date.now() / 1000 } });
        const failure = await capture.finish().catch(error => error as BattleCaptureDiagnosticsError);
        expect(failure).toBeInstanceOf(BattleCaptureDiagnosticsError);
        expect((failure as BattleCaptureDiagnosticsError).message).toContain('disk failed');
        expect((failure as BattleCaptureDiagnosticsError).report.frames).toHaveLength(1);
        expect(acked).toBe(true);
    });

    it('队列使用真实异步文件接口写入原始字节', async () => {
        const dir = await mkdtemp(join(tmpdir(), 'qidahen-capture-test-'));
        try {
            const capture = createBattleCaptureDiagnostics({ mode: 'queued', pathForIndex: () => join(dir, 'frame.jpg'), ack: async () => {} });
            capture.receive({ data: 'YQ==', sessionId: 1, metadata: { timestamp: Date.now() / 1000 } });
            await capture.finish();
            expect(await readFile(join(dir, 'frame.jpg'), 'utf8')).toBe('a');
        } finally {
            await rm(dir, { recursive: true });
        }
    });
});
