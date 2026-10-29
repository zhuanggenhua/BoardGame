import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { capturePrivateFeedbackReplay } from '../feedbackPrivateReplay';
import { FeedbackReplayStaging } from '../feedbackReplayStaging';

describe('反馈提交前冻结现场', () => {
    it('后续对局变化不会改变首个现场，且仅对应座位可绑定', () => {
        const match = { matchID: 'match', gameId: 'game', stateID: 1, randomSeed: 'seed', getRandomCursor: () => 5,
            state: { core: { health: 10 }, sys: {} } } as any;
        const staging = new FeedbackReplayStaging();
        const id = staging.prepare('match', '0', capturePrivateFeedbackReplay(match).data!);
        match.state.core.health = 3;
        match.stateID = 2;
        expect(staging.get(id, 'match', '1')).toBeUndefined();
        expect(staging.get(id, 'other', '0')).toBeUndefined();
        const archive = JSON.parse(gunzipSync(Buffer.from(staging.get(id, 'match', '0')!, 'base64')).toString());
        expect(archive.state.core.health).toBe(10);
        expect(archive.stateId).toBe(1);
    });
    it('过期或容量耗尽时明确拒绝，不覆盖已有现场', () => {
        let now = 0;
        const staging = new FeedbackReplayStaging(() => now, 10, 1);
        const id = staging.prepare('match', '0', 'first');
        expect(() => staging.prepare('match', '0', 'second')).toThrow('feedback_capture_staging_full');
        expect(staging.get(id, 'match', '0')).toBe('first');
        now = 11;
        expect(staging.get(id, 'match', '0')).toBeUndefined();
        expect(staging.prepare('match', '0', 'second')).toBeTruthy();
    });
});
