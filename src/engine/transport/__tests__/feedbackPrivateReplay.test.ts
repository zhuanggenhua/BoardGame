import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { capturePrivateFeedbackReplay } from '../feedbackPrivateReplay';

describe('权威故障现场采集', () => {
    it('保存触发时的权威状态、撤回点与随机游标，之后状态变化不改变现场', () => {
        const match = {
            matchID: 'm1', gameId: 'dicethrone', stateID: 21, randomSeed: 'secret-seed', getRandomCursor: () => 7,
            state: { core: { secretHand: ['card-1'] }, sys: { phase: 'offensiveRoll', undo: { snapshots: [{ core: { health: 42 } }], snapshotCursors: [4] } } },
        } as any;
        const result = capturePrivateFeedbackReplay(match);
        expect(result.error).toBeUndefined();
        match.state.core.secretHand.push('later');
        const archive = JSON.parse(gunzipSync(Buffer.from(result.data!, 'base64')).toString('utf8'));
        expect(archive).toMatchObject({
            matchId: 'm1', gameId: 'dicethrone', stateId: 21, randomSeed: 'secret-seed', randomCursor: 7,
            state: { core: { secretHand: ['card-1'] }, sys: { undo: { snapshotCursors: [4] } } },
        });
        expect(archive.state.sys.undo.snapshots[0].core.health).toBe(42);
    });

    it('无法序列化时明确报告失败，不伪装成完整现场', () => {
        const state: any = { core: {}, sys: {} }; state.core.self = state;
        const result = capturePrivateFeedbackReplay({ matchID: 'm', gameId: 'g', stateID: 1, state } as any);
        expect(result.data).toBeUndefined();
        expect(result.error).toContain('private_replay_capture_failed');
    });
});
