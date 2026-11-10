import { describe, expect, it } from 'vitest';
import { gunzipSync } from 'node:zlib';
import { FeedbackReplayCommandHistory } from '../feedbackReplayCommandHistory';
import { capturePrivateFeedbackReplay } from '../feedbackPrivateReplay';

describe('权威反馈触发命令历史', () => {
    it('按对局、座位、命令和提交前 stateId 找回不可变的前后状态与 payload', () => {
        const history = new FeedbackReplayCommandHistory(() => 100);
        const before = { core: { hp: 50 }, sys: { stateId: 8 } };
        const after = { core: { hp: 43 }, sys: { stateId: 9 } };
        const payload = { interactionId: 'tree-choice', optionId: 'take-parley' };
        history.record({
            matchId: 'match-1',
            gameId: 'dicethrone',
            playerId: '0',
            commandType: 'RESOLVE_INTERACTION',
            commandPayload: payload,
            stateIdBefore: 8,
            stateIdAfter: 9,
            randomSeed: 'seed-1',
            randomCursorBefore: 21,
            randomCursorAfter: 22,
            stateBefore: before as any,
            stateAfter: after as any,
        });

        before.core.hp = 1;
        after.core.hp = 2;
        payload.optionId = 'mutated-after-submit';

        const reference = {
            commandType: 'RESOLVE_INTERACTION',
            playerId: '0',
            stateIdBefore: 8,
            randomCursorBefore: 21,
        };
        const command = history.find('match-1', '0', reference)!;
        expect(command).toMatchObject({
            commandPayload: { interactionId: 'tree-choice', optionId: 'take-parley' },
            stateBefore: { core: { hp: 50 } },
            stateAfter: { core: { hp: 43 } },
            randomSeed: 'seed-1',
            randomCursorBefore: 21,
            randomCursorAfter: 22,
        });
        const replay = capturePrivateFeedbackReplay({
            matchID: command.matchId,
            gameId: command.gameId,
            stateID: command.stateIdBefore,
            state: command.stateBefore,
            randomSeed: command.randomSeed,
            getRandomCursor: () => command.randomCursorBefore!,
        }, {
            source: 'player-command-feedback',
            commandType: command.commandType,
            playerId: command.playerId,
            payload: command.commandPayload,
            requestId: reference.requestId,
            stateIdBefore: command.stateIdBefore,
            stateIdAfter: command.stateIdAfter,
            randomCursorBefore: command.randomCursorBefore,
            randomCursorAfter: command.randomCursorAfter,
            stateAfter: command.stateAfter,
        });
        const archive = JSON.parse(gunzipSync(Buffer.from(replay.data!, 'base64')).toString('utf8'));
        expect(archive).toMatchObject({
            stateId: 8,
            randomSeed: 'seed-1',
            randomCursor: 21,
            state: { core: { hp: 50 } },
            trigger: {
                source: 'player-command-feedback',
                commandType: 'RESOLVE_INTERACTION',
                playerId: '0',
                payload: { interactionId: 'tree-choice', optionId: 'take-parley' },
                stateIdBefore: 8,
                stateIdAfter: 9,
                randomCursorBefore: 21,
                randomCursorAfter: 22,
                stateAfter: { core: { hp: 43 } },
            },
        });
    });

    it('不能跨对局、玩家、命令、状态游标或过期窗口取用现场', () => {
        let now = 100;
        const history = new FeedbackReplayCommandHistory(() => now, 50, 3, 4);
        history.record({
            matchId: 'match-1',
            gameId: 'dicethrone',
            playerId: '0',
            commandType: 'ADVANCE_PHASE',
            commandPayload: {},
            stateIdBefore: 8,
            stateIdAfter: 9,
            stateBefore: { core: {}, sys: {} } as any,
            stateAfter: { core: {}, sys: {} } as any,
        });
        const reference = { commandType: 'ADVANCE_PHASE', playerId: '0', stateIdBefore: 8 };
        expect(history.find('other-match', '0', reference)).toBeUndefined();
        expect(history.find('match-1', '1', reference)).toBeUndefined();
        expect(history.find('match-1', '0', { ...reference, commandType: 'CANCEL' })).toBeUndefined();
        expect(history.find('match-1', '0', { ...reference, stateIdBefore: 7 })).toBeUndefined();
        now = 151;
        expect(history.find('match-1', '0', reference)).toBeUndefined();
    });

    it('无法冻结非序列化命令时返回失败且不让采集异常中断对局', () => {
        const history = new FeedbackReplayCommandHistory();
        const recorded = history.record({
            matchId: 'match-1',
            gameId: 'dicethrone',
            playerId: '0',
            commandType: 'INVALID_TEST_ONLY',
            commandPayload: () => undefined,
            stateIdBefore: 1,
            stateIdAfter: 2,
            stateBefore: { core: {}, sys: {} } as any,
            stateAfter: { core: {}, sys: {} } as any,
        });
        expect(recorded).toBe(false);
        expect(history.find('match-1', '0', {
            commandType: 'INVALID_TEST_ONLY',
            playerId: '0',
            stateIdBefore: 1,
        })).toBeUndefined();
    });
});
