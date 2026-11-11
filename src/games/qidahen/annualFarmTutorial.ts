import type { MatchState, TutorialStepSnapshot } from '../../engine/types';
import { buildQidahenTurnChoice } from './domain/turnResolutionChoices';
import { getQidahenTurnResolutionFrame } from './domain/turnResolutionOpportunities';
import { getQidahenWheelPosition } from './domain/wheelRules';
import type { QidahenCore } from './domain/types';

const STEP = 'opening-farm-cycle';
const TEXT = 'game-qidahen:tutorial.annual.steps.';
const MAP_PROTECTION = ['[data-qidahen-map-candidate-protection="true"]', '[data-qidahen-candidate-object="true"]'];
const PHASES = ['menu', 'farm-target', 'reclaim-targets', 'await-hand', 'finish-hand'] as const;
export type AnnualFarmPhase = typeof PHASES[number];

/** 暴露正式帧，调用方不能把进入手牌行动误当成已完成军屯。 */
export function getAnnualFarmPhase(state: MatchState<QidahenCore>): AnnualFarmPhase | null {
    const frame = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn;
    return frame?.factionId === 'ming' && getQidahenWheelPosition(frame.positionId)?.kind === 'reclaim-farm'
        && PHASES.includes(frame.step as AnnualFarmPhase) ? frame.step as AnnualFarmPhase : null;
}

/** 一张动态卡承接轮盘格，正式交互决定可选项与多选数量。 */
export function createAnnualFarmTutorialStep(avoidOverlapSelectors: string[]): TutorialStepSnapshot {
    return { id: STEP, content: `${TEXT}farm-menu-initial`, requireAction: true, hideActionHint: true,
        highlightFrame: 'none', highlightTarget: 'qidahen-action-wheel', position: 'right', avoidOverlapSelectors };
}

export function validateAnnualFarmTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): boolean | undefined {
    if (step.id !== STEP) return undefined;
    return getAnnualFarmPhase(state) !== null;
}

/** 候选与结果只读实际状态；推荐仅用于提示，不限制允许的目标或命令。 */
export function resolveAnnualFarmTutorialStep(state: MatchState<QidahenCore>, step: TutorialStepSnapshot): TutorialStepSnapshot {
    if (step.id !== STEP) return step;
    const phase = getAnnualFarmPhase(state);
    const data = getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn;
    if (!phase || !data) return step;
    const base = { ...step, allowedTargets: undefined, allowedCommands: undefined, advanceOnEvents: undefined,
        recommendedTargets: undefined, hideOverlay: false };
    // 手牌行动拥有自己的正式控件；此时不显示军屯文案，也不阻止所选行动。
    if (phase === 'await-hand') return { ...base, content: '', hideOverlay: true, highlightTarget: undefined, tooltipAnchorTarget: undefined };
    const choice = buildQidahenTurnChoice(state.core, data);
    if (!choice) return base;
    const candidates = choice.candidates.filter(candidate => !candidate.disabled);
    if (phase === 'menu' || phase === 'finish-hand') {
        const preferred = phase === 'menu'
            ? ['military-farm', 'reclaim', 'hand-action:recruit', 'finish-slot'].find(id => candidates.some(candidate => candidate.id === id))
            : candidates.find(candidate => candidate.id === 'hand-action:recruit')?.id
                ?? candidates.find(candidate => candidate.id === 'skip-hand')?.id;
        const content = phase === 'finish-hand' ? 'farm-hand-menu-dynamic'
            : !data.completedSubactions.length ? 'farm-menu-initial'
                : preferred === 'hand-action:recruit' ? 'farm-menu-hand-action'
                    : data.completedSubactions.includes('military-farm') && data.completedSubactions.includes('reclaim') ? 'farm-menu-finish'
                    : data.completedSubactions.includes('military-farm') ? 'farm-menu-after-farm' : 'farm-menu-after-reclaim';
        const target = preferred?.startsWith('hand-action:') ? 'qidahen-action-recruit'
            : preferred ? `qidahen-turn-option-${preferred}` : 'qidahen-action-wheel';
        return { ...base, content: `${TEXT}${content}`, highlightTarget: target, tooltipAnchorTarget: target,
            recommendedTargets: preferred ? [preferred] : undefined };
    }
    const preferred = phase === 'farm-target' ? 'city-region-15' : 'city-region-15-liaodong';
    const region = candidates.find(candidate => candidate.id === preferred) ?? candidates[0];
    return { ...base, content: `${TEXT}${phase === 'farm-target' ? 'farm-target-dynamic' : 'reclaim-target-dynamic'}`,
        tooltipMaxWidth: 260,
        highlightTarget: region ? `qidahen-map-region-focus-${region.id}` : 'qidahen-turn-confirm',
        tooltipAnchorTarget: region ? 'qidahen-map-region-focus-name' : 'qidahen-turn-confirm',
        recommendedTargets: region ? [region.id] : undefined,
        avoidOverlapSelectors: [...(step.avoidOverlapSelectors ?? []), ...MAP_PROTECTION] };
}
