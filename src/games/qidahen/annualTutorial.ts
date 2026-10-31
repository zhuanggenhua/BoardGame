import type { TutorialAiAction, TutorialManifest, TutorialStepSnapshot as TutorialStep } from '../../engine/types';

const SYS = 'SYS_INTERACTION_RESPOND';
const turnFact = 'TURN_RESOLUTION_APPLIED';
const sourceInfantry = [1, 2].map(index => `ming-recruit-regular-infantry-lv2__compat__${index}`);
const sourceArtillery = 'ming-post-sarhu-1619-liaobei-regular-artillery-lv1__compat__1';
const SELF_EXPLANATORY_INPUTS = new Set([
    'recruit-confirm', 'farm-target', 'opening-finish', 'upgrade-confirm', 'dispatch-source', 'battle-finish',
    'hire-payment', 'diplomacy-round-finish', 'maintenance-first-card', 'maintenance-second-card',
    'abandon-jinzhou', 'abandon-ningyuan', 'abandon-inner-wall', 'abandon-outer-wall', 'upkeep-hanseong',
    'chronology-first-card', 'chronology-second-card', 'chronology-third-card', 'training-payment-confirm', 'training-kind',
    'training-slot-finish', 'training-round-finish',
]);
const response = (optionId: string, playerId: string): TutorialAiAction => ({ commandType: SYS, playerId, payload: { optionId }, waitForBoardSyncAfter: true });
const freeMove = (playerId: string): TutorialAiAction => ({ commandType: 'EXECUTE_WHEEL_MOVE', playerId, payload: { moveId: 'move-1-free' }, waitForBoardSyncAfter: true });
const emptyTurn = (playerId: string): TutorialAiAction[] => [freeMove(playerId), response('finish-slot', playerId), response('skip-hand', playerId)];
const PROTECTED_UI = ['[data-testid="qidahen-turn-choice"]', '[data-testid^="qidahen-hand-card-shell-"]', '[data-qidahen-hand-scroll-face]', '[data-fab-id="chat"]',
    '[data-testid="qidahen-hand-interaction-tray"]', '[data-testid="qidahen-confirm-tactic-card"]', '[data-testid="qidahen-post-battle-selection"]',
    '[data-testid="qidahen-player-float"]', '[data-testid="qidahen-action-wheel"]',
    '[data-testid="qidahen-chronology-zone"]', '[data-testid="qidahen-korea-zone"]',
    '[data-testid="qidahen-draw-anchor"]', '[data-testid="qidahen-discard-anchor"]',
    '[data-qidahen-map-protected-token="true"]', '[data-pending-committed-selectable="true"]', '[data-qidahen-map-selection-space]', '[data-qidahen-battle-region-space]'];

const action = (id: string, command: string, event: string, highlightTarget: string, match?: Record<string, unknown>, extra: Partial<TutorialStep> = {}): TutorialStep => ({
    id, content: `game-qidahen:tutorial.annual.steps.${id}`, requireAction: true, hideActionHint: true,
    highlightTarget, position: 'left', tooltipMaxWidth: 310,
    avoidOverlapSelectors: PROTECTED_UI,
    allowedCommands: [command], advanceOnEvents: [{ type: event, ...(match ? { match } : {}) }], ...extra,
});
const choice = (id: string, fromStep: string, targets: string[], highlightTarget = 'qidahen-turn-confirm', extra: Partial<TutorialStep> = {}) => action(
    id, SYS, turnFact, highlightTarget, { fromStep }, { allowedTargets: targets, ...extra },
);
const info = (id: string, highlightTarget: string, extra: Partial<TutorialStep> = {}): TutorialStep => ({
    id, content: `game-qidahen:tutorial.annual.steps.${id}`, infoStep: true, highlightTarget, position: 'left', tooltipMaxWidth: 320,
    avoidOverlapSelectors: PROTECTED_UI, ...extra,
});
const mapChoice = (id: string, fromStep: string, targets: string[], focusRegion = targets[0]) => choice(id, fromStep, targets, `qidahen-map-region-focus-${focusRegion}`, { position: 'right', highlightFrame: 'none' });
const payChoice = (id: string, fromStep: string, targets: string[]) => choice(id, fromStep, targets, 'qidahen-hand-zone', { position: 'top' });
const moveStep = (id: string) => action(id, 'EXECUTE_WHEEL_MOVE', 'WHEEL_MOVE_EXECUTED', 'qidahen-wheel-move-move-1-free', { moveId: 'move-1-free' }, { position: 'right', highlightFrame: 'none' });
const maintenance = (id: string, decision: 'maintain' | 'abandon') => choice(id, 'maintenance', [decision], `qidahen-turn-option-${decision}`);
const upkeep = (id: string, ids: string[], region: string) => ({ ...mapChoice(id, 'upkeep', ids, region), compactTooltipWidth: 260 });

/** 正式萨尔浒开局的一局连续课程。固定合法洗牌与骰序，所有中途变化都走正式命令。 */
export const QIDAHEN_ANNUAL_TUTORIAL: TutorialManifest = {
    id: 'basic-opening', revision: 20, numPlayers: 3,
    stayOnMatchAfterCompletion: true,
    randomPolicy: { mode: 'sequence', values: [1, 1, 10, 10] },
    steps: ([
        { id: 'opening-opponents', content: '', aiActions: [...emptyTurn('1'), ...emptyTurn('2')],
            hiddenAutomation: { kind: 'setup-precondition', reason: '首张教学卡前，蒙古与后金依正式顺位完成其回合；不改写当前玩家或轮盘。' } },
        info('frontier-goal', 'qidahen-map-region-focus-city-region-15', { position: 'right', highlightFrame: 'none' }),
        moveStep('opening-move'),
        choice('prepare-hand', 'menu', ['hand-action'], 'qidahen-turn-option-hand-action'),
        action('recruit-action', 'CONFIRM_PREVIEW_ACTION', 'PREVIEW_ACTION_CONFIRMED', 'qidahen-action-recruit', { actionId: 'recruit' }, { allowedTargets: ['recruit'] }),
        action('recruit-payment', 'SELECT_PAYMENT_CARD', 'PAYMENT_CARD_SELECTED', 'qidahen-hand-zone', { cardId: 'hand-3' }, { position: 'top', allowedTargets: ['hand-3'] }),
        action('recruit-confirm', 'EXECUTE_SELECTED_ACTION', 'SELECTED_ACTION_EXECUTED', 'qidahen-action-payment-confirm', { actionId: 'recruit' }),
        action('recruit-source', 'SELECT_REGION', 'REGION_SELECTED', 'qidahen-map-region-focus-city-region-15', { regionId: 'city-region-15' }, { position: 'right', highlightFrame: 'none', allowedTargets: ['city-region-15'] }),
        action('recruit-troops', SYS, 'SYS_INTERACTION_RESOLVED', 'qidahen-actions-zone', { optionId: 'level-2-troops' }, { allowedTargets: ['level-2-troops'] }),
        choice('farm-action', 'menu', ['military-farm'], 'qidahen-turn-option-military-farm'),
        mapChoice('farm-target', 'farm-target', ['city-region-15']),
        choice('reclaim-action', 'menu', ['reclaim'], 'qidahen-turn-option-reclaim'),
        mapChoice('reclaim-target', 'reclaim-targets', ['city-region-15-liaodong']),
        choice('opening-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'),
        info('midyear', 'qidahen-chronology-zone', { aiDelayMs: 1000, aiActions: [...emptyTurn('1'), freeMove('2'), response('finish-slot', '2'), response('skip-hand', '2')], autoAdvanceAfterAi: false }),
        action('hand-limit', SYS, 'SYS_INTERACTION_RESOLVED', 'qidahen-hand-zone', { sourceId: 'qidahen:hand-limit-discard' }, {
            position: 'top', allowedTargets: ['hand-1', 'deck-ming-5', 'deck-ming-6', 'deck-ming-7', 'deck-ming-8', 'deck-ming-9'],
        }),
        moveStep('battle-move'),
        choice('upgrade-first', 'menu', ['hand-action'], 'qidahen-turn-option-hand-action'),
        action('upgrade-card', 'CONFIRM_PREVIEW_ACTION', 'PREVIEW_ACTION_CONFIRMED', 'qidahen-hand-zone', { actionId: 'upgrade-armament' }, { position: 'top', allowedTargets: ['deck-ming-4'] }),
        action('upgrade-payment', 'SELECT_PAYMENT_CARD', 'PAYMENT_CARD_SELECTED', 'qidahen-hand-zone', { cardId: 'deck-ming-10' }, { position: 'top', allowedTargets: ['deck-ming-10'] }),
        action('upgrade-confirm', 'EXECUTE_SELECTED_ACTION', 'SELECTED_ACTION_EXECUTED', 'qidahen-action-payment-confirm', { actionId: 'upgrade-armament' }),
        choice('dispatch-action', 'menu', ['dispatch'], 'qidahen-turn-option-dispatch'),
        payChoice('dispatch-payment', 'dispatch-payment', ['deck-ming-11']),
        mapChoice('dispatch-source', 'dispatch-source', ['city-region-15']),
        mapChoice('dispatch-troops', 'dispatch-troops', [...sourceInfantry, sourceArtillery], 'city-region-15'),
        mapChoice('dispatch-target', 'dispatch-target', ['city-region-7']),
        info('defender-response', 'qidahen-actions-zone', { aiActions: [response('defender-fight', '1')], autoAdvanceAfterAi: false }),
        action('tactic-card', 'PLAY_TACTIC_CARD', 'TACTIC_CARD_PLAYED', 'qidahen-hand-zone', undefined, { position: 'top', allowedTargets: ['hand-2'], compactTooltipWidth: 260 }),
        action('battle-roll', SYS, 'SYS_INTERACTION_RESOLVED', 'qidahen-actions-zone', { optionId: 'fight' }, { waitForAnimation: true, allowedTargets: ['fight'] }),
        action('occupy', SYS, 'SYS_INTERACTION_RESOLVED', 'qidahen-actions-zone', { optionId: 'occupy' }, { allowedTargets: ['occupy'], compactTooltipWidth: 260 }),
        choice('battle-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'),
        info('opponent-round', 'qidahen-action-wheel', { aiActions: [...emptyTurn('1'), ...emptyTurn('2')], autoAdvanceAfterAi: false }),
        moveStep('diplomacy-move'),
        choice('diplomacy-action', 'menu', ['diplomacy'], 'qidahen-turn-option-diplomacy'),
        mapChoice('diplomacy-target', 'diplomacy-targets', ['city-region-2']),
        choice('diplomacy-finish', 'diplomacy-targets', ['finish-diplomacy'], 'qidahen-turn-option-finish-diplomacy'),
        choice('hire-action', 'menu', ['hire'], 'qidahen-turn-option-hire'),
        payChoice('hire-payment', 'hire-payment', ['deck-ming-12']),
        { ...mapChoice('hire-target', 'hire-target', ['city-region-15-liaodong']), compactTooltipWidth: 260 },
        choice('diplomacy-round-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'),
        choice('save-hand', 'finish-hand', ['skip-hand'], 'qidahen-turn-option-skip-hand'),
        info('new-year', 'qidahen-chronology-zone', { aiDelayMs: 1000, aiActions: [freeMove('1'), response('finish-slot', '1')], autoAdvanceAfterAi: false }),
        maintenance('maintain-shanhai', 'maintain'),
        payChoice('maintenance-first-card', 'maintenance-payment', ['deck-ming-13']),
        payChoice('maintenance-second-card', 'maintenance-payment', ['deck-ming-14']),
        maintenance('abandon-jinzhou', 'abandon'),
        maintenance('abandon-ningyuan', 'abandon'),
        maintenance('abandon-inner-wall', 'abandon'),
        maintenance('abandon-outer-wall', 'abandon'),
        upkeep('upkeep-yehe', ['deck-ming-15', 'deck-ming-16', 'deck-ming-17'], 'city-region-7'),
        upkeep('upkeep-xianxing', ['deck-ming-18'], 'xian-xing'),
        info('other-upkeep', 'qidahen-map-layer', { aiActions: [response('hand-10', '2')], autoAdvanceAfterAi: false }),
        upkeep('upkeep-liaobei', ['deck-ming-19', 'deck-ming-20', 'deck-ming-21', 'deck-ming-22'], 'city-region-15'),
        upkeep('upkeep-pyongyang', ['ming-post-sarhu-1619-pyongyang-mercenary-infantry-lv2__compat__1'], 'city-region-18'),
        upkeep('upkeep-hanseong', ['ming-post-sarhu-1619-hanseong-mercenary-infantry-lv2__compat__1'], 'city-region-29'),
        upkeep('upkeep-liaodong', ['ming-post-sarhu-1619-liaodong-regular-artillery-lv1__compat__1'], 'city-region-15-liaodong'),
        choice('claim-year', 'chronology', ['claim'], 'qidahen-chronology-zone'),
        payChoice('chronology-first-card', 'chronology-payment', ['korea-1']),
        payChoice('chronology-second-card', 'chronology-payment', ['korea-2']),
        payChoice('chronology-third-card', 'chronology-payment', ['korea-3']),
        info('new-order', 'qidahen-chronology-zone', { aiActions: [response('mongol-gunchu-ketuji', '1')], autoAdvanceAfterAi: false }),
        choice('year-character', 'year-characters', ['ming-yang-gao'], 'qidahen-turn-option-ming-yang-gao'),
        info('year-ready', 'qidahen-player-float', { aiActions: [response('jin-daisan', '2'), response('skip-hand', '1'), ...emptyTurn('1')], autoAdvanceAfterAi: false }),
        moveStep('training-move'),
        choice('training-action', 'menu', ['recruit-train'], 'qidahen-turn-option-recruit-train'),
        action('training-payment', 'SELECT_PAYMENT_CARD', 'PAYMENT_CARD_SELECTED', 'qidahen-hand-zone', { cardId: 'korea-4' }, { position: 'top', allowedTargets: ['korea-4'] }),
        action('training-payment-confirm', 'CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT', 'WHEEL_RECRUIT_TRAIN_PAYMENT_RESOLVED', 'qidahen-wheel-recruit-train-payment-confirm'),
        action('training-kind', 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', 'qidahen-wheel-recruit-train-selection', { choiceId: 'action:train' }, { allowedTargets: ['action:train'] }),
        action('training-target', 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', `qidahen-wheel-recruit-train-choice-${encodeURIComponent(`train:${sourceArtillery}`)}`, { choiceId: `train:${sourceArtillery}` }, { allowedTargets: [`train:${sourceArtillery}`] }),
        action('training-finish', 'RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', 'qidahen-wheel-recruit-train-choice-finish', { choiceId: 'finish' }, { allowedTargets: ['finish'] }),
        choice('training-slot-finish', 'menu', ['finish-slot'], 'qidahen-turn-option-finish-slot'),
        choice('training-round-finish', 'finish-hand', ['skip-hand'], 'qidahen-turn-option-skip-hand'),
        info('finish', 'qidahen-map-layer', { position: 'right' }),
    ] satisfies TutorialStep[]).map(step => {
        const target = step.highlightTarget === 'qidahen-hand-zone' && step.allowedTargets?.length === 1
            ? `qidahen-hand-card-${step.allowedTargets[0]}` : step.id === 'recruit-troops' ? 'qidahen-recruit-choice-level-2-troops' : step.highlightTarget;
        const framed = step.highlightTarget === 'qidahen-hand-zone' || step.id === 'finish' ? { ...step, highlightTarget: target, highlightFrame: 'none' as const } : { ...step, highlightTarget: target };
        return SELF_EXPLANATORY_INPUTS.has(step.id) ? { ...framed, content: '', hideOverlay: true } : framed;
    }),
};
