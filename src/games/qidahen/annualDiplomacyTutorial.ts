import type { MatchState, TutorialStepSnapshot } from '../../engine/types';
import { buildQidahenTurnChoice } from './domain/turnResolutionChoices';
import { getQidahenTurnResolutionFrame } from './domain/turnResolutionOpportunities';
import { getQidahenWheelPosition } from './domain/wheelRules';
import type { QidahenCore } from './domain/types';

const STEP_ID = 'diplomacy-cycle';
const RESPONSE = 'SYS_INTERACTION_RESPOND';
const TEXT = 'game-qidahen:tutorial.annual.steps.';
const MAP_CANDIDATE_PROTECTION = ['[data-qidahen-map-candidate-protection="true"]', '[data-qidahen-candidate-object="true"]'];

/** 一个连续步骤承接同一轮盘格的外交、雇佣和结束；候选由当前正式请求决定。 */
export function createAnnualDiplomacyTutorialStep(avoidOverlapSelectors: string[]): TutorialStepSnapshot {
    return {
        id: STEP_ID, content: `${TEXT}diplomacy-menu-dynamic`, requireAction: true,
        hideActionHint: true, highlightFrame: 'none', position: 'right',
        highlightTarget: 'qidahen-action-wheel', avoidOverlapSelectors,
        allowedCommands: [RESPONSE],
    };
}

/** 只承接当前玩家的外交／雇佣普通轮盘格，不吞并手牌行动或后续季节。 */
export function validateAnnualDiplomacyTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): boolean | undefined {
    if (step.id !== STEP_ID) return undefined;
    const data = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn;
    return Boolean(data && data.factionId === 'ming'
        && getQidahenWheelPosition(data.positionId)?.kind === 'diplomacy-hire'
        && ['menu', 'diplomacy-targets', 'hire-payment', 'hire-target', 'await-hand', 'finish-hand'].includes(data.step));
}

/** 提示只追随真实阶段；不限缩、缓存或重置正式候选。 */
export function resolveAnnualDiplomacyTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): TutorialStepSnapshot {
    if (validateAnnualDiplomacyTutorialStep(state, step) !== true) return step;
    const data = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn;
    const choice = buildQidahenTurnChoice(state.core, data);
    if (!choice) return step;
    const candidates = choice.candidates.filter(candidate => !candidate.disabled);
    const base = { ...step, allowedTargets: undefined, recommendedTargets: undefined };

    if (data.step === 'finish-hand') {
        const preferred = candidates.find(candidate => candidate.id === 'skip-hand')?.id;
        return { ...base, content: `${TEXT}diplomacy-hand-menu-dynamic`, position: 'right',
            highlightTarget: preferred ? `qidahen-turn-option-${preferred}` : 'qidahen-turn-choice',
            tooltipAnchorTarget: preferred ? `qidahen-turn-option-${preferred}` : undefined,
            recommendedTargets: preferred ? [preferred] : undefined };
    }

    if (data.step === 'menu') {
        const preferred = ['diplomacy', 'hire', 'finish-slot'].find(id => candidates.some(candidate => candidate.id === id));
        return { ...base, content: `${TEXT}diplomacy-menu-dynamic`, position: 'right',
            highlightTarget: preferred ? `qidahen-turn-option-${preferred}` : 'qidahen-action-wheel',
            tooltipAnchorTarget: preferred ? `qidahen-turn-option-${preferred}` : undefined,
            recommendedTargets: preferred ? [preferred] : undefined };
    }

    if (data.step === 'hire-payment') {
        const card = candidates[0];
        return { ...base, content: `${TEXT}hire-payment-dynamic`, position: 'top',
            highlightTarget: 'qidahen-hand-zone', tooltipAnchorTarget: card ? `qidahen-hand-guide-${card.id}` : undefined };
    }

    const preferredRegion = data.step === 'diplomacy-targets' ? 'city-region-2' : 'city-region-1';
    const region = candidates.find(candidate => candidate.id === preferredRegion)
        ?? candidates.find(candidate => state.core.regions.some(item => !item.isLogicalRegion && item.id === candidate.id));
    const content = data.step === 'diplomacy-targets' ? 'diplomacy-target-dynamic'
        : data.hireExecutions === 0 ? 'hire-target-first-dynamic' : 'hire-target-extra-dynamic';
    return { ...base, content: `${TEXT}${content}`, position: 'right',
        highlightTarget: region ? `qidahen-map-region-focus-${region.id}` : 'qidahen-turn-choice',
        tooltipAnchorTarget: region ? 'qidahen-map-region-focus-name' : undefined,
        recommendedTargets: region ? [region.id] : undefined,
        avoidOverlapSelectors: [...(step.avoidOverlapSelectors ?? []), ...MAP_CANDIDATE_PROTECTION] };
}
