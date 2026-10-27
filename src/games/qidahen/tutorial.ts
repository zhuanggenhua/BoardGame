import type { MatchState, TutorialCollection, TutorialManifest } from '../../engine/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS } from './domain/commands';
import {
    QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID,
    QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID,
    QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID,
} from './domain/interactionSources';
import { getQidahenWheelRecruitTrainChoices } from './domain/wheelRecruitTrain';
import type { QidahenCore } from './domain/types';

export const QIDAHEN_DEFAULT_TUTORIAL_ID = 'basic-opening';
const asCore = (state: MatchState<unknown>): QidahenCore => state.core as QidahenCore;

const QIDAHEN_MAP_RESULT_STEP_FOCUS = {
    highlightTarget: 'qidahen-map-result-feedback',
    position: 'right' as const,
    avoidOverlapSelectors: ['[data-testid="qidahen-map-result-feedback-safe-zone"]'],
    tooltipMaxWidth: 300,
};

const QIDAHEN_SEASON_SUMMARY_STEP_FOCUS = {
    highlightTarget: 'qidahen-season-summary',
    position: 'left' as const,
    avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
    tooltipMaxWidth: 300,
};

const QIDAHEN_PAYMENT_STEP_FOCUS = {
    hideActionHint: true,
    tooltipOffsetY: -6,
    compactTooltipWidth: 760,
    compactAvoidOverlapSelectors: ['[data-testid="qidahen-hand-zone"]', '[data-testid="qidahen-action-payment-panel"]'],
    avoidOverlapSelectors: [
        '[data-testid="qidahen-action-payment-panel"]',
        '[data-testid="qidahen-draw-pile"]',
        '[data-testid="qidahen-draw-anchor"]',
        '[data-testid="qidahen-discard-anchor"]',
        '[data-testid="qidahen-hand-interaction-tray"]',
    ],
};

const QIDAHEN_WHEEL_DISPATCH_PAYMENT_STEP_FOCUS = {
    avoidOverlapSelectors: [
        '[data-testid="qidahen-wheel-dispatch-payment-panel"]',
        '[data-testid="qidahen-hand-interaction-tray"]',
        '[data-testid="qidahen-hand-zone"]',
        '[data-testid="qidahen-discard-anchor"]',
    ],
};

const QIDAHEN_PLAYER_FLOAT_STEP_FOCUS = {
    avoidOverlapSelectors: [
        '[data-testid="qidahen-actions-zone"]',
        '[data-testid="qidahen-hand-zone"]',
        '[data-testid="qidahen-chronology-zone"]',
        '[data-testid="qidahen-draw-anchor"]',
        '[data-testid="qidahen-discard-anchor"]',
    ],
};

const QIDAHEN_MAP_INFO_STEP_FOCUS = {
    avoidOverlapSelectors: [
        '[data-testid="qidahen-actions-zone"]',
        '[data-testid="qidahen-player-float"]',
        '[data-testid="qidahen-hand-zone"]',
        '[data-testid="qidahen-chronology-zone"]',
        '[data-testid="qidahen-draw-anchor"]',
        '[data-testid="qidahen-discard-anchor"]',
    ],
};

const QIDAHEN_WHEEL_HOVER_STEP_FOCUS = {
    avoidOverlapSelectors: ['[data-testid="qidahen-wheel-tip"]'],
};

const attackAndBattleStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'action-overview':
            return core.turnPhase === 'action-window'
                && core.factionActionUsed === false
                && core.actionChoices.length >= 2;
        case 'choose-action':
            return core.turnPhase === 'action-window'
                && core.factionActionUsed === false;
        case 'pay-raid':
            return core.turnPhase === 'action-window'
                && core.selectedActionId === 'raid'
                && core.confirmedActionId === 'raid'
                && core.payment.required === 1;
        case 'border-width':
        case 'battle-open':
        case 'tactic-window':
        case 'battle-damage':
            return Boolean(core.pendingTargetAction);
        case 'retreat-and-defeat':
            return Boolean(core.postBattleSelection);
        case 'post-battle-choice':
            return Boolean(core.postBattleSelection);
        case 'battle-result':
            return Boolean(core.postBattleSelection);
        case 'battle-finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const retreatAndRoutStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const sourceRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-16');
    switch (step.id) {
        case 'choose-rout':
            return Boolean(core.pendingTargetAction);
        case 'rout-result':
            return Boolean(core.lastSeasonSummary)
                && (core.factions.ming.defeatMarkers ?? 0) > 0
                && (sourceRegion?.troops ?? 0) === 0;
        case 'finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const cavalryPlunderStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'choose-plunder':
            return Boolean(core.pendingTargetAction);
        case 'plunder-result':
        case 'finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const cavalryEvasionStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'choose-evasion':
            return Boolean(core.pendingTargetAction);
        case 'evasion-result':
        case 'finish':
            return (core.lastSeasonSummary?.lines ?? []).some((line) => line.includes('骑兵避战'));
        default:
            return true;
    }
};

const neutralInvasionStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'resolve-neutral':
            {
                const pendingTargetAction = core.pendingTargetAction;
                return pendingTargetAction != null
                    && pendingTargetAction.targetRuntimeRegionId === 'city-region-20'
                    && pendingTargetAction.defenderFactionId === 'neutral';
            }
        case 'neutral-result':
        case 'finish':
            return (core.lastSeasonSummary?.lines ?? []).some((line) => line.includes('中立守军'))
                || core.regions.some((region) => (
                    !region.isLogicalRegion
                    && region.id === 'city-region-20'
                    && region.controller === 'neutral'
                    && region.troops > 0
                    && (region.note ?? '').includes('中立守军')
                ));
        default:
            return true;
    }
};

const waterDispatchStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const pending = core.pendingTargetAction;
    switch (step.id) {
        case 'choose-water-target':
            return core.turnPhase === 'dispatch-targeting'
                && core.actionWheelPosition === 'wheel-hire'
                && core.selectedRegionId === 'song-jin';
        case 'water-boundary':
            return Boolean(pending)
                && pending?.sourceRegionId === 'song-jin'
                && pending?.targetRuntimeRegionId === 'city-region-22'
                && pending?.attackBoundaryType === 'coast'
                && pending?.boundaryUnitCap === 2;
        case 'finish':
            return Boolean(pending)
                && pending?.attackBoundaryType === 'coast'
                && pending?.boundaryUnitCap === 2;
        default:
            return true;
    }
};

const wheelSharedCostStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'choose-move':
            return core.turnPhase === 'action-window'
                && core.actionWheelPosition === 'wheel-military-farm'
                && core.wheelActionUsed === false;
        case 'draw-result':
            return core.turnPhase === 'dispatch-targeting'
                && core.actionWheelPosition === 'wheel-hire'
                && core.selectedRegionId === 'city-region-24'
                && core.factions.mongol.handCount >= 8
                && core.factions.jin.handCount >= 12;
        case 'dispatch-rule':
        case 'pay-dispatch':
            return core.turnPhase === 'dispatch-targeting'
                && core.actionWheelPosition === 'wheel-hire'
                && core.selectedRegionId === 'city-region-24'
                && core.payment.required === 1
                && core.factions.mongol.handCount >= 8
                && core.factions.jin.handCount >= 12;
        case 'finish':
            return core.turnPhase === 'dispatch-targeting'
                && core.actionWheelPosition === 'wheel-hire'
                && core.selectedRegionId === 'city-region-24'
                && core.payment.required === 0
                && core.selectedPaymentCardIds.length === 0
                && core.factions.mongol.handCount >= 7
                && core.factions.jin.handCount >= 12;
        default:
            return true;
    }
};

const wheelReclaimStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-24');
    switch (step.id) {
        case 'choose-move':
            return core.turnPhase === 'action-window'
                && core.actionWheelPosition === 'wheel-new-year'
                && core.wheelActionUsed === false;
        case 'result':
        case 'finish':
            return core.lastSeasonSummary?.title === '轮盘开垦'
                && core.actionWheelPosition === 'wheel-reclaim'
                && (targetRegion?.population ?? 0) >= 7;
        default:
            return true;
    }
};

const wheelMilitaryFarmStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-24');
    switch (step.id) {
        case 'choose-move':
            return core.turnPhase === 'action-window'
                && core.actionWheelPosition === 'wheel-reclaim'
                && core.wheelActionUsed === false;
        case 'result':
        case 'finish':
            return core.lastSeasonSummary?.title === '轮盘军屯'
                && core.actionWheelPosition === 'wheel-military-farm'
                && (targetRegion?.troops ?? 0) >= 3
                && core.factions.ming.handCount >= 5;
        default:
            return true;
    }
};

const wheelRecruitTrainStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const progress = core.wheelRecruitTrainProgress;
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-24');
    const artilleryTech = core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech');
    switch (step.id) {
        case 'rule-payment':
        case 'choose-move':
            return core.turnPhase === 'action-window'
                && core.actionWheelPosition === 'wheel-military-farm'
                && core.wheelActionUsed === false
                && progress == null;
        case 'pay-initial':
            return progress?.phase === 'payment' && progress.paymentPurpose === 'initial';
        case 'actions-rule':
            return progress?.phase === 'choose-action' && progress.actionsCompleted === 0;
        case 'choose-training':
            return progress?.phase === 'choose-action'
                && progress.actionsCompleted === 0
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => choice.id === 'action:train');
        case 'choose-training-target':
            return progress?.phase === 'choose-training-target'
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => (
                    choice.regionId === 'city-region-24'
                    && choice.troopKind === 'artillery'
                    && choice.level === 1
                ));
        case 'recruit-train-artillery-rule':
        case 'artillery-rule':
            return progress?.phase === 'choose-training-target'
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => (
                    choice.regionId === 'city-region-24' && choice.troopKind === 'artillery'
                ));
        case 'recruit-train-homeland-rule':
        case 'recruit-homeland-rule':
            return progress?.phase === 'choose-recruit-target';
        case 'training-result':
            return progress?.phase === 'choose-action' && progress.actionsCompleted === 1;
        case 'choose-recruit':
            return progress?.phase === 'choose-action'
                && progress.actionsCompleted === 1
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => choice.id === 'action:recruit');
        case 'choose-recruit-target':
            return progress?.phase === 'choose-recruit-target';
        case 'recruit-result':
            return progress?.phase === 'choose-action' && progress.actionsCompleted === 2;
        case 'extra-training-rule':
            return progress?.phase === 'choose-action'
                && progress.actionsCompleted === 2
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => choice.kind === 'extra-training');
        case 'choose-extra-training':
            return progress?.phase === 'choose-action'
                && progress.actionsCompleted === 2
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => choice.kind === 'extra-training');
        case 'pay-extra':
            return progress?.phase === 'payment' && progress.paymentPurpose === 'extra';
        case 'choose-extra-training-target':
            return progress?.phase === 'extra-training-target';
        case 'extra-training-result':
            return progress?.phase === 'choose-action'
                && progress.actionsCompleted === 2
                && progress.extraTrainingsCompleted === 1;
        case 'finish-action':
            return progress?.phase === 'choose-action'
                && progress.actionsCompleted === 2
                && progress.extraTrainingsCompleted === 1;
        case 'result':
            return core.wheelRecruitTrainProgress == null
                && core.lastSeasonSummary?.title === '轮盘征兵/训练'
                && core.actionWheelPosition === 'wheel-recruit-train'
                && (targetRegion?.troops ?? 0) >= 2
                && (artilleryTech?.level ?? 0) >= 2;
        case 'finish':
            return core.wheelRecruitTrainProgress == null
                && core.lastSeasonSummary?.title === '轮盘征兵/训练';
        default:
            return true;
    }
};

const armamentUpgradeStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const artilleryTech = core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech');
    switch (step.id) {
        case 'action-overview':
        case 'choose-action':
            return core.turnPhase === 'action-window'
                && core.factionActionUsed === false
                && (artilleryTech?.level ?? 0) === 1
                && core.payment.required === 0;
        case 'pay-cards':
            return core.selectedActionId === 'upgrade-armament'
                && core.factionActionUsed === false
                && (artilleryTech?.level ?? 0) === 1
                && core.payment.required === 2;
        case 'result':
        case 'finish':
            return core.lastSeasonSummary?.title === '升级军备'
                && (artilleryTech?.level ?? 0) === 2;
        default:
            return true;
    }
};

const eventActionStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const progress = core.wheelRecruitTrainProgress;
    switch (step.id) {
        case 'action-overview':
            return core.turnPhase === 'action-window'
                && core.factionActionUsed === false
                && core.payment.required === 0
                && core.actionChoices.length >= 2;
        case 'choose-action':
            return core.turnPhase === 'action-window'
                && core.selectedActionId === 'khan-edict'
                && core.factionActionUsed === false
                && core.payment.required === 0;
        case 'pay-cards':
            return core.turnPhase === 'action-window'
                && core.selectedActionId === 'khan-edict'
                && core.payment.required === 1
                && core.factionActionUsed === false;
        case 'choose-effect':
            return core.turnPhase === 'khan-edict-choice'
                && core.selectedActionId === 'khan-edict';
        case 'recruit-train-actions-rule':
            return progress?.source === 'khan-edict' && progress.phase === 'choose-action';
        case 'choose-recruit':
            return progress?.source === 'khan-edict'
                && progress.phase === 'choose-action'
                && progress.actionsCompleted === 0
                && getQidahenWheelRecruitTrainChoices(core).some((choice) => choice.id === 'action:recruit');
        case 'recruit-homeland-rule':
        case 'choose-recruit-target':
            return progress?.source === 'khan-edict' && progress.phase === 'choose-recruit-target';
        case 'recruit-result':
            return progress?.source === 'khan-edict'
                && progress.phase === 'choose-action'
                && progress.actionsCompleted === 1;
        case 'finish-recruit-train':
            return progress?.source === 'khan-edict'
                && progress.phase === 'choose-action'
                && progress.actionsCompleted === 1;
        case 'result':
            return progress == null && core.lastSeasonSummary?.title === '大汗令箭 · 征兵训练';
        case 'finish':
            return progress == null && core.lastSeasonSummary?.title === '大汗令箭 · 征兵训练';
        default:
            return true;
    }
};

const siegeStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const pendingTargetAction = core.pendingTargetAction;
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-25');
    const hasBattleResult = Boolean(core.lastSeasonSummary);
    switch (step.id) {
        case 'defend-city':
            return Boolean(pendingTargetAction)
                && pendingTargetAction?.targetRuntimeRegionId === 'city-region-25'
                && pendingTargetAction?.battleMode !== 'city';
        case 'city-battle':
            return Boolean(pendingTargetAction)
                && pendingTargetAction?.targetRuntimeRegionId === 'city-region-25'
                && pendingTargetAction?.battleMode === 'city';
        case 'city-result':
        case 'choose-post-battle-outcome':
            return Boolean(core.postBattleSelection);
        case 'besiege-result':
            return hasBattleResult && targetRegion?.siegeState?.attackerFactionId === 'ming';
        case 'occupy-result':
            return hasBattleResult
                && targetRegion?.controller === 'ming'
                && targetRegion.cityState == null
                && targetRegion.siegeState == null;
        case 'withdraw-result':
            return hasBattleResult
                && targetRegion?.controller === 'jin'
                && targetRegion.siegeState == null
                && targetRegion.cityState != null;
        case 'finish':
            return hasBattleResult;
        default:
            return true;
    }
};

const diplomacyHireStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'choose-target':
            return core.turnPhase === 'diplomacy-choice';
        case 'friendly-mark':
            return core.turnPhase === 'diplomacy-choice';
        case 'tribute-mark':
            return core.turnPhase === 'diplomacy-choice';
        case 'remove-mark':
            return core.turnPhase === 'diplomacy-choice';
        case 'finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const yearAndCharactersStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const activeInteractionSourceId = (
        state.sys.interaction?.current?.data as { sourceId?: unknown } | undefined
    )?.sourceId;
    switch (step.id) {
        case 'advance-midyear':
            return core.turnPhase === 'action-window'
                && core.lastSeasonSummary == null;
        case 'midyear-tax':
        case 'midyear-characters':
            return core.lastSeasonSummary?.title === '年中结算';
        case 'advance-new-year':
            return core.turnPhase !== 'season-resolution'
                && core.lastSeasonSummary?.title === '年中结算';
        case 'new-year-tribute':
            return core.turnPhase === 'season-resolution';
        case 'new-year-maintenance':
            return core.turnPhase === 'season-resolution'
                && activeInteractionSourceId === QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID;
        case 'new-year-attrition':
        case 'chronology-score':
        case 'turn-order-refresh':
        case 'finish':
            return core.lastSeasonSummary?.title === '新年结算';
        default:
            return true;
    }
};

const koreaSpecialStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'korea-region':
        case 'hanseong-vp':
            return core.turnPhase === 'season-resolution'
                && core.actionWheelPosition === 'wheel-new-year'
                && core.koreaDeckCount >= 0;
        case 'water-limit':
            return core.turnPhase === 'season-resolution'
                && core.actionWheelPosition === 'wheel-new-year';
        case 'new-year-maintenance':
            return core.turnPhase === 'season-resolution'
                && core.actionWheelPosition === 'wheel-new-year';
        case 'korea-attrition':
            return core.lastSeasonSummary?.title === '新年结算';
        case 'shanhaiguan':
        case 'finish':
            return core.lastSeasonSummary?.title === '新年结算';
        default:
            return true;
    }
};

const basicOpeningStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    if (step.id === 'action-branch-recovery') {
        return core.confirmedActionId !== 'raid';
    }
    if (step.id === 'payment-branch-recovery') {
        const selectedCards = core.handCards.filter((card) => core.selectedPaymentCardIds.includes(card.id));
        return selectedCards.length !== 1 || selectedCards[0]?.cardKind !== 'silver';
    }
    if (step.id === 'occupation-branch-recovery') {
        return core.regions.find((region) => region.id === 'city-region-7')?.controller !== 'ming';
    }
    if (step.id === 'battle-branch-recovery') {
        return core.postBattleSelection == null;
    }
    return true;
};

const QIDAHEN_BASIC_TUTORIAL: TutorialManifest = {
    id: QIDAHEN_DEFAULT_TUTORIAL_ID,
    revision: 15,
    stepValidator: basicOpeningStepValidator,
    numPlayers: 3,
    randomPolicy: { mode: 'sequence', values: [1, 1, 4, 4, 4] },
    stayOnMatchAfterCompletion: true,
    steps: ([
        {
            id: 'frontier',
            content: 'game-qidahen:tutorial.basic.steps.frontier',
            highlightTarget: 'qidahen-map-layer',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'select-farm-region',
            content: 'game-qidahen:tutorial.basic.steps.selectFarmRegion',
            highlightTarget: 'qidahen-map-region-focus-city-region-15-liaodong',
            highlightFrame: 'none',
            avoidOverlapSelectors: ['[data-testid="qidahen-map-region-focus-name"]'],
            position: 'right',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
            advanceOnEvents: [{ type: 'REGION_SELECTED', match: { regionId: 'city-region-15-liaodong' } }],
        },
        {
            id: 'wheel-move',
            content: 'game-qidahen:tutorial.basic.steps.wheelMove',
            highlightTarget: 'qidahen-wheel-move-move-2-one-opponent',
            position: 'right',
            ...QIDAHEN_WHEEL_HOVER_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_SELECTED', match: { moveId: 'move-2-one-opponent' } }],
        },
        {
            id: 'wheel-opponent',
            content: 'game-qidahen:tutorial.basic.steps.wheelOpponent',
            highlightTarget: 'qidahen-wheel-opponent-picker',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-2-one-opponent' } }],
        },
        {
            id: 'wheel-result',
            content: 'game-qidahen:tutorial.basic.steps.wheelResult',
            ...QIDAHEN_SEASON_SUMMARY_STEP_FOCUS,
            avoidOverlapSelectors: [
                ...QIDAHEN_SEASON_SUMMARY_STEP_FOCUS.avoidOverlapSelectors,
                '[data-testid="qidahen-hand-row"]',
                '[data-testid="fab-menu"]',
            ],
            infoStep: true,
        },
        {
            id: 'choose-raid',
            content: 'game-qidahen:tutorial.basic.steps.chooseRaid',
            highlightTarget: 'qidahen-action-raid',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED' }],
        },
        {
            id: 'action-branch-recovery', content: '',
            aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: {
                kind: 'branch-recovery', recoveryStepId: 'choose-raid',
                reason: '本回合从辽东突袭叶赫，恢复行动选择前完整检查点，由玩家重新选择突袭。',
            },
        },
        {
            id: 'choose-target',
            content: 'game-qidahen:tutorial.basic.steps.chooseTarget',
            highlightTarget: 'qidahen-map-region-focus-city-region-7',
            highlightFrame: 'none',
            avoidOverlapSelectors: ['[data-testid="qidahen-map-region-focus-name"]', '[data-testid="qidahen-action-payment-panel"]'],
            position: 'right',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
            advanceOnEvents: [{ type: 'REGION_SELECTED', match: { regionId: 'city-region-7' } }],
        },
        {
            id: 'pay-raid',
            content: 'game-qidahen:tutorial.basic.steps.payRaid',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD],
            advanceOnEvents: [{ type: 'PAYMENT_CARD_SELECTED' }],
        },
        {
            id: 'payment-branch-recovery', content: '',
            aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: {
                kind: 'branch-recovery', recoveryStepId: 'pay-raid',
                reason: '弃掉战术牌会使本课后续战术操作失去来源；恢复支付前完整检查点，由玩家重新选择银两。',
            },
        },
        {
            id: 'confirm-raid-payment',
            content: 'game-qidahen:tutorial.basic.steps.confirmRaidPayment',
            highlightTarget: 'qidahen-action-payment-confirm',
            position: 'top',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'raid' } }],
        },
        {
            id: 'battle-open',
            content: 'game-qidahen:tutorial.basic.steps.battleOpen',
            highlightTarget: 'qidahen-raid-intent',
            position: 'left',
            infoStep: true,
            aiActions: [{ commandType: INTERACTION_COMMANDS.RESPOND, playerId: '1', payload: { optionId: 'defender-fight' } }],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'play-tactic',
            content: 'game-qidahen:tutorial.basic.steps.playTactic',
            highlightTarget: 'qidahen-atlas05-1644-yuanyang-zhen',
            position: 'top',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.PLAY_TACTIC_CARD],
            advanceOnEvents: [{ type: 'TACTIC_CARD_PLAYED' }],
        },
        {
            id: 'resolve-battle',
            content: 'game-qidahen:tutorial.basic.steps.resolveBattle',
            highlightTarget: 'qidahen-resolve-pending-action',
            position: 'left',
            avoidOverlapSelectors: ['[data-pending-committed-selectable="true"]'],
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION, INTERACTION_COMMANDS.RESPOND],
            advanceOnEvents: [
                { type: 'PENDING_ACTION_RESOLVED' },
                { type: 'SYS_INTERACTION_RESOLVED', match: { sourceId: QIDAHEN_PENDING_TARGET_INTERACTION_SOURCE_ID } },
            ],
        },
        {
            id: 'battle-branch-recovery', content: '',
            aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: {
                kind: 'branch-recovery', recoveryStepId: 'resolve-battle',
                reason: '本课以3支部队从辽东进攻叶赫；其他出兵数产生了未教学的败军退却，恢复结算前完整检查点重新选兵。',
            },
        },
        {
            id: 'battle-result',
            content: 'game-qidahen:tutorial.basic.steps.battleResult',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'occupy',
            content: 'game-qidahen:tutorial.basic.steps.occupy',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION, INTERACTION_COMMANDS.RESPOND],
            advanceOnEvents: [
                { type: 'POST_BATTLE_DECISION_RESOLVED' },
                { type: 'SYS_INTERACTION_RESOLVED', match: { sourceId: QIDAHEN_POST_BATTLE_INTERACTION_SOURCE_ID } },
            ],
        },
        {
            id: 'occupation-branch-recovery', content: '',
            aiActions: [{ commandType: 'SYS_TUTORIAL_PREVIOUS', playerId: '0', payload: {} }],
            hiddenAutomation: {
                kind: 'branch-recovery', recoveryStepId: 'occupy',
                reason: '撤回是正式合法选择；本课演示占领后的控制区变化，恢复战后选择前完整检查点再由玩家占领。',
            },
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.basic.steps.finish',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
    ] satisfies TutorialManifest['steps']).map((step: TutorialManifest['steps'][number]) => ({
        ...step,
        avoidOverlapSelectors: [...new Set(['[data-testid="qidahen-player-float"]', '[data-testid="fab-menu"]', ...(step.avoidOverlapSelectors ?? [])])],
    })),
};
const QIDAHEN_ATTACK_AND_BATTLE_TUTORIAL: TutorialManifest = {
    id: 'attack-and-battle',
    stepValidator: attackAndBattleStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'action-overview',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.actionOverview',
            highlightTarget: 'qidahen-actions-zone',
            position: 'left',
            infoStep: true,
            showMask: false,
        },
        {
            id: 'choose-action',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.chooseAction',
            highlightTarget: 'qidahen-action-raid',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'raid' } }],
        },
        {
            id: 'pay-raid',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.payRaid',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'raid' } }],
        },
        {
            id: 'border-width',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.borderWidth',
            highlightTarget: 'qidahen-raid-intent',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'battle-open',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.battleOpen',
            highlightTarget: 'qidahen-raid-intent',
            position: 'left',
            infoStep: true,
            aiActions: [{ commandType: INTERACTION_COMMANDS.RESPOND, playerId: '2', payload: { optionId: 'defender-fight' } }],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'tactic-window',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.tacticWindow',
            highlightTarget: 'qidahen-atlas05-1618-cavalry-charge',
            position: 'left',
            allowedCommands: [QIDAHEN_COMMANDS.PLAY_TACTIC_CARD],
            advanceOnEvents: [{ type: 'TACTIC_CARD_PLAYED' }],
        },
        {
            id: 'battle-damage',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.battleDamage',
            highlightTarget: 'qidahen-resolve-pending-action',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED' }],
        },
        {
            id: 'battle-result',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.battleResult',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'retreat-and-defeat',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.retreatAndDefeat',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'post-battle-choice',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.postBattleChoice',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION],
            advanceOnEvents: [{ type: 'POST_BATTLE_DECISION_RESOLVED' }],
        },
        {
            id: 'battle-finish',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.finish',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
    ],
};

const QIDAHEN_SIEGE_TUTORIAL: TutorialManifest = {
    id: 'siege-and-occupation',
    revision: 1,
    stepValidator: siegeStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.siege.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'defend-city',
            content: 'game-qidahen:tutorial.siege.steps.defendCity',
            highlightTarget: 'qidahen-resolve-pending-action-defender-hold-city',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED', match: { defenderHoldCity: true } }],
        },
        {
            id: 'city-battle',
            content: 'game-qidahen:tutorial.siege.steps.cityBattle',
            highlightTarget: 'qidahen-resolve-pending-action',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED' }],
        },
        {
            id: 'city-result',
            content: 'game-qidahen:tutorial.siege.steps.cityResult',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'choose-post-battle-outcome',
            content: 'game-qidahen:tutorial.siege.steps.postBattleOutcome',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            tooltipMaxWidth: 360,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION],
            advanceOnEvents: [{ type: 'POST_BATTLE_DECISION_RESOLVED' }],
        },
        {
            id: 'besiege-result',
            content: 'game-qidahen:tutorial.siege.steps.besiegeResult',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            infoStep: true,
        },
        {
            id: 'occupy-result',
            content: 'game-qidahen:tutorial.siege.steps.occupyResult',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            infoStep: true,
        },
        {
            id: 'withdraw-result',
            content: 'game-qidahen:tutorial.siege.steps.withdrawResult',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.siege.steps.finish',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
    ],
};

const QIDAHEN_RETREAT_AND_ROUT_TUTORIAL: TutorialManifest = {
    id: 'retreat-and-rout',
    revision: 1,
    stepValidator: retreatAndRoutStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.retreatAndRout.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-rout',
            content: 'game-qidahen:tutorial.retreatAndRout.steps.chooseRout',
            highlightTarget: 'qidahen-resolve-pending-action-rout',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED', match: { retreatLossMode: 'rout' } }],
        },
        {
            id: 'rout-result',
            content: 'game-qidahen:tutorial.retreatAndRout.steps.routResult',
            highlightTarget: 'qidahen-player-float',
            position: 'top',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            avoidOverlapSelectors: [
                ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS.avoidOverlapSelectors,
                '[data-testid="fab-menu"]',
            ],
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.retreatAndRout.steps.finish',
            highlightTarget: 'qidahen-player-float',
            position: 'top',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            avoidOverlapSelectors: [
                ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS.avoidOverlapSelectors,
                '[data-testid="fab-menu"]',
            ],
            infoStep: true,
        },
    ],
};

const QIDAHEN_CAVALRY_PLUNDER_TUTORIAL: TutorialManifest = {
    id: 'cavalry-plunder',
    stepValidator: cavalryPlunderStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.cavalryPlunder.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-plunder',
            content: 'game-qidahen:tutorial.cavalryPlunder.steps.choosePlunder',
            highlightTarget: 'qidahen-resolve-pending-action-cavalry-plunder-defender',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED', match: { attackerCavalryPlunder: true } }],
        },
        {
            id: 'plunder-result',
            content: 'game-qidahen:tutorial.cavalryPlunder.steps.plunderResult',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.cavalryPlunder.steps.finish',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
    ],
};

const QIDAHEN_CAVALRY_EVASION_TUTORIAL: TutorialManifest = {
    id: 'cavalry-evasion',
    stepValidator: cavalryEvasionStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.cavalryEvasion.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-evasion',
            content: 'game-qidahen:tutorial.cavalryEvasion.steps.chooseEvasion',
            highlightTarget: 'qidahen-resolve-pending-action-cavalry-evasion-city-region-19',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED', match: { defenderCavalryEvasion: true } }],
        },
        {
            id: 'evasion-result',
            content: 'game-qidahen:tutorial.cavalryEvasion.steps.evasionResult',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.cavalryEvasion.steps.finish',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
    ],
};

const QIDAHEN_NEUTRAL_INVASION_TUTORIAL: TutorialManifest = {
    id: 'neutral-invasion',
    stepValidator: neutralInvasionStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.neutralInvasion.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'resolve-neutral',
            content: 'game-qidahen:tutorial.neutralInvasion.steps.resolveNeutral',
            highlightTarget: 'qidahen-resolve-pending-action',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED' }],
        },
        {
            id: 'neutral-result',
            content: 'game-qidahen:tutorial.neutralInvasion.steps.neutralResult',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.neutralInvasion.steps.finish',
            highlightTarget: 'qidahen-region-city-region-20',
            position: 'top',
            infoStep: true,
        },
    ],
};

const QIDAHEN_WATER_DISPATCH_TUTORIAL: TutorialManifest = {
    id: 'water-dispatch',
    stepValidator: waterDispatchStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.waterDispatch.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-water-target',
            content: 'game-qidahen:tutorial.waterDispatch.steps.chooseWaterTarget',
            highlightTarget: 'qidahen-wheel-dispatch-selection',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
        },
        {
            id: 'water-boundary',
            content: 'game-qidahen:tutorial.waterDispatch.steps.waterBoundary',
            highlightTarget: 'qidahen-raid-intent',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.waterDispatch.steps.finish',
            highlightTarget: 'qidahen-raid-intent',
            position: 'top',
            infoStep: true,
        },
    ],
};

const QIDAHEN_WHEEL_SHARED_COST_TUTORIAL: TutorialManifest = {
    id: 'wheel-shared-cost',
    revision: 1,
    stepValidator: wheelSharedCostStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-move',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.chooseMove',
            highlightTarget: 'qidahen-wheel-move-move-3-all-opponents',
            position: 'right',
            ...QIDAHEN_WHEEL_HOVER_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-3-all-opponents' } }],
        },
        {
            id: 'draw-result',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.drawResult',
            highlightTarget: 'qidahen-player-float',
            position: 'top',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            avoidOverlapSelectors: [
                ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS.avoidOverlapSelectors,
                '[data-testid="fab-menu"]',
            ],
            infoStep: true,
        },
        {
            id: 'dispatch-rule',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.dispatchRule',
            highlightTarget: 'qidahen-wheel-dispatch-payment-panel',
            position: 'left',
            ...QIDAHEN_WHEEL_DISPATCH_PAYMENT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'pay-dispatch',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.payDispatch',
            highlightTarget: 'qidahen-wheel-dispatch-payment-panel',
            position: 'left',
            ...QIDAHEN_WHEEL_DISPATCH_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.CONFIRM_WHEEL_DISPATCH_PAYMENT],
            advanceOnEvents: [{ type: 'WHEEL_DISPATCH_PAYMENT_RESOLVED' }],
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.finish',
            highlightTarget: 'qidahen-wheel-dispatch-selection',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-actions-zone"]'],
            infoStep: true,
        },
    ],
};

const QIDAHEN_WHEEL_RECLAIM_TUTORIAL: TutorialManifest = {
    id: 'wheel-reclaim',
    stepValidator: wheelReclaimStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.wheelReclaim.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-move',
            content: 'game-qidahen:tutorial.wheelReclaim.steps.chooseMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.wheelReclaim.steps.result',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            position: 'left',
            avoidOverlapSelectors: [
                ...QIDAHEN_MAP_RESULT_STEP_FOCUS.avoidOverlapSelectors,
                '[data-testid="qidahen-actions-zone"]',
            ],
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.wheelReclaim.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
        },
    ],
};

const QIDAHEN_WHEEL_MILITARY_FARM_TUTORIAL: TutorialManifest = {
    id: 'wheel-military-farm',
    stepValidator: wheelMilitaryFarmStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.wheelMilitaryFarm.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'choose-move',
            content: 'game-qidahen:tutorial.wheelMilitaryFarm.steps.chooseMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.wheelMilitaryFarm.steps.result',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.wheelMilitaryFarm.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
        },
    ],
};

const QIDAHEN_WHEEL_RECRUIT_TRAIN_TUTORIAL: TutorialManifest = {
    id: 'wheel-recruit-train',
    revision: 1,
    stepValidator: wheelRecruitTrainStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'rule-payment',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.paymentRule',
            highlightTarget: 'qidahen-action-wheel',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'choose-move',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'pay-initial',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.payInitial',
            highlightTarget: 'qidahen-wheel-recruit-train-payment-panel',
            position: 'left',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_PAYMENT_RESOLVED' }],
        },
        {
            id: 'actions-rule',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.actionsRule',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'choose-training',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseTraining',
            highlightTarget: 'qidahen-wheel-recruit-train-choice-action%3Atrain',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', match: { choiceId: 'action:train' } }],
        },
        {
            id: 'artillery-rule',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.artilleryRule',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'choose-training-target',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseTrainingTarget',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED' }],
        },
        {
            id: 'training-result',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.trainingResult',
            highlightTarget: 'qidahen-wheel-recruit-train-last-result',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-map-result-feedback-safe-zone"]'],
            tooltipMaxWidth: 300,
            infoStep: true,
        },
        {
            id: 'choose-recruit',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseRecruit',
            highlightTarget: 'qidahen-wheel-recruit-train-choice-action%3Arecruit',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', match: { choiceId: 'action:recruit' } }],
        },
        {
            id: 'recruit-homeland-rule',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.homelandRule',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'choose-recruit-target',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseRecruitTarget',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED' }],
        },
        {
            id: 'recruit-result',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.recruitResult',
            highlightTarget: 'qidahen-wheel-recruit-train-last-result',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-map-result-feedback-safe-zone"]'],
            tooltipMaxWidth: 300,
            infoStep: true,
        },
        {
            id: 'extra-training-rule',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.extraTrainingRule',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'choose-extra-training',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseExtraTraining',
            highlightTarget: 'qidahen-wheel-recruit-train-choice-extra-training',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', match: { choiceId: 'extra-training' } }],
        },
        {
            id: 'pay-extra',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.payExtra',
            highlightTarget: 'qidahen-wheel-recruit-train-payment-panel',
            position: 'left',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_PAYMENT_RESOLVED' }],
        },
        {
            id: 'choose-extra-training-target',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseExtraTrainingTarget',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED' }],
        },
        {
            id: 'extra-training-result',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.extraTrainingResult',
            highlightTarget: 'qidahen-wheel-recruit-train-last-result',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-map-result-feedback-safe-zone"]'],
            tooltipMaxWidth: 300,
            infoStep: true,
        },
        {
            id: 'finish-action',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.finishAction',
            highlightTarget: 'qidahen-wheel-recruit-train-choice-finish',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', match: { choiceId: 'finish' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.result',
            highlightTarget: 'qidahen-season-summary',
            position: 'left',
            avoidOverlapSelectors: ['[data-testid="qidahen-map-result-feedback-safe-zone"]'],
            tooltipMaxWidth: 300,
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'left',
            infoStep: true,
            showMask: true,
        },
    ],
};

const QIDAHEN_ARMAMENT_UPGRADE_TUTORIAL: TutorialManifest = {
    id: 'armament-upgrade',
    stepValidator: armamentUpgradeStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'action-overview',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.actionOverview',
            highlightTarget: 'qidahen-actions-zone',
            position: 'left',
            infoStep: true,
            showMask: false,
        },
        {
            id: 'choose-action',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.chooseAction',
            highlightTarget: 'qidahen-atlas05-1626-artillery-tech',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'upgrade-armament' } }],
        },
        {
            id: 'pay-cards',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.payCards',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'upgrade-armament' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.result',
            highlightTarget: 'qidahen-player-ming',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
        },
    ],
};

const QIDAHEN_EVENT_ACTION_TUTORIAL: TutorialManifest = {
    id: 'event-action',
    revision: 1,
    stepValidator: eventActionStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.eventAction.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
            viewAs: '1',
        },
        {
            id: 'action-overview',
            content: 'game-qidahen:tutorial.eventAction.steps.actionOverview',
            highlightTarget: 'qidahen-actions-zone',
            position: 'left',
            infoStep: true,
            showMask: false,
            viewAs: '1',
        },
        {
            id: 'choose-action',
            content: 'game-qidahen:tutorial.eventAction.steps.chooseAction',
            highlightTarget: 'qidahen-action-khan-edict',
            position: 'left',
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'khan-edict' } }],
        },
        {
            id: 'pay-cards',
            content: 'game-qidahen:tutorial.eventAction.steps.payCards',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            ...QIDAHEN_PAYMENT_STEP_FOCUS,
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'khan-edict' } }],
        },
        {
            id: 'choose-effect',
            content: 'game-qidahen:tutorial.eventAction.steps.chooseEffect',
            highlightTarget: 'qidahen-map-guide-hit-target-city-region-25',
            position: 'left',
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
            advanceOnEvents: [{ type: 'KHAN_EDICT_CHOICE_RESOLVED', match: { choiceId: 'recruit-train' } }],
        },
        {
            id: 'recruit-train-actions-rule',
            content: 'game-qidahen:tutorial.eventAction.steps.recruitTrainActionsRule',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            infoStep: true,
            viewAs: '1',
        },
        {
            id: 'choose-recruit',
            content: 'game-qidahen:tutorial.eventAction.steps.chooseRecruit',
            highlightTarget: 'qidahen-wheel-recruit-train-choice-action%3Arecruit',
            position: 'left',
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', match: { choiceId: 'action:recruit' } }],
        },
        {
            id: 'recruit-homeland-rule',
            content: 'game-qidahen:tutorial.eventAction.steps.recruitHomelandRule',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            infoStep: true,
            viewAs: '1',
        },
        {
            id: 'choose-recruit-target',
            content: 'game-qidahen:tutorial.eventAction.steps.chooseRecruitTarget',
            highlightTarget: 'qidahen-wheel-recruit-train-selection',
            position: 'left',
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED' }],
        },
        {
            id: 'recruit-result',
            content: 'game-qidahen:tutorial.eventAction.steps.recruitResult',
            highlightTarget: 'qidahen-wheel-recruit-train-last-result',
            position: 'left',
            infoStep: true,
            viewAs: '1',
        },
        {
            id: 'finish-recruit-train',
            content: 'game-qidahen:tutorial.eventAction.steps.finishRecruitTrain',
            highlightTarget: 'qidahen-wheel-recruit-train-choice-finish',
            position: 'left',
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE],
            advanceOnEvents: [{ type: 'WHEEL_RECRUIT_TRAIN_CHOICE_RESOLVED', match: { choiceId: 'finish' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.eventAction.steps.result',
            highlightTarget: 'qidahen-season-summary',
            position: 'left',
            infoStep: true,
            viewAs: '1',
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.eventAction.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
            viewAs: '1',
        },
    ],
};

const QIDAHEN_DIPLOMACY_HIRE_TUTORIAL: TutorialManifest = {
    id: 'diplomacy-and-hire',
    stepValidator: diplomacyHireStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.diplomacy.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'wheel-entry',
            content: 'game-qidahen:tutorial.diplomacy.steps.wheelEntry',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'choose-target',
            content: 'game-qidahen:tutorial.diplomacy.steps.chooseTarget',
            highlightTarget: 'qidahen-diplomacy-selection',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'friendly-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.friendlyMark',
            highlightTarget: 'qidahen-map-guide-hit-target-city-region-24',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'place-friendly' } }],
        },
        {
            id: 'tribute-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.tributeMark',
            highlightTarget: 'qidahen-diplomacy-choice-flip-vassal',
            position: 'left',
            requireAction: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'flip-vassal' } }],
        },
        {
            id: 'remove-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.removeMark',
            highlightTarget: 'qidahen-map-guide-hit-target-city-region-22',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'remove-marker' } }],
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.diplomacy.steps.finish',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
    ],
};

const QIDAHEN_YEAR_AND_CHARACTERS_TUTORIAL: TutorialManifest = {
    id: 'year-and-characters',
    stepValidator: yearAndCharactersStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'advance-midyear',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.advanceMidyear',
            highlightTarget: 'qidahen-wheel-move-move-2-one-opponent',
            position: 'left',
            ...QIDAHEN_WHEEL_HOVER_STEP_FOCUS,
            viewAs: '1',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-2-one-opponent' } }],
        },
        {
            id: 'midyear-tax',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.midyearTax',
            highlightTarget: 'qidahen-player-float',
            position: 'bottom',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            viewAs: '1',
            infoStep: true,
        },
        {
            id: 'midyear-characters',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.midyearCharacters',
            highlightTarget: 'qidahen-player-float',
            position: 'bottom',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            viewAs: '1',
            infoStep: true,
        },
        {
            id: 'advance-new-year',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.advanceNewYear',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            ...QIDAHEN_WHEEL_HOVER_STEP_FOCUS,
            viewAs: '2',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'new-year-tribute',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.newYearTribute',
            highlightTarget: 'qidahen-korea-zone',
            position: 'top',
            viewAs: '2',
            infoStep: true,
        },
        {
            id: 'new-year-maintenance',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.newYearMaintenance',
            highlightTarget: 'qidahen-fortification-maintenance-choice-auto-pay',
            position: 'left',
            viewAs: '0',
            requireAction: true,
            allowManualSkip: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND, QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],
            advanceOnEvents: [
                { type: 'SYS_INTERACTION_RESOLVED', match: { sourceId: QIDAHEN_FORTIFICATION_MAINTENANCE_INTERACTION_SOURCE_ID } },
                { type: 'FORTIFICATION_MAINTENANCE_RESOLVED' },
            ],
        },
        {
            id: 'new-year-attrition',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.newYearAttrition',
            highlightTarget: 'qidahen-player-float',
            position: 'bottom',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            viewAs: '2',
            infoStep: true,
        },
        {
            id: 'chronology-score',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.chronologyScore',
            highlightTarget: 'qidahen-chronology-zone',
            position: 'top',
            viewAs: '2',
            infoStep: true,
        },
        {
            id: 'turn-order-refresh',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.turnOrderRefresh',
            highlightTarget: 'qidahen-player-float',
            position: 'bottom',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            viewAs: '2',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.finish',
            highlightTarget: 'qidahen-player-float',
            position: 'bottom',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            viewAs: '2',
            infoStep: true,
        },
    ],
};

const QIDAHEN_KOREA_SPECIAL_TUTORIAL: TutorialManifest = {
    id: 'korea-and-special-map-rules',
    stepValidator: koreaSpecialStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'korea-region',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.koreaRegion',
            highlightTarget: 'qidahen-korea-zone',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'hanseong-vp',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.hanseongVp',
            highlightTarget: 'qidahen-player-float',
            position: 'left',
            ...QIDAHEN_PLAYER_FLOAT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'water-limit',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.waterLimit',
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'new-year-maintenance',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.newYearMaintenance',
            highlightTarget: 'qidahen-fortification-maintenance-choice-auto-pay',
            position: 'left',
            requireAction: true,
            allowManualSkip: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND, QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],
        },
        {
            id: 'korea-attrition',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.koreaAttrition',
            ...QIDAHEN_MAP_RESULT_STEP_FOCUS,
            infoStep: true,
        },
        {
            id: 'shanhaiguan',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.shanhaiguan',
            highlightTarget: 'qidahen-map-layer',
            position: 'left',
            ...QIDAHEN_MAP_INFO_STEP_FOCUS,
            tooltipOffsetY: 84,
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
        },
    ],
};

const QIDAHEN_TUTORIAL_ENTRIES: TutorialCollection['tutorials'] = {
        'basic-opening': {
            titleKey: 'tutorial.basic.title',
            descriptionKey: 'tutorial.basic.description',
            manifest: QIDAHEN_BASIC_TUTORIAL,
        },
        'attack-and-battle': {
            titleKey: 'tutorial.attackAndBattle.title',
            descriptionKey: 'tutorial.attackAndBattle.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_ATTACK_AND_BATTLE_TUTORIAL,
        },
        'siege-and-occupation': {
            titleKey: 'tutorial.siege.title',
            descriptionKey: 'tutorial.siege.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_SIEGE_TUTORIAL,
        },
        'retreat-and-rout': {
            titleKey: 'tutorial.retreatAndRout.title',
            descriptionKey: 'tutorial.retreatAndRout.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_RETREAT_AND_ROUT_TUTORIAL,
        },
        'cavalry-evasion': {
            titleKey: 'tutorial.cavalryEvasion.title',
            descriptionKey: 'tutorial.cavalryEvasion.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_CAVALRY_EVASION_TUTORIAL,
        },
        'cavalry-plunder': {
            titleKey: 'tutorial.cavalryPlunder.title',
            descriptionKey: 'tutorial.cavalryPlunder.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_CAVALRY_PLUNDER_TUTORIAL,
        },
        'neutral-invasion': {
            titleKey: 'tutorial.neutralInvasion.title',
            descriptionKey: 'tutorial.neutralInvasion.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_NEUTRAL_INVASION_TUTORIAL,
        },
        'water-dispatch': {
            titleKey: 'tutorial.waterDispatch.title',
            descriptionKey: 'tutorial.waterDispatch.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_WATER_DISPATCH_TUTORIAL,
        },
        'wheel-shared-cost': {
            titleKey: 'tutorial.wheelSharedCost.title',
            descriptionKey: 'tutorial.wheelSharedCost.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_WHEEL_SHARED_COST_TUTORIAL,
        },
        'wheel-reclaim': {
            titleKey: 'tutorial.wheelReclaim.title',
            descriptionKey: 'tutorial.wheelReclaim.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_WHEEL_RECLAIM_TUTORIAL,
        },
        'wheel-military-farm': {
            titleKey: 'tutorial.wheelMilitaryFarm.title',
            descriptionKey: 'tutorial.wheelMilitaryFarm.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_WHEEL_MILITARY_FARM_TUTORIAL,
        },
        'wheel-recruit-train': {
            titleKey: 'tutorial.wheelRecruitTrain.title',
            descriptionKey: 'tutorial.wheelRecruitTrain.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_WHEEL_RECRUIT_TRAIN_TUTORIAL,
        },
        'armament-upgrade': {
            titleKey: 'tutorial.armamentUpgrade.title',
            descriptionKey: 'tutorial.armamentUpgrade.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_ARMAMENT_UPGRADE_TUTORIAL,
        },
        'event-action': {
            titleKey: 'tutorial.eventAction.title',
            descriptionKey: 'tutorial.eventAction.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_EVENT_ACTION_TUTORIAL,
        },
        'diplomacy-and-hire': {
            titleKey: 'tutorial.diplomacy.title',
            descriptionKey: 'tutorial.diplomacy.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_DIPLOMACY_HIRE_TUTORIAL,
        },
        'year-and-characters': {
            titleKey: 'tutorial.yearAndCharacters.title',
            descriptionKey: 'tutorial.yearAndCharacters.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_YEAR_AND_CHARACTERS_TUTORIAL,
        },
        'korea-and-special-map-rules': {
            titleKey: 'tutorial.koreaSpecial.title',
            descriptionKey: 'tutorial.koreaSpecial.description',
            hiddenFromCatalog: true,
            manifest: QIDAHEN_KOREA_SPECIAL_TUTORIAL,
        },
};

const basicTutorialEntry = QIDAHEN_TUTORIAL_ENTRIES[QIDAHEN_DEFAULT_TUTORIAL_ID];
if (!basicTutorialEntry) {
    throw new Error(`Missing Qidahen player tutorial: ${QIDAHEN_DEFAULT_TUTORIAL_ID}`);
}

export const QIDAHEN_PLAYER_TUTORIALS: TutorialCollection = {
    defaultTutorialId: QIDAHEN_DEFAULT_TUTORIAL_ID,
    tutorials: {
        [QIDAHEN_DEFAULT_TUTORIAL_ID]: basicTutorialEntry,
    },
};

export const QIDAHEN_TUTORIAL_QA_SCENARIOS: TutorialCollection['tutorials'] = Object.fromEntries(
    Object.entries(QIDAHEN_TUTORIAL_ENTRIES)
        .filter(([tutorialId]) => tutorialId !== QIDAHEN_DEFAULT_TUTORIAL_ID),
);

export const QIDAHEN_TEST_TUTORIALS: TutorialCollection = {
    defaultTutorialId: QIDAHEN_DEFAULT_TUTORIAL_ID,
    tutorials: QIDAHEN_TUTORIAL_ENTRIES,
};

export const isQidahenTutorialQaRuntime = (): boolean => (
    typeof window !== 'undefined'
    && Boolean((window as Window & { __E2E_TEST_MODE__?: boolean }).__E2E_TEST_MODE__)
);

const QIDAHEN_TUTORIALS = isQidahenTutorialQaRuntime()
    ? QIDAHEN_TEST_TUTORIALS
    : QIDAHEN_PLAYER_TUTORIALS;

export default QIDAHEN_TUTORIALS;
