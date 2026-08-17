import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { buildDiscardStripCards } from '../ui/discardStripCards';
import {
    buildFieldSourceActionPromptModel,
    buildFieldSourceTargetPromptModel,
    resolveFieldSourceTargetSelectionState,
} from '../ui/fieldSourceTargetInteraction';
import {
    getSmashUpReactionChoiceBaseIndex,
    getSmashUpReactionChoiceTargetMinionUid,
    isSmashUpReactionHandPlayValue,
    matchesSmashUpReactionHandPlayTarget,
    readSmashUpReactionChoiceValue,
    readSmashUpReactionHandPlayTarget,
} from '../domain/reactionChoiceInteraction';

function readBoardSource(): string {
    return readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');
}

function readFieldSourceTargetSource(): string {
    return readFileSync(resolve(__dirname, '..', 'ui', 'fieldSourceTargetInteraction.ts'), 'utf-8');
}

describe('SmashUp 交互浮动操作栏源码约束', () => {
    it('浮动操作栏外层容器应保持 pointer-events-auto，避免真机触摸命中丢失', () => {
        const source = readBoardSource();
        expect(source).toContain("absolute inset-x-0 flex justify-center pointer-events-auto");
        expect(source).toContain("fixed inset-x-0 flex justify-center pointer-events-auto");
    });

    it('普通 hand prompt 仍由手牌直选承接，reaction_choose 的手牌响应不得落回 PromptOverlay 按钮主路径', () => {
        const source = readBoardSource();
        expect(source).toContain('isDirectHandSelectPrompt && (isMultiDirectHandSelect || handSelectExtraOptions.length > 0)');
        expect(source).toContain('const shouldRender = !isDirectHandSelectPrompt');
        expect(source).toContain('&& !isReactionChoicePrompt');
        expect(source).toContain('const reactionChoicePlayableCardUids = useMemo<Set<string>>');
        expect(source).toContain('const reactionChoiceTargetStateByCardUid = useMemo<Map<string');
        expect(source).toContain('const selectedReactionChoiceTargetState = useMemo');
        expect(source).toContain('const reactionChoiceDisabledCardUids = useMemo<Set<string> | undefined>');
        expect(source).toContain('const reactionChoiceExtraOptions = useMemo');
        expect(source).toContain('isSmashUpReactionHandPlayValue');
        expect(source).toContain('matchesSmashUpReactionHandPlayTarget');
        expect(source).toContain('data-testid="su-reaction-hand-status"');
        expect(source).toContain("data-testid={opt.id === 'pass' ? 'su-reaction-pass-button' : undefined}");
        expect(source).toContain('&& !isDiscardCardPrompt');
        expect(source).toContain('isDiscardMode={needDiscard}');
        expect(source).not.toContain('isHandDrivenPrompt');
        expect(source).not.toContain('isReactionDirectHandPrompt');
        expect(source).not.toContain('type ReactionChoicePromptOptionValue');
        expect(source).not.toContain('function isReactionHandPlayValue');
        expect(source).not.toContain('function getReactionChoiceBaseIndex');
        expect(source).not.toContain('function getReactionChoiceTargetMinionUid');
    });

    it('弃牌堆静态选牌 prompt 应自动打开弃牌堆面板，而不是落回中央层', () => {
        const source = readBoardSource();
        expect(source).toContain("data?.targetType !== 'discard'");
        expect(source).toContain("autoOpenPanel={isDiscardMinionPrompt || isDiscardCardPrompt}");
        expect(source).toContain('onSelectCard={isDiscardCardPrompt ? handleDiscardCardPromptSelect : handleDiscardStripSelectCard}');
    });

    it('计分响应里的手牌/基地点击应优先走 smashup_reaction_choose live option', () => {
        const source = readBoardSource();
        expect(source).toContain('const findReactionPlayOptionId = useCallback');
        expect(source).toContain('const respondReactionPlayOption = useCallback');
        expect(source).toContain("if (currentPrompt?.sourceId !== 'smashup_reaction_choose') return undefined");
        expect(source).toContain('return matchesSmashUpReactionHandPlayTarget(opt.value, params)');
        expect(source).toContain('respondCurrentPrompt({ optionId })');
        expect(source).toContain("respondReactionPlayOption({ kind: 'play_minion', cardUid, baseIndex })");
        expect(source).toContain("respondReactionPlayOption({ kind: 'play_action', cardUid, baseIndex })");
        expect(source).toContain("respondReactionPlayOption({ kind: 'play_action', cardUid, baseIndex, targetMinionUid: minionUid })");
        expect(source).toContain("respondReactionPlayOption({ kind: 'play_action', cardUid: card.uid })");
        expect(source).toContain("respondReactionPlayOption({ kind: 'play_action', cardUid: meFirstPendingCard.cardUid, baseIndex: index })");
        expect(source).toContain('if (isReactionChoicePrompt && isCurrentPromptForPlayer)');
        expect(source).toContain('const reactionTargetState = reactionChoiceTargetStateByCardUid.get(card.uid)');
        expect(source).toContain('deployableBaseIndices: new Set(reactionTargetState.baseIndices)');
        expect(source).toContain('!reactionChoicePlayableCardUids.has(card.uid)');
        expect(source).not.toContain('respondCurrentPrompt({ optionId: reactionOption.id })');
    });

    it('smashup_reaction_choose 选项语义必须由共享 helper 解析', () => {
        expect(readSmashUpReactionChoiceValue({ triggerId: 'score-after:1' })).toEqual({
            kind: 'trigger',
            triggerId: 'score-after:1',
            playerId: undefined,
            cardUid: undefined,
            baseIndex: undefined,
            targetBaseIndex: undefined,
            targetMinionUid: undefined,
            minionUid: undefined,
            titanUid: undefined,
        });
        expect(isSmashUpReactionHandPlayValue({ kind: 'pass' })).toBe(false);

        const minionChoice = {
            kind: 'play_minion',
            playerId: '0',
            cardUid: 'hand-minion',
            baseIndex: 2,
        };
        expect(readSmashUpReactionHandPlayTarget(minionChoice)).toEqual({
            kind: 'play_minion',
            cardUid: 'hand-minion',
            baseIndex: 2,
            targetMinionUid: undefined,
        });
        expect(matchesSmashUpReactionHandPlayTarget(minionChoice, {
            kind: 'play_minion',
            cardUid: 'hand-minion',
            baseIndex: 2,
        })).toBe(true);

        const actionToBase = {
            kind: 'play_action',
            playerId: '0',
            cardUid: 'hand-action',
            targetBaseIndex: 1,
        };
        expect(getSmashUpReactionChoiceBaseIndex(actionToBase)).toBe(1);
        expect(readSmashUpReactionHandPlayTarget(actionToBase)).toEqual({
            kind: 'play_action',
            cardUid: 'hand-action',
            baseIndex: 1,
            targetMinionUid: undefined,
        });

        const actionToMinion = {
            kind: 'play_action',
            playerId: '0',
            cardUid: 'hand-action',
            targetBaseIndex: 1,
            targetMinionUid: 'target-minion',
        };
        expect(getSmashUpReactionChoiceTargetMinionUid(actionToMinion)).toBe('target-minion');
        expect(matchesSmashUpReactionHandPlayTarget(actionToMinion, {
            kind: 'play_action',
            cardUid: 'hand-action',
            baseIndex: 1,
            targetMinionUid: 'target-minion',
        })).toBe(true);
    });

    it('场上可发动效果必须先点来源本体，再点目标对象，不能退化成响应按钮', () => {
        const source = readBoardSource();
        const fieldSourceTargetSource = readFieldSourceTargetSource();
        expect(source).toContain('isFieldSourceTargetValue');
        expect(source).not.toContain('fieldSourceTargetType');
        expect(source).toContain('buildFieldSourceTargetPromptModel');
        expect(source).toContain('resolveFieldSourceTargetSelectionState');
        expect(source).not.toContain('function readFieldSourceTargetValue');
        expect(fieldSourceTargetSource).toContain('export function readFieldSourceTargetValue');
        expect(fieldSourceTargetSource).toContain("candidate.fieldInteractionType === 'source-target'");
        expect(fieldSourceTargetSource).toContain('typeof candidate.fieldSourceType === \'string\'');
        expect(fieldSourceTargetSource).toContain('typeof candidate.fieldTargetType === \'string\'');
        expect(source).toContain('const fieldSourceTargetPrompt = useMemo');
        expect(source).toContain('targetType: currentPromptData?.targetType');
        expect(source).toContain('fieldSourceTargetPrompt || fieldSourceActionPrompt || isOngoingSelectPrompt');
        expect(source).toContain('const isFieldSourceTargetReady = fieldSourceTargetSelection.isReady');
        expect(source).toContain('const fieldSourceTargetSelectableMinionUids = fieldSourceTargetSelection.selectableMinionUids');
        expect(source).toContain('const fieldSourceTargetSelectableOngoingUids = fieldSourceTargetSelection.selectableOngoingUids');
        expect(source).toContain('const fieldSourceTargetSelectableTitanUids = fieldSourceTargetSelection.selectableTitanUids');
        expect(source).toContain('const fieldSourceTargetExtraOptions = useMemo');
        expect(source).toContain('filter(opt => !isFieldSourceTargetValue(opt.value))');
        expect(source).toContain('fieldSourceTargetPrompt && fieldSourceTargetExtraOptions.length > 0');
        expect(source).toContain('setSelectedFieldPromptSourceUid(null);');
        expect(source).toContain('sourceOngoingUids');
        expect(source).toContain('sourceTitanUids');
        expect(source).toContain('setSelectedFieldPromptSourceUid((current) => current === minionUid ? null : minionUid)');
        expect(source).toContain('fieldSourceTargetPrompt.sourceTargetOptions.has(selectedFieldPromptSourceUid)');
        expect(source).toContain('setSelectedFieldPromptSourceUid((current) => current === ongoingUid ? null : ongoingUid)');
        expect(source).toContain('const handleFieldSourceTitanSelect = useCallback');
        expect(source).toContain('fieldSourceTargetPrompt.sourceTitanUids.has(titanUid)');
        expect(source).toContain('const fieldSourceTargetOptionIdsByBaseIndex = fieldSourceTargetSelection.targetOptionIdsByBaseIndex');
        expect(source).toContain('const fieldSourceTargetOptionIdsByMinionUid = fieldSourceTargetSelection.targetOptionIdsByMinionUid');
        expect(source).toContain('const optionId = fieldSourceTargetOptionIdsByBaseIndex.get(index)');
        expect(source).toContain('const targetOptionId = selectedSourceEntry?.targetOptionIdsByMinionUid.get(minionUid)');
        expect(source).toContain('respondCurrentPrompt({ optionId })');
        expect(source).toContain('respondCurrentPrompt({ optionId: targetOptionId })');
        expect(source).toContain('!isSmashUpReactionHandPlayValue(opt.value) && !isFieldSourceTargetValue(opt.value)');
        expect(source).toContain('((fieldSourceTargetSelectableMinionUids?.size ?? 0) > 0)');
        expect(source).toContain('fieldSourceTargetSelectableMinionUids');
        expect(source).toContain('fieldSourceTargetSelectableOngoingUids');
        expect(source).toContain('fieldSourceTargetSelectableTitanUids');
        expect(source).toContain('&& !fieldSourceTargetPrompt');
        expect(source).toContain("selectedMinionUids={isFieldSourceTargetReady && selectedFieldPromptSourceUid && selectedFieldSourceTargetEntry?.sourceType === 'minion' ? new Set([selectedFieldPromptSourceUid]) : undefined}");
        expect(source).toContain('selectedOngoingUids={isFieldSourceTargetReady && selectedFieldPromptSourceUid && (selectedFieldSourceTargetEntry?.sourceType === \'ongoing\' || selectedFieldSourceTargetEntry?.sourceType === \'action\') ? new Set([selectedFieldPromptSourceUid]) : undefined}');
        expect(source).toContain("selectedTitanUids={isFieldSourceTargetReady && selectedFieldPromptSourceUid && selectedFieldSourceTargetEntry?.sourceType === 'titan' ? new Set([selectedFieldPromptSourceUid]) : undefined}");
        expect(source).toContain('onTitanSelect={handleFieldSourceTitanSelect}');
        expect(source).toContain('isFieldSourceTargetReady && fieldSourceTargetOptionIdsByBaseIndex.size > 0 && fieldSourceTargetOptionIdsByBaseIndex.has(idx)');
        expect(source).toContain('isFieldSourceTargetReady && fieldSourceTargetOptionIdsByBaseIndex.size > 0 && !fieldSourceTargetOptionIdsByBaseIndex.has(idx)');
    });

    it('场上来源对象自身可选执行必须点来源本体，跳过/不发动才走按钮', () => {
        const source = readBoardSource();
        const fieldSourceTargetSource = readFieldSourceTargetSource();

        expect(source).toContain('isFieldSourceActionValue');
        expect(source).toContain('buildFieldSourceActionPromptModel');
        expect(fieldSourceTargetSource).toContain('export function readFieldSourceActionValue');
        expect(fieldSourceTargetSource).toContain("candidate.fieldInteractionType === 'source-action'");
        expect(fieldSourceTargetSource).toContain("params.targetType !== 'field-source-action'");
        expect(fieldSourceTargetSource).toContain('sourceOptionIdsByUid');

        expect(source).toContain('const fieldSourceActionPrompt = useMemo');
        expect(source).toContain('const fieldSourceActionExtraOptions = useMemo');
        expect(source).toContain('filter(opt => !isFieldSourceActionValue(opt.value))');
        expect(source).toContain('const fieldSourceActionOptionIdsBySourceUid = fieldSourceActionPrompt?.sourceOptionIdsByUid');
        expect(source).toContain('const fieldSourceActionSelectableMinionUids = fieldSourceActionPrompt?.sourceMinionUids');
        expect(source).toContain('const fieldSourceActionSelectableOngoingUids = fieldSourceActionPrompt?.sourceOngoingUids');
        expect(source).toContain('const fieldSourceActionSelectableTitanUids = fieldSourceActionPrompt?.sourceTitanUids');
        expect(source).toContain('fieldSourceTargetPrompt || fieldSourceActionPrompt || isOngoingSelectPrompt');
        expect(source).toContain('fieldSourceActionPrompt && fieldSourceActionExtraOptions.length > 0');
        expect(source).toContain('const optionId = fieldSourceActionOptionIdsBySourceUid?.get(minionUid)');
        expect(source).toContain('const optionId = fieldSourceActionOptionIdsBySourceUid?.get(ongoingUid)');
        expect(source).toContain('const optionId = fieldSourceActionOptionIdsBySourceUid?.get(titanUid)');
        expect(source).toContain('respondCurrentPrompt({ optionId });');
        expect(source).toContain('!isSmashUpReactionHandPlayValue(opt.value) && !isFieldSourceTargetValue(opt.value) && !isFieldSourceActionValue(opt.value)');
        expect(source).toContain('((fieldSourceActionSelectableMinionUids?.size ?? 0) > 0)');
        expect(source).toContain('fieldSourceActionSelectableMinionUids');
        expect(source).toContain('fieldSourceActionSelectableOngoingUids');
        expect(source).toContain('fieldSourceActionSelectableTitanUids');
        expect(source).toContain('&& !fieldSourceActionPrompt');
        expect(source).toContain('selectableTitanUids={fieldSourceActionSelectableTitanUids ?? fieldSourceTargetSelectableTitanUids}');
    });

    it('field-source-target 共享模型统一生成来源高亮和目标提交映射', () => {
        const model = buildFieldSourceTargetPromptModel({
            isCurrentPromptForPlayer: true,
            targetType: 'field-source-target',
            options: [
                {
                    id: 'minion-to-base',
                    value: {
                        fieldInteractionType: 'source-target',
                        fieldSourceType: 'minion',
                        fieldTargetType: 'base',
                        sourceUid: 'source-minion',
                        targetBaseIndex: 2,
                    },
                },
                {
                    id: 'ongoing-to-minion',
                    value: {
                        fieldInteractionType: 'source-target',
                        fieldSourceType: 'ongoing',
                        fieldTargetType: 'minion',
                        sourceUid: 'source-ongoing',
                        targetMinionUid: 'target-minion',
                    },
                },
                {
                    id: 'titan-to-minion',
                    value: {
                        fieldInteractionType: 'source-target',
                        fieldSourceType: 'titan',
                        fieldTargetType: 'minion',
                        sourceUid: 'source-titan',
                        targetUid: 'rescued-minion',
                    },
                },
            ],
        });

        expect(model).not.toBeNull();
        expect(Array.from(model?.sourceMinionUids ?? [])).toEqual(['source-minion']);
        expect(Array.from(model?.sourceOngoingUids ?? [])).toEqual(['source-ongoing']);
        expect(Array.from(model?.sourceTitanUids ?? [])).toEqual(['source-titan']);

        const beforeSourceClick = resolveFieldSourceTargetSelectionState(model, null);
        expect(beforeSourceClick.isReady).toBe(false);
        expect(Array.from(beforeSourceClick.selectableMinionUids ?? [])).toEqual(['source-minion']);
        expect(Array.from(beforeSourceClick.selectableOngoingUids ?? [])).toEqual(['source-ongoing']);
        expect(Array.from(beforeSourceClick.selectableTitanUids ?? [])).toEqual(['source-titan']);

        const afterOngoingClick = resolveFieldSourceTargetSelectionState(model, 'source-ongoing');
        expect(afterOngoingClick.isReady).toBe(true);
        expect(Array.from(afterOngoingClick.selectableOngoingUids ?? [])).toEqual(['source-ongoing']);
        expect(Array.from(afterOngoingClick.selectableMinionUids ?? [])).toEqual(['target-minion']);
        expect(afterOngoingClick.targetOptionIdsByMinionUid.get('target-minion')).toBe('ongoing-to-minion');

        const afterTitanClick = resolveFieldSourceTargetSelectionState(model, 'source-titan');
        expect(afterTitanClick.isReady).toBe(true);
        expect(Array.from(afterTitanClick.selectableTitanUids ?? [])).toEqual(['source-titan']);
        expect(Array.from(afterTitanClick.selectableMinionUids ?? [])).toEqual(['rescued-minion']);
        expect(afterTitanClick.targetOptionIdsByMinionUid.get('rescued-minion')).toBe('titan-to-minion');
    });

    it('field-source-action 共享模型统一生成来源高亮和本体提交映射', () => {
        const model = buildFieldSourceActionPromptModel({
            isCurrentPromptForPlayer: true,
            targetType: 'field-source-action',
            options: [
                {
                    id: 'minion-action',
                    value: {
                        fieldInteractionType: 'source-action',
                        fieldSourceType: 'minion',
                        sourceUid: 'source-minion',
                    },
                },
                {
                    id: 'ongoing-action',
                    value: {
                        fieldInteractionType: 'source-action',
                        fieldSourceType: 'ongoing',
                        sourceUid: 'source-ongoing',
                    },
                },
                {
                    id: 'titan-action',
                    value: {
                        fieldInteractionType: 'source-action',
                        fieldSourceType: 'titan',
                        sourceUid: 'source-titan',
                    },
                },
                {
                    id: 'skip',
                    value: { skip: true },
                },
            ],
        });

        expect(model).not.toBeNull();
        expect(Array.from(model?.sourceMinionUids ?? [])).toEqual(['source-minion']);
        expect(Array.from(model?.sourceOngoingUids ?? [])).toEqual(['source-ongoing']);
        expect(Array.from(model?.sourceTitanUids ?? [])).toEqual(['source-titan']);
        expect(model?.sourceOptionIdsByUid.get('source-minion')).toBe('minion-action');
        expect(model?.sourceOptionIdsByUid.get('source-ongoing')).toBe('ongoing-action');
        expect(model?.sourceOptionIdsByUid.get('source-titan')).toBe('titan-action');
        expect(model?.sourceOptionIdsByUid.has('skip')).toBe(false);
    });

    it('弃牌横条应把 discardActionPlayProvider 结果映射成点随从模式', () => {
        const stripCards = buildDiscardStripCards({
            isDiscardMinionPrompt: false,
            discardPlayOptions: [],
            discardActionPlayOptions: [{
                card: { uid: 'action-1', defId: 'cyborg_apes_shielding', owner: '0', type: 'action' },
                allowedBaseIndices: [0],
                allowedMinionUids: ['host-1'],
                sourceId: 'cyborg_apes_cyberback',
                defId: 'cyborg_apes_shielding',
                name: '护盾',
            }],
            discardSpecialOptions: [],
        });

        expect(stripCards).toEqual([{
            uid: 'action-1',
            defId: 'cyborg_apes_shielding',
            label: '护盾',
            mode: 'play_action_minion',
        }]);
    });

    it('弃牌堆 special 应按 allowedMinionUids 映射到点基地或点随从模式', () => {
        const stripCards = buildDiscardStripCards({
            isDiscardMinionPrompt: false,
            discardPlayOptions: [],
            discardActionPlayOptions: [],
            discardSpecialOptions: [
                {
                    card: { uid: 'special-base', defId: 'skeletons_revenant', owner: '0', type: 'minion' },
                    allowedBaseIndices: 'all',
                    sourceId: 'skeletons_revenant',
                    defId: 'skeletons_revenant',
                    name: '归来者',
                },
                {
                    card: { uid: 'special-minion', defId: 'world_champs_eh', owner: '0', type: 'action' },
                    allowedBaseIndices: [0],
                    allowedMinionUids: ['ally-1'],
                    sourceId: 'world_champs_eh',
                    defId: 'world_champs_eh',
                    name: 'Eh',
                },
            ],
        });

        expect(stripCards).toEqual([
            {
                uid: 'special-base',
                defId: 'skeletons_revenant',
                label: '归来者',
                mode: 'activate_special_base',
            },
            {
                uid: 'special-minion',
                defId: 'world_champs_eh',
                label: 'Eh',
                mode: 'activate_special_minion',
            },
        ]);
    });
});
