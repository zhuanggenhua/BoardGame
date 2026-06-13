import { describe, expect, it } from 'vitest';
import {
    buildSelectPlayerDecisionActions,
    enumerateAiDecisionSelections,
    type AiSelectPlayerDecisionDescriptor,
} from '../decisionSemantics';

const createSelectPlayerDecision = (
    interactionId: string,
    playerIds: string[],
    selection: AiSelectPlayerDecisionDescriptor['selection'] = { min: 1, max: 1 },
): AiSelectPlayerDecisionDescriptor => ({
    kind: 'select-player',
    interactionId,
    actorPlayerId: '0',
    candidates: playerIds.map((playerId) => ({
        id: playerId,
        playerId,
        label: `玩家 ${playerId}`,
    })),
    selection,
});

describe('AI decision semantics', () => {
    it('不同交互外壳可映射到同一个选择玩家语义', () => {
        const firstDecision = createSelectPlayerDecision('simple-choice-shell', ['1', '2']);
        const secondDecision = createSelectPlayerDecision('custom-shell', ['1', '2']);

        const firstActions = buildSelectPlayerDecisionActions({
            descriptor: firstDecision,
            buildCommands: (selection) => [{
                type: 'RESPOND_INTERACTION',
                payload: { selectedPlayerId: selection[0]?.playerId },
            }],
        });
        const secondActions = buildSelectPlayerDecisionActions({
            descriptor: secondDecision,
            buildCommands: (selection) => [{
                type: 'RESOLVE_CUSTOM_TARGET',
                payload: { selectedPlayerId: selection[0]?.playerId },
            }],
        });

        expect(firstActions.map((action) => action.kind)).toEqual(['interaction-select-player', 'interaction-select-player']);
        expect(secondActions.map((action) => action.kind)).toEqual(['interaction-select-player', 'interaction-select-player']);
        expect(firstActions.map((action) => action.label)).toEqual(secondActions.map((action) => action.label));
        expect(firstActions[0].actionId).toContain('1');
        expect(firstActions[1].actionId).toContain('2');
        expect(firstActions[0].commands[0].type).toBe('RESPOND_INTERACTION');
        expect(secondActions[0].commands[0].type).toBe('RESOLVE_CUSTOM_TARGET');
    });

    it('选择数量由公共层生成组合，游戏层只负责命令适配', () => {
        const decision = createSelectPlayerDecision('choose-two', ['1', '2', '3'], { min: 2, max: 2 });
        const actions = buildSelectPlayerDecisionActions({
            descriptor: decision,
            buildCommands: (selection) => [{
                type: 'SELECT_PAIR',
                payload: { playerIds: selection.map((candidate) => candidate.playerId) },
            }],
        });

        expect(actions).toHaveLength(3);
        expect(actions.map((action) => action.commands[0].payload)).toEqual([
            { playerIds: ['1', '2'] },
            { playerIds: ['1', '3'] },
            { playerIds: ['2', '3'] },
        ]);
    });

    it('有序多选会保留不同选择顺序', () => {
        const decision = createSelectPlayerDecision('ordered', ['1', '2'], { min: 2, max: 2, ordered: true });
        const selections = enumerateAiDecisionSelections(decision.candidates, decision.selection);

        expect(selections.map((selection) => selection.map((candidate) => candidate.playerId))).toEqual([
            ['1', '2'],
            ['2', '1'],
        ]);
    });

    it('空候选可生成明确 fallback，避免 AI 阻塞静默无动作', () => {
        const decision = createSelectPlayerDecision('empty', [], { min: 1, max: 1 });
        const actions = buildSelectPlayerDecisionActions({
            descriptor: decision,
            emptyAction: (descriptor) => ({
                actionId: `cancel:${descriptor.interactionId}`,
                kind: 'interaction-cancel',
                label: '取消空交互',
                commands: [{
                    type: 'SYS_INTERACTION_CANCEL',
                    payload: { interactionId: descriptor.interactionId, reason: 'empty-options' },
                }],
            }),
            buildCommands: (selection) => [{
                type: 'SHOULD_NOT_RUN',
                payload: { playerId: selection[0]?.playerId },
            }],
        });

        expect(actions).toHaveLength(1);
        expect(actions[0].commands[0]).toEqual({
            type: 'SYS_INTERACTION_CANCEL',
            payload: { interactionId: 'empty', reason: 'empty-options' },
        });
    });
});
