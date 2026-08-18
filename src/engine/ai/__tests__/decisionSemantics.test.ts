import { describe, expect, it } from 'vitest';
import {
    buildAiLegalActionsFromInteractionDecision,
    buildSelectPlayerDecisionActions,
    enumerateAiDecisionSelections,
    type AiChooseOptionDecisionDescriptor,
    type AiConfirmDecisionDescriptor,
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

    it('可把 request-owned 语义候选投影成 interaction respond 动作', () => {
        const decision: AiChooseOptionDecisionDescriptor = {
            kind: 'choose-option',
            interactionId: 'cardia-faction',
            actorPlayerId: '0',
            sourceId: 'ambusher',
            selection: { min: 1, max: 1 },
            candidates: [
                { id: 'faction_swamp', label: '沼泽', value: { faction: 'swamp' } },
                { id: 'faction_academy', label: '学院', value: { faction: 'academy' } },
            ],
        };

        const actions = buildAiLegalActionsFromInteractionDecision(decision);

        expect(actions).toHaveLength(2);
        expect(actions[0]).toMatchObject({
            actionId: 'interaction:cardia-faction:choose-option:faction_swamp',
            kind: 'interaction-choice',
            commands: [{
                type: 'SYS_INTERACTION_RESPOND',
                payload: {
                    interactionId: 'cardia-faction',
                    optionId: 'faction_swamp',
                },
            }],
            metadata: {
                interactionId: 'cardia-faction',
                decisionKind: 'choose-option',
                sourceId: 'ambusher',
            },
        });
    });

    it('语义多选会保留 optionIds 顺序', () => {
        const decision: AiChooseOptionDecisionDescriptor = {
            kind: 'choose-option',
            interactionId: 'ordered',
            actorPlayerId: '0',
            selection: { min: 2, max: 2, ordered: true },
            candidates: [
                { id: 'a', label: 'A' },
                { id: 'b', label: 'B' },
            ],
        };

        const actions = buildAiLegalActionsFromInteractionDecision(decision);

        expect(actions.map((action) => action.commands[0].payload)).toEqual([
            { interactionId: 'ordered', optionIds: ['a', 'b'] },
            { interactionId: 'ordered', optionIds: ['b', 'a'] },
        ]);
    });

    it('确认类语义决策直接使用声明的命令，不从 UI 候选猜测业务动作', () => {
        const decision: AiConfirmDecisionDescriptor = {
            kind: 'confirm',
            interactionId: 'confirm-current',
            actorPlayerId: '0',
            selection: { min: 0, max: 0 },
            candidates: [],
            commands: [{
                type: 'CONFIRM_CURRENT',
                payload: { ok: true },
            }],
        };

        const actions = buildAiLegalActionsFromInteractionDecision(decision);

        expect(actions).toEqual([expect.objectContaining({
            kind: 'interaction-confirm',
            commands: [{
                type: 'CONFIRM_CURRENT',
                payload: { ok: true },
            }],
        })]);
    });
});
