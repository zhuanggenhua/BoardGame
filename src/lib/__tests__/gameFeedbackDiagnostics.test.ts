import { describe, expect, it } from 'vitest';
import { buildGameFeedbackActionLog } from '../feedback/gameFeedbackDiagnostics';

describe('gameFeedbackDiagnostics', () => {
    it('说明联网撤回点数量和实际采集的快照数量', () => {
        const result = JSON.parse(buildGameFeedbackActionLog({
            core: {}, sys: { undo: { snapshots: [], snapshotCount: 3 } },
        } as any)!);
        expect(result.undoCapture).toEqual({ availableCount: 3, capturedCount: 0 });
    });
    it('保留真实操作条目和事件流的结构与内容', () => {
        const action = { id: 'a1', timestamp: 1000, actorId: '0', kind: 'ROLL', segments: [{ type: 'text', text: '掷出 6' }] };
        const event = { id: 7, event: { type: 'DICE_ROLLED', timestamp: 1001, payload: { dice: [6] } } };
        const result = JSON.parse(buildGameFeedbackActionLog({
            core: {},
            sys: { actionLog: { entries: [action] }, eventStream: { entries: [event] }, undo: { snapshots: [] } },
        } as any)!);

        expect(result.actionLogTail).toEqual([action]);
        expect(result.eventStreamTail).toEqual([event]);
    });
    it('兜底操作记录使用游戏状态里的玩家名和事件结果', () => {
        const actionLog = buildGameFeedbackActionLog({
            core: {
                currentExplorer: { playerId: '0', displayName: '薇薇安' },
                otherExplorers: [{ playerId: '1', displayName: '布兰登' }],
            },
            sys: {
                phase: 'play',
                turnNumber: 3,
                actionLog: {
                    maxEntries: 50,
                    entries: [{
                        id: 'radio-roll-result',
                        timestamp: 1000,
                        actorId: '0',
                        kind: 'ROOM_EXPLORED',
                        segments: [{
                            type: 'i18n',
                            ns: 'game-betrayal',
                            key: 'actionLog.eventRollResult',
                            params: {
                                playerId: '0',
                                event: '无线电广播',
                                roll: '投 2 颗骰子',
                                total: 2,
                                result: '受到一颗骰子的精神伤害',
                            },
                        }],
                    }],
                },
                eventStream: { entries: [] },
                undo: { snapshots: [] },
            },
        } as any);

        expect(actionLog).toContain('薇薇安');
        expect(actionLog).toContain('无线电广播');
        expect(actionLog).toContain('受到一颗骰子的精神伤害');
        expect(actionLog).not.toContain('玩家0');
        expect(actionLog).not.toContain('玩家 0');
    });
});
