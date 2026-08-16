import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { buildDiscardStripCards } from '../ui/discardStripCards';

function readBoardSource(): string {
    return readFileSync(resolve(__dirname, '..', 'Board.tsx'), 'utf-8');
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
        expect(source).toContain('data-testid="su-reaction-hand-status"');
        expect(source).toContain("data-testid={opt.id === 'pass' ? 'su-reaction-pass-button' : undefined}");
        expect(source).toContain('&& !isDiscardCardPrompt');
        expect(source).toContain('isDiscardMode={needDiscard}');
        expect(source).not.toContain('isHandDrivenPrompt');
        expect(source).not.toContain('isReactionDirectHandPrompt');
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
        expect(source).toContain("if (value?.kind !== params.kind || value.cardUid !== params.cardUid) return false");
        expect(source).toContain("if (params.kind === 'play_minion')");
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

    it('场上可发动效果必须先点来源本体，再点目标基地，不能退化成响应按钮', () => {
        const source = readBoardSource();
        expect(source).toContain('function isFieldSourceBaseTargetValue');
        expect(source).toContain("candidate.fieldSourceTargetType === 'base'");
        expect(source).toContain('const fieldSourceBaseTargetPrompt = useMemo');
        expect(source).toContain('const isFieldSourceBaseTargetReady');
        expect(source).toContain('setSelectedFieldPromptSourceMinionUid((current) => current === minionUid ? null : minionUid)');
        expect(source).toContain('fieldSourceBaseTargetPrompt.sourceMinionUids.has(selectedFieldPromptSourceMinionUid)');
        expect(source).toContain('const fieldSourceBaseTargetOptionIdsByBaseIndex = useMemo');
        expect(source).toContain('const optionId = fieldSourceBaseTargetOptionIdsByBaseIndex.get(index)');
        expect(source).toContain('respondCurrentPrompt({ optionId })');
        expect(source).toContain('!isReactionHandPlayValue(opt.value) && !isFieldSourceBaseTargetValue(opt.value)');
        expect(source).toContain('selectedMinionUids={isFieldSourceBaseTargetReady && selectedFieldPromptSourceMinionUid ? new Set([selectedFieldPromptSourceMinionUid]) : undefined}');
        expect(source).toContain('isFieldSourceBaseTargetReady && fieldSourceBaseTargetOptionIdsByBaseIndex.has(idx)');
        expect(source).toContain('isFieldSourceBaseTargetReady && !fieldSourceBaseTargetOptionIdsByBaseIndex.has(idx)');
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
