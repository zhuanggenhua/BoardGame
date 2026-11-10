import type { MatchState, TutorialStepSnapshot } from '../../engine/types';
import type { QidahenCore } from './domain/types';
import { getQidahenRecruitTrainMapInput } from './ui/recruitTrainMapInput';
import { getQidahenWheelRecruitTrainChoices } from './domain/wheelRecruitTrain';

const cavalryId = 'ming-post-sarhu-1619-liaobei-cavalry-cavalry-lv1__compat__1';
const artilleryId = 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1';

/** 在实际局面中寻找先前军屯的部队；其 ID 包含真实事件时间，不能写死。 */
export function resolveAnnualBranchTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): TutorialStepSnapshot {
    const core = state.core;
    if (step.id === 'training-practice' && core.wheelRecruitTrainProgress) {
        const progress = core.wheelRecruitTrainProgress;
        const choices = getQidahenWheelRecruitTrainChoices(core);
        if (progress.phase === 'payment') return { ...step, allowedTargets: undefined,
            allowedCommands: core.selectedPaymentCardIds.length ? ['CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT'] : ['SELECT_PAYMENT_CARD'],
            content: 'game-qidahen:tutorial.annual.steps.training-practice-payment', highlightTarget: 'qidahen-hand-zone', tooltipAnchorTarget: undefined };
        if (progress.phase === 'choose-action') {
            const preferredId = progress.actionsCompleted < 3 ? 'action:train' : progress.actionsCompleted < 4 ? 'action:recruit' : 'finish';
            const choice = choices.find(item => item.id === preferredId) ?? choices.find(item => item.id === 'action:recruit') ?? choices[0];
            return { ...step, content: progress.actionsCompleted >= 4
                ? `game-qidahen:tutorial.annual.steps.${choices.some(item => item.id === 'extra-training') ? 'training-practice-complete' : 'training-practice-finish'}`
                : 'game-qidahen:tutorial.annual.steps.training-practice-action',
                allowedTargets: choice ? [choice.id] : undefined, highlightTarget: 'qidahen-wheel-recruit-train-selection',
                tooltipAnchorTarget: 'qidahen-wheel-recruit-train-selection' };
        }
        const input = getQidahenRecruitTrainMapInput(core);
        if (progress.phase === 'choose-recruit-target') {
            const regionId = input.regionIds.includes('city-region-15-liaodong') ? 'city-region-15-liaodong' : input.regionIds[0];
            return { ...step, content: 'game-qidahen:tutorial.annual.steps.training-practice-recruit',
                allowedTargets: regionId ? [`recruit:${regionId}`] : undefined,
                highlightTarget: regionId ? `qidahen-map-region-focus-${regionId}` : 'qidahen-wheel-recruit-train-selection',
                tooltipAnchorTarget: regionId ? 'qidahen-map-region-focus-name' : undefined };
        }
        const preferred = progress.actionsCompleted === 0 ? artilleryId : progress.actionsCompleted === 1
            ? core.pieces.find(piece => piece.sourceStackId.startsWith('ming-farm-') && piece.troopKind === 'infantry')?.id : cavalryId;
        const preferredToken = preferred ? core.mapTokens.find(token => token.pieceId === preferred)?.id : undefined;
        const tokenId = preferredToken && input.tokenIds.includes(preferredToken) ? preferredToken : input.tokenIds[0];
        const token = tokenId ? core.mapTokens.find(item => item.id === tokenId) : undefined;
        const choice = token?.regionId ? input.choiceFor(token.regionId, token.id) : undefined;
        return { ...step, content: 'game-qidahen:tutorial.annual.steps.training-fallback', allowedTargets: choice ? [choice.id] : undefined,
            highlightTarget: token?.regionId ? `qidahen-map-region-focus-${token.regionId}` : 'qidahen-wheel-recruit-train-selection',
            tooltipAnchorTarget: token ? `qidahen-map-token-${token.id}` : undefined };
    }
    if (step.id === 'opponent-retreat' && state.sys.interaction?.current) {
        return { ...step, aiActions: [{ commandType: 'SYS_INTERACTION_RESPOND', playerId: state.sys.interaction.current.playerId,
            payload: { optionId: 'rear-guard' }, waitForBoardSyncAfter: true }] };
    }
    const farm = core.pieces.find(piece => piece.faction === 'ming' && piece.sourceStackId.startsWith('ming-farm-') && piece.troopKind === 'infantry');
    const tokenFor = (id: string) => core.mapTokens.find(token => token.pieceId === id)?.id;
    if ((step.id === 'hand-limit' || step.id === 'recovery-hand-limit') && core.handLimitDiscardSelection) {
        const preference = ['hand-1', 'deck-ming-5', 'deck-ming-6', 'deck-ming-7', 'deck-ming-8', 'deck-ming-9'];
        const candidates = core.handLimitDiscardSelection.candidateCardIds;
        const chosen = [...preference.filter(id => candidates.includes(id)), ...candidates.filter(id => !preference.includes(id))].slice(0, core.handLimitDiscardSelection.requiredDiscardCount);
        return { ...step, allowedTargets: chosen };
    }
    if (step.id === 'training-move' && state.sys.tutorial.selectedBranch === 'recovery') return { ...step,
        content: 'game-qidahen:tutorial.annual.steps.training-move-recovery',
        allowedTargets: ['move-3-all-opponents'], advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-3-all-opponents' } }] };
    if (step.id === 'recruit-troops' && core.explicitRegionId) {
        return { ...step, highlightTarget: `qidahen-map-region-focus-${core.explicitRegionId}` };
    }
    if (step.id === 'dispatch-troops' && farm) {
        const tokenId = tokenFor(farm.id);
        return { ...step, allowedTargets: [farm.id, cavalryId, artilleryId],
            tooltipAnchorTarget: tokenId ? `qidahen-map-token-${tokenId}` : step.tooltipAnchorTarget };
    }
    if (['training-target', 'training-second-target', 'training-third-target'].includes(step.id)) {
        const input = getQidahenRecruitTrainMapInput(core);
        const preferred = step.id === 'training-target' ? artilleryId : step.id === 'training-second-target' ? farm?.id : cavalryId;
        const tokenId = (preferred && tokenFor(preferred) && input.tokenIds.includes(tokenFor(preferred)!) ? tokenFor(preferred) : input.tokenIds[0]);
        const token = tokenId ? core.mapTokens.find(item => item.id === tokenId) : undefined;
        const choice = token?.regionId ? input.choiceFor(token.regionId, token.id) : undefined;
        if (token && choice) return { ...step, allowedTargets: [choice.id],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED' }],
            highlightTarget: `qidahen-map-region-focus-${token.regionId}`, tooltipAnchorTarget: `qidahen-map-token-${token.id}`,
            ...(token.pieceId !== preferred ? { content: 'game-qidahen:tutorial.annual.steps.training-fallback', hideOverlay: false } : {}) };
    }
    if (step.id === 'training-payment') {
        const card = core.handCards.find(item => item.faction === 'ming');
        if (card) return { ...step, advanceOnEvents: [{ type: 'PAYMENT_CARD_SELECTED' }], allowedTargets: [card.id], highlightTarget: `qidahen-hand-card-${card.id}`,
            tooltipAnchorTarget: `qidahen-hand-guide-${card.id}` };
    }
    return step;
}
