import { describe, expect, it } from 'vitest';
import { buildGameFeedbackActionLog, buildGameFeedbackStateSnapshot } from '../feedback/gameFeedbackDiagnostics';

describe('gameFeedbackDiagnostics', () => {
    it('说明联网撤回点数量和实际采集的快照数量', () => {
        const result = JSON.parse(buildGameFeedbackActionLog({
            core: {}, sys: { undo: { snapshots: [], snapshotCount: 3 } },
        } as any)!);
        expect(result.undoCapture).toEqual({ availableCount: 3, capturedCount: 0 });
    });

    it('操作与事件尾流只输出定位字段，不序列化任意 payload 和日志正文', () => {
        const secret = 'hidden-card-option-canary';
        const action = {
            id: 'a1', timestamp: 1000, actorId: '0', kind: 'ROLL',
            segments: [{ type: 'text', text: secret }],
        };
        const event = {
            id: 7,
            event: { type: 'DICE_ROLLED', timestamp: 1001, payload: { dice: [6], cardId: secret } },
        };
        const result = JSON.parse(buildGameFeedbackActionLog({
            core: {},
            sys: { actionLog: { entries: [action] }, eventStream: { entries: [event] }, undo: { snapshots: [] } },
        } as any)!);

        expect(result.actionLogTail).toEqual([{ timestamp: 1000, actorId: '0', kind: 'ROLL', segmentCount: 1 }]);
        expect(result.eventStreamTail).toEqual([{ id: 7, event: { type: 'DICE_ROLLED', timestamp: 1001 } }]);
        expect(JSON.stringify(result)).not.toContain(secret);
    });

    it('用户状态快照保留阶段与结算摘要但排除手牌、选项、随机种子和撤回原状态', () => {
        const secret = 'private-card-option-seed-canary';
        const hiddenFaction = 'hidden-faction-selection-canary';
        const playerMapping = 'private-player-map-canary';
        const snapshot = JSON.parse(buildGameFeedbackStateSnapshot({
            core: {
                currentPlayer: '0',
                pendingDamageAllocation: { playerId: '0', amount: 2, damageKind: 'physical' },
                players: { '0': { hand: [{ id: secret }] } },
                selectedFactions: { [playerMapping]: hiddenFaction },
                factionSelection: { takenFactions: [hiddenFaction], playerSelections: { [playerMapping]: [hiddenFaction] } },
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 7,
                revision: 42,
                decisionEpoch: 9,
                randomSeed: secret,
                interaction: { current: { id: 'choice-1', kind: 'simple-choice', data: { options: [{ id: secret }] } } },
                responseWindow: { current: { id: 'response-1', windowType: 'before-damage', sourceId: secret } },
                actionLog: { entries: [{ id: 'log-1', kind: 'DAMAGE', text: secret }] },
                eventStream: { entries: [{ id: 3, event: { type: 'DAMAGE', timestamp: 12, payload: { cardId: secret } } }] },
                undo: { snapshots: [{ core: { hand: [secret] } }] },
            },
        } as any)!);

        expect(snapshot.sys).toMatchObject({ phase: 'defensiveRoll', turnNumber: 7, revision: 42, decisionEpoch: 9 });
        expect(snapshot.core.pendingDamageAllocation).toMatchObject({ amount: 2, damageKind: 'physical' });
        expect(JSON.stringify(snapshot)).not.toContain(secret);
        expect(JSON.stringify(snapshot)).not.toContain(hiddenFaction);
        expect(JSON.stringify(snapshot)).not.toContain(playerMapping);
        expect(JSON.stringify(snapshot)).not.toContain('randomSeed');
        expect(JSON.stringify(snapshot)).not.toContain('hand');
    });

    it('派系摘要保留公开事件类别，但不公开派系选择或操作日志正文', () => {
        const actionLog = buildGameFeedbackActionLog({
            core: {
                currentExplorer: { playerId: '0', displayName: '薇薇安' },
                otherExplorers: [{ playerId: '1', displayName: '布兰登' }],
                selectedFactions: { '0': 'steampunks_pod', '1': 'ghosts' },
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
                                playerId: '0', event: '无线电广播', roll: '投 2 颗骰子', total: 2,
                                result: '受到一颗骰子的精神伤害',
                            },
                        }],
                    }],
                },
                eventStream: { entries: [] },
                undo: { snapshots: [] },
            },
        } as any)!;

        expect(actionLog).toContain('ROOM_EXPLORED');
        expect(actionLog).not.toContain('steampunks_pod');
        expect(actionLog).not.toContain('ghosts');
        expect(actionLog).not.toContain('薇薇安');
        expect(actionLog).not.toContain('无线电广播');
        expect(actionLog).not.toContain('受到一颗骰子的精神伤害');
    });
});
