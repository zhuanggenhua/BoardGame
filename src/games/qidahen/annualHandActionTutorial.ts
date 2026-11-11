import type { MatchState, TutorialEventMatcher, TutorialStepSnapshot } from '../../engine/types';
import { getQidahenRecruitSelectionForCore } from './domain/interactionSelectionAccessors';
import { canPlaceRegularTroopsInRegion } from './domain/regionSelectionPreferences';
import { getQidahenTurnResolutionFrame } from './domain/turnResolutionOpportunities';
import type { QidahenCore } from './domain/types';

type DynamicHandStep = TutorialStepSnapshot & {
    aiBatchId?: string;
    waitForAnimationInStep?: TutorialEventMatcher[];
};

/**
 * 手牌行动可能返回轮盘、触发战斗或要求其他势力回应。
 * 使用当前正式交互的 owner 与候选；不按 actionId 推测后续阶段。
 */
export function resolveAnnualHandActionTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): TutorialStepSnapshot {
    if (!['opening-farm-cycle', 'diplomacy-cycle'].includes(step.id)) return step;
    const frame = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn;
    if (frame?.step !== 'await-hand') return step;
    const base: DynamicHandStep = {
        ...step, content: '', hideOverlay: true, highlightTarget: undefined, tooltipAnchorTarget: undefined,
        allowedTargets: undefined, recommendedTargets: undefined, allowedCommands: undefined,
        aiActions: undefined, aiBatchId: undefined,
        waitForAnimationInStep: [{ type: 'QIDAHEN_BATTLE_ROLLED' }],
    };
    const current = state.sys.interaction?.current;
    const actor = state.core.factions.ming.playerId;
    if (!current || current.playerId === actor) {
        const recruit = getQidahenRecruitSelectionForCore(state.core, current);
        if (recruit) {
            const selected = Boolean(state.core.explicitRegionId && state.core.explicitRegionId === recruit.targetRegionId);
            const preferred = state.core.regions.find(region => region.id === 'city-region-15'
                && !region.isLogicalRegion && canPlaceRegularTroopsInRegion(region, 'ming', state.core));
            const regionId = selected ? state.core.explicitRegionId : preferred?.id ?? recruit.displayAnchorRegionId ?? recruit.targetRegionId;
            const recommended = recruit.choices.find(choice => choice.id === 'level-2-troops') ?? recruit.choices[0];
            return { ...base, hideOverlay: false,
                content: `game-qidahen:tutorial.annual.steps.${selected ? 'hand-recruit-choice' : 'hand-recruit-region'}`,
                recommendedTargets: selected && recommended ? [recommended.id] : regionId ? [regionId] : undefined,
                highlightFrame: 'none', tooltipMaxWidth: 260,
                avoidOverlapSelectors: [...(step.avoidOverlapSelectors ?? []), '[data-qidahen-map-candidate-protection="true"]', '[data-qidahen-candidate-object="true"]'],
                highlightTarget: regionId ? `qidahen-map-region-focus-${regionId}` : 'qidahen-map-layer',
                tooltipAnchorTarget: selected && recommended ? `qidahen-recruit-choice-${recommended.id}` : 'qidahen-map-region-focus-name' };
        }
        const ruleKey: Record<string, string> = {
            raid: 'hand-raid-rule', recruit: 'hand-recruit-rule', 'grant-pardon': 'hand-grant-rule', 'drive-tiger': 'hand-drive-rule',
        };
        const key = state.core.confirmedActionId && ruleKey[state.core.confirmedActionId];
        if (key && !current) {
            // 费用已选足后由正式确认控件承接，不能继续指向另一张未选手牌。
            if (state.core.payment.required > 0 && state.core.payment.selected >= state.core.payment.required) {
                return { ...base, content: `game-qidahen:tutorial.annual.steps.${key}` };
            }
            const payable = state.core.handCards.filter(card => card.faction === 'ming' && card.status !== 'disabled'
                && !state.core.selectedPaymentCardIds.includes(card.id));
            const card = payable.find(item => item.cardKind === 'silver') ?? payable[0];
            return { ...base, hideOverlay: false, content: `game-qidahen:tutorial.annual.steps.${key}`,
                highlightFrame: 'none', recommendedTargets: card ? [card.id] : undefined,
                highlightTarget: card ? `qidahen-hand-card-${card.id}` : 'qidahen-hand-zone',
                tooltipAnchorTarget: card ? `qidahen-hand-guide-${card.id}` : 'qidahen-hand-zone', tooltipArrow: 'anchor' };
        }
        return base;
    }
    const data = current.data as { options?: Array<{ id: string; disabled?: boolean }>;
        multi?: { min: number; max: number } } | undefined;
    const candidates = data?.options?.filter(option => !option.disabled) ?? [];
    if (!candidates.length) throw new Error(`对手交互没有可用候选: ${current.id}`);
    const preferred = ['defender-fight', 'rear-guard', 'rout', 'fight', 'accept']
        .find(id => candidates.some(candidate => candidate.id === id));
    const ordered = preferred ? [candidates.find(candidate => candidate.id === preferred)!, ...candidates.filter(item => item.id !== preferred)] : candidates;
    const count = data?.multi ? Math.min(Math.max(data.multi.min, 1), data.multi.max, ordered.length) : 1;
    const selected = ordered.slice(0, count).map(option => option.id);
    return { ...base, aiBatchId: current.id, aiActions: [{ commandType: 'SYS_INTERACTION_RESPOND', playerId: current.playerId,
        payload: { interactionId: current.id, ...(data?.multi ? { optionIds: selected } : { optionId: selected[0] }) },
        waitForBoardSyncAfter: true }] };
}
