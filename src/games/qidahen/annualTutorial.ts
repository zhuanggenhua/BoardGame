import type { TutorialAiAction, TutorialManifest, TutorialStepSnapshot as TutorialStep } from '../../engine/types';
import type { QidahenCore } from './domain/types';
import { resolveAnnualBranchTutorialStep } from './annualBranchTutorial';
import { createAnnualSeasonTutorialSteps, createAnnualChronologyPaymentStep, createAnnualChronologyOpponentSteps, resolveAnnualSeasonTutorialStep, validateAnnualSeasonTutorialStep } from './annualSeasonTutorial';
import { createAnnualBattleTutorialSteps, resolveAnnualDispatchTutorialStep, validateAnnualDispatchTutorialStep } from './annualDispatchTutorial';
import { createAnnualDiplomacyTutorialStep, resolveAnnualDiplomacyTutorialStep, validateAnnualDiplomacyTutorialStep } from './annualDiplomacyTutorial';
import { createAnnualFarmTutorialStep, resolveAnnualFarmTutorialStep, validateAnnualFarmTutorialStep } from './annualFarmTutorial';
import { resolveAnnualHandActionTutorialStep } from './annualHandActionTutorial';

const SYS = 'SYS_INTERACTION_RESPOND';
const turnFact = 'TURN_RESOLUTION_APPLIED';
const sourceInfantry = [1, 2].map(index => `ming-recruit-regular-infantry-lv2__compat__${index}`);
const sourceArtillery = 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1';
const SELF_EXPLANATORY_INPUTS = new Set([
    'recruit-confirm', 'farm-target', 'opening-finish', 'upgrade-confirm', 'battle-finish',
    'hire-payment', 'diplomacy-round-finish', 'maintenance-first-card', 'maintenance-second-card',
    'abandon-ningyuan', 'abandon-outer-wall', 'upkeep-hanseong',
    'chronology-first-card', 'chronology-second-card', 'chronology-third-card', 'training-payment-confirm', 'training-kind',
    'training-slot-finish', 'training-round-finish', 'training-second-kind', 'training-third-kind',
    'training-third-target',
]);
const response = (optionId: string, playerId: string): TutorialAiAction => ({ commandType: SYS, playerId, payload: { optionId }, waitForBoardSyncAfter: true });
const freeMove = (playerId: string): TutorialAiAction => ({ commandType: 'EXECUTE_WHEEL_MOVE', playerId, payload: { moveId: 'move-1-free' }, waitForBoardSyncAfter: true });
const emptyTurn = (playerId: string): TutorialAiAction[] => [freeMove(playerId), response('finish-slot', playerId), response('skip-hand', playerId)];
// 同层界面负责固定阅读与输入，地图中的无关单位不参与其空间排布。
const HUD_PROTECTION = ['[data-testid="qidahen-faction-actions"]', '[data-testid="qidahen-action-slot"] > *', '[data-testid="qidahen-turn-choice"]', '[data-testid^="qidahen-hand-card-shell-"]', '[data-qidahen-hand-scroll-face]', '[data-fab-id="chat"]',
    '[data-testid="qidahen-hand-interaction-tray"]', '[data-testid="qidahen-confirm-tactic-card"]', '[data-testid="qidahen-post-battle-selection"]',
    '[data-testid="qidahen-player-float"]', '[data-testid="qidahen-action-wheel"]',
    '[data-testid="qidahen-chronology-zone"]', '[data-testid="qidahen-korea-zone"]',
    '[data-testid="qidahen-draw-anchor"]', '[data-testid="qidahen-discard-anchor"]', '[data-testid="qidahen-tactic-card-selection-panel"]'];
// 仅保留正式UI已标记的当前来源、目标、全部候选、交战与维护上下文。
const CURRENT_MAP_TASK_PROTECTION = ['[data-qidahen-map-protected-token="true"]', '[data-qidahen-map-protected-population="true"]',
    '[data-pending-committed-selectable="true"]', '[data-testid="qidahen-map-tutorial-recommendation"]', '[data-qidahen-army-group-region]', '[data-testid="qidahen-map-region-focus-name"]', '[data-qidahen-map-context-space]', '[data-qidahen-fortification-context]'];
const PROTECTED_UI = [...HUD_PROTECTION, ...CURRENT_MAP_TASK_PROTECTION];

const action = (id: string, command: string, event: string, highlightTarget: string, match?: Record<string, unknown>, extra: Partial<TutorialStep> = {}): TutorialStep => ({
    id, content: `game-qidahen:tutorial.annual.steps.${id}`, requireAction: true, hideActionHint: true,
    highlightTarget, position: 'left', tooltipMaxWidth: 310,
    avoidOverlapSelectors: PROTECTED_UI,
    allowedCommands: [command], advanceOnEvents: [{ type: event, ...(match ? { match } : {}) }], ...extra,
});
const choice = (id: string, fromStep: string, targets: string[], highlightTarget = 'qidahen-turn-confirm', extra: Partial<TutorialStep> = {}) => action(
    id, SYS, turnFact, highlightTarget, { fromStep }, { allowedTargets: targets, ...extra },
);
// 当前盘面行动只保护真实候选与标记；无效扇区和盘面纹理不把说明推到远处。
const WHEEL_ACTION_PROTECTION = [...PROTECTED_UI.filter(selector => selector !== '[data-testid="qidahen-action-wheel"]'),
    '[data-testid="qidahen-action-wheel"] [data-testid^="qidahen-turn-option-"]', '[data-testid="qidahen-wheel-current-marker"]', '[data-qidahen-wheel-current-label="true"]'];
const wheelChoice = (id: string, optionId: string) => choice(id, 'menu', [optionId], `qidahen-turn-option-${optionId}`, {
    position: 'top', tooltipAnchorTarget: `qidahen-turn-option-${optionId}`, avoidOverlapSelectors: WHEEL_ACTION_PROTECTION,
});
const info = (id: string, highlightTarget: string, extra: Partial<TutorialStep> = {}): TutorialStep => ({
    id, content: `game-qidahen:tutorial.annual.steps.${id}`, infoStep: true, highlightTarget, position: 'left', tooltipMaxWidth: 320,
    avoidOverlapSelectors: PROTECTED_UI, ...extra,
});
const mapChoice = (id: string, fromStep: string, targets: string[], focusRegion = targets[0]) => choice(id, fromStep, targets, `qidahen-map-region-focus-${focusRegion}`, { position: 'right', highlightFrame: 'none', tooltipAnchorTarget: 'qidahen-map-region-focus-name',
    avoidOverlapSelectors: [...PROTECTED_UI, '[data-qidahen-map-candidate-protection="true"]', '[data-qidahen-candidate-object="true"]'] });
const payChoice = (id: string, fromStep: string, targets: string[]) => choice(id, fromStep, targets, 'qidahen-hand-zone', { position: 'top' });
const moveStep = (id: string) => action(id, 'EXECUTE_WHEEL_MOVE', 'WHEEL_MOVE_EXECUTED', 'qidahen-action-wheel', { moveId: 'move-1-free' }, { position: 'right', highlightFrame: 'none' });
const maintenance = (id: string, decision: 'maintain' | 'abandon') => choice(id, 'maintenance', [decision], `qidahen-turn-option-${decision}`);
const repeatedOthers = (id: string, aiActions: TutorialAiAction[], equivalentStepIds: string[], reason: string): TutorialStep => ({
    id, content: '', aiActions, hiddenAutomation: { kind: 'compressed-repeat', equivalentStepIds, reason },
});

/** 正式萨尔浒开局的一局连续课程。固定合法洗牌与骰序，所有中途变化都走正式命令。 */
export const QIDAHEN_ANNUAL_TUTORIAL: TutorialManifest = {
    id: 'basic-opening', revision: 30, numPlayers: 3,
    stepValidator: (state, step) => validateAnnualFarmTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, step) ?? validateAnnualDiplomacyTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, step) ?? validateAnnualDispatchTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, step) ?? (step.id === 'training-practice'
        ? Boolean((state.core as QidahenCore).wheelRecruitTrainProgress)
        : validateAnnualSeasonTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, step) ?? true),
    resolveStep: (state, step) => resolveAnnualHandActionTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, resolveAnnualDispatchTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>,
        resolveAnnualBranchTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>,
            resolveAnnualSeasonTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>,
                resolveAnnualDiplomacyTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, resolveAnnualFarmTutorialStep(state as import('../../engine/types').MatchState<QidahenCore>, step)))))),
    selectBranch: (state, step) => step.id === 'year-character'
        ? ((state.core as QidahenCore).factions.ming.handCount === 0 ? 'recovery' : 'normal') : undefined,
    stayOnMatchAfterCompletion: true,
    randomPolicy: { mode: 'sequence', values: [1, 1, 1, 10] },
    steps: ([
        { id: 'opening-opponents', content: '', aiActions: [...emptyTurn('1'), ...emptyTurn('2')],
            hiddenAutomation: { kind: 'setup-precondition', reason: '首张教学卡前，蒙古与后金依正式顺位完成其回合；不改写当前玩家或轮盘。' } },
        info('frontier-goal', 'qidahen-chronology-zone', { position: 'right', highlightFrame: 'none' }),
        info('frontier-target', 'qidahen-map-region-focus-city-region-7', { position: 'right', highlightFrame: 'none', tooltipAnchorTarget: 'qidahen-map-region-focus-name', tooltipMaxWidth: 260, avoidOverlapSelectors: [...PROTECTED_UI, '[data-tutorial-id="qidahen-map-region-focus-city-region-7"]'] }),
        moveStep('opening-move'),
        createAnnualFarmTutorialStep(PROTECTED_UI),
        info('midyear', 'qidahen-wheel-sector-label-wheel-midyear', { position: 'right', tooltipAnchorTarget: 'qidahen-wheel-sector-label-wheel-midyear', avoidOverlapSelectors: PROTECTED_UI, highlightFrame: 'none', aiDelayMs: 1000, aiActions: [...emptyTurn('1'), freeMove('2'), response('finish-slot', '2'), response('skip-hand', '2')], autoAdvanceAfterAi: false }),
        action('hand-limit', SYS, 'SYS_INTERACTION_RESOLVED', 'qidahen-hand-zone', { sourceId: 'qidahen:hand-limit-discard' }, {
            position: 'top', allowedTargets: ['hand-1', 'deck-ming-5', 'deck-ming-6', 'deck-ming-7', 'deck-ming-8', 'deck-ming-9'],
        }),
        moveStep('battle-move'),
        choice('upgrade-card', 'menu', ['hand-card:deck-ming-4'], 'qidahen-hand-card-deck-ming-4', { position: 'top', tooltipAnchorTarget: 'qidahen-hand-card-deck-ming-4', highlightFrame: 'none' }),
        action('upgrade-payment', 'SELECT_PAYMENT_CARD', 'PAYMENT_CARD_SELECTED', 'qidahen-hand-zone', { cardId: 'deck-ming-10' }, { position: 'top', allowedTargets: ['deck-ming-10'] }),
        action('upgrade-confirm', 'EXECUTE_SELECTED_ACTION', 'SELECTED_ACTION_EXECUTED', 'qidahen-action-payment-confirm', { actionId: 'upgrade-armament' }),
        wheelChoice('dispatch-action', 'dispatch'),
        payChoice('dispatch-payment', 'dispatch-payment', ['deck-ming-11']),
        mapChoice('dispatch-source', 'dispatch-source', ['city-region-15']),
        { ...mapChoice('dispatch-troops', 'dispatch-troops', [...sourceInfantry, sourceArtillery], 'city-region-15'),
            position: 'top', tooltipMaxWidth: 380,
            avoidOverlapSelectors: [...PROTECTED_UI, '[data-testid="qidahen-map-population-city-region-7"]', '[data-testid="qidahen-map-population-city-region-9"]'],
            tooltipArrow: 'anchor',
            tooltipAnchorTarget: `qidahen-map-token-city-region-15-army-${sourceInfantry[1]}` },
        { ...mapChoice('dispatch-target', 'dispatch-target', ['city-region-7']), tooltipMaxWidth: 240,
            avoidOverlapSelectors: [...PROTECTED_UI, '[data-qidahen-map-candidate-protection="true"]', '[data-tutorial-id="qidahen-map-region-focus-city-region-7"]'] },
        ...createAnnualBattleTutorialSteps(PROTECTED_UI),
        choice('battle-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'),
        repeatedOthers('opponent-round', [...emptyTurn('1'), ...emptyTurn('2')], ['midyear'], '重复已经观察的对手免费移动及放弃可选行动；本批没有新季节结算，不额外要求阅读轮到谁的播报。'),
        moveStep('diplomacy-move'),
        createAnnualDiplomacyTutorialStep(PROTECTED_UI),
        info('new-year', 'qidahen-wheel-sector-label-wheel-new-year', { position: 'right', tooltipAnchorTarget: 'qidahen-wheel-sector-label-wheel-new-year', avoidOverlapSelectors: PROTECTED_UI, highlightFrame: 'none', aiDelayMs: 1000, aiActions: [freeMove('1'), response('finish-slot', '1')], autoAdvanceAfterAi: false }),
        maintenance('maintain-shanhai', 'maintain'),
        payChoice('maintenance-first-card', 'maintenance-payment', ['deck-ming-13']),
        payChoice('maintenance-second-card', 'maintenance-payment', ['deck-ming-14']),
        maintenance('abandon-jinzhou', 'abandon'),
        maintenance('abandon-ningyuan', 'abandon'),
        maintenance('abandon-inner-wall', 'abandon'),
        maintenance('abandon-outer-wall', 'abandon'),
        ...createAnnualSeasonTutorialSteps(PROTECTED_UI),
        choice('claim-year', 'chronology', ['claim'], 'qidahen-year-card-slot-current-year', {
            position: 'right', tooltipAnchorTarget: 'qidahen-turn-choice',
            avoidOverlapSelectors: PROTECTED_UI,
        }),
        ...createAnnualChronologyOpponentSteps(),
        createAnnualChronologyPaymentStep(),
        info('new-order', 'qidahen-chronology-zone', { aiActions: [response('mongol-gunchu-ketuji', '1')], autoAdvanceAfterAi: false }),
        choice('year-character', 'year-characters', ['ming-yang-gao'], 'qidahen-turn-option-ming-yang-gao'),
        { ...repeatedOthers('year-ready', [response('jin-daisan', '2'), response('skip-hand', '1'), ...emptyTurn('1')], ['new-order', 'midyear'], '后金依同一新纪年资格出人物，随后蒙古依已说明的新顺位正常走完回合。'), branch: 'normal' },
        { ...info('year-ready-recovery', 'qidahen-action-wheel', { position: 'right', aiActions: [response('jin-daisan', '2'), response('skip-hand', '1'),
            { commandType: 'EXECUTE_WHEEL_MOVE', playerId: '1', payload: { moveId: 'move-2-one-opponent', opponentFactionId: 'ming' }, waitForBoardSyncAfter: true }, response('finish-slot', '1'), response('skip-hand', '1')], autoAdvanceAfterAi: false }), branch: 'recovery' },
        { ...moveStep('recovery-farm-move'), branch: 'recovery' },
        { ...wheelChoice('recovery-farm-action', 'military-farm'), branch: 'recovery' },
        { ...mapChoice('recovery-farm-target', 'farm-target', ['city-region-15']), branch: 'recovery' },
        { ...choice('recovery-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'), branch: 'recovery' },
        { ...choice('recovery-skip', 'finish-hand', ['skip-hand'], 'qidahen-turn-option-skip-hand'), branch: 'recovery' },
        { ...repeatedOthers('recovery-opponents', [...emptyTurn('2'), ...emptyTurn('1')], ['midyear'], '后金与蒙古执行已经见过的免费移动和年中结算。'), branch: 'recovery' },
        { ...action('recovery-hand-limit', SYS, 'SYS_INTERACTION_RESOLVED', 'qidahen-hand-zone', { sourceId: 'qidahen:hand-limit-discard' }, { position: 'top' }), branch: 'recovery' },
        moveStep('training-move'),
        wheelChoice('training-action', 'recruit-train'),
        action('training-payment', 'SELECT_PAYMENT_CARD', 'PAYMENT_CARD_SELECTED', 'qidahen-hand-zone', { cardId: 'korea-4' }, { position: 'top', allowedTargets: ['korea-4'] }),
        action('training-payment-confirm', 'CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT', 'WHEEL_RECRUIT_TRAIN_PAYMENT_RESOLVED', 'qidahen-wheel-recruit-train-payment-confirm'),
        { id: 'training-practice', content: 'game-qidahen:tutorial.annual.steps.training-practice-action', requireAction: true,
            hideActionHint: true, highlightFrame: 'none', position: 'right', tooltipMaxWidth: 310,
            avoidOverlapSelectors: [...PROTECTED_UI, '[data-qidahen-map-candidate-protection="true"]', '[data-qidahen-candidate-object="true"]'],
            allowedCommands: ['RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', 'SELECT_PAYMENT_CARD', 'CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT'] },
        choice('training-slot-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'),
        choice('training-round-finish', 'finish-hand', ['skip-hand'], 'qidahen-turn-option-skip-hand'),
        info('finish', 'qidahen-map-layer', { position: 'right' }),
    ] satisfies TutorialStep[]).map(step => {
        const target = step.highlightTarget === 'qidahen-hand-zone' && step.allowedTargets?.length === 1
            ? `qidahen-hand-card-${step.allowedTargets[0]}` : step.highlightTarget;
        const handAnchor = step.highlightTarget === 'qidahen-hand-zone' && step.allowedTargets?.length
            ? `qidahen-hand-guide-${step.allowedTargets[0]}`
            : step.id === 'upgrade-card' ? 'qidahen-hand-guide-deck-ming-4' : undefined;
        const anchored = { ...step, highlightTarget: target, tooltipAnchorTarget: handAnchor ?? step.tooltipAnchorTarget,
            // 读手牌时地图属于背景，只有同层手牌、支付控件和常驻HUD参与避让。
            ...(step.highlightTarget === 'qidahen-hand-zone' || step.id === 'upgrade-card'
                ? { avoidOverlapSelectors: HUD_PROTECTION, tooltipMaxWidth: step.id === 'upgrade-card' ? 260 : 380, tooltipArrow: 'anchor' as const } : {}),
        };
        const framed = step.highlightTarget === 'qidahen-hand-zone' || step.id === 'finish'
            ? { ...anchored, highlightFrame: 'none' as const } : anchored;
        return SELF_EXPLANATORY_INPUTS.has(step.id) ? { ...framed, content: '', hideOverlay: true } : framed;
    }),
};
