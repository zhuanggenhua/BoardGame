import type { MatchState, TutorialCollection, TutorialManifest } from '../../engine/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS } from './domain/commands';
import type { QidahenCore } from './domain/types';

export const QIDAHEN_DEFAULT_TUTORIAL_ID = 'basic-opening';

const asCore = (state: MatchState<unknown>): QidahenCore => state.core as QidahenCore;

const basicOpeningStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'pick-action':
            return core.turnPhase === 'action-window'
                && core.factionActionUsed === false;
        case 'choose-grant-pardon-target':
            return core.turnPhase === 'grant-pardon-choice'
                && core.selectedActionId === 'grant-pardon'
                && Boolean(core.grantPardonSelection?.choices.length);
        case 'pay-cards':
            return core.turnPhase === 'action-window'
                && core.selectedActionId === 'grant-pardon'
                && core.payment.required === 3
                && core.grantPardonSelection == null;
        case 'action-result':
        case 'morale-level':
        case 'wheel-action':
        case 'finish':
            return core.lastSeasonSummary?.title === '赐印招安';
        default:
            return true;
    }
};

const attackAndBattleStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
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
        case 'dispatch-ready':
            return core.turnPhase === 'dispatch-targeting'
                && core.actionWheelPosition === 'wheel-hire'
                && core.selectedRegionId === 'city-region-24'
                && core.factions.mongol.handCount >= 8
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
    const targetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-24');
    const artilleryTech = core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech');
    switch (step.id) {
        case 'choose-move':
            return (
            core.turnPhase === 'action-window'
            && core.actionWheelPosition === 'wheel-military-farm'
            && core.wheelActionUsed === false
            );
        case 'result':
        case 'finish':
            return (
                core.lastSeasonSummary?.title === '轮盘征兵/训练'
                && core.actionWheelPosition === 'wheel-recruit-train'
                && (targetRegion?.troops ?? 0) >= 4
                && (artilleryTech?.level ?? 0) >= 2
            );
        default:
            return true;
    }
};

const armamentUpgradeStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const artilleryTech = core.factions.ming.armaments.find((armament) => armament.id === 'artillery-tech');
    switch (step.id) {
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
    const recruitTargetRegion = core.regions.find((region) => !region.isLogicalRegion && region.id === 'city-region-25');
    switch (step.id) {
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
        case 'result':
            return core.lastSeasonSummary?.title === '大汗令箭';
        case 'finish':
            return core.lastSeasonSummary?.title === '大汗令箭'
                && (recruitTargetRegion?.troops ?? 0) === 4;
        default:
            return true;
    }
};

const siegeStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    const pendingTargetAction = core.pendingTargetAction;
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
        case 'besiege-choice':
        case 'occupy-choice':
            return Boolean(core.postBattleSelection);
        case 'finish':
            return Boolean(core.lastSeasonSummary);
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
        case 'hire-only':
            return core.turnPhase === 'diplomacy-choice'
                && (core.diplomacyProgress?.resolvedSteps.length ?? 0) >= 1;
        case 'finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const yearAndCharactersStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
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
        case 'new-year-maintenance':
            return core.turnPhase === 'season-resolution';
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

const QIDAHEN_BASIC_TUTORIAL: TutorialManifest = {
    id: QIDAHEN_DEFAULT_TUTORIAL_ID,
    stepValidator: basicOpeningStepValidator,
    steps: [
        {
            id: 'welcome',
            content: 'game-qidahen:tutorial.basic.steps.welcome',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'hand-limit',
            content: 'game-qidahen:tutorial.basic.steps.handLimit',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND, QIDAHEN_COMMANDS.SELECT_HAND_LIMIT_DISCARD_CARD, QIDAHEN_COMMANDS.RESOLVE_HAND_LIMIT_DISCARD],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { sourceId: 'qidahen:hand-limit-discard' } }],
        },
        {
            id: 'wheel-first',
            content: 'game-qidahen:tutorial.basic.steps.wheelFirst',
            highlightTarget: 'qidahen-action-wheel',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'wheel-move',
            content: 'game-qidahen:tutorial.basic.steps.wheelMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'right',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'after-wheel',
            content: 'game-qidahen:tutorial.basic.steps.afterWheel',
            highlightTarget: 'qidahen-actions-zone',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'hand-resource',
            content: 'game-qidahen:tutorial.basic.steps.handResource',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'pick-action',
            content: 'game-qidahen:tutorial.basic.steps.pickAction',
            highlightTarget: 'qidahen-action-grant-pardon',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            allowedTargets: ['grant-pardon'],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'grant-pardon' } }],
        },
        {
            id: 'pay-cards',
            content: 'game-qidahen:tutorial.basic.steps.payCards',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'grant-pardon' } }],
        },
        {
            id: 'choose-grant-pardon-target',
            content: 'game-qidahen:tutorial.basic.steps.chooseGrantPardonTarget',
            highlightTarget: 'qidahen-map-guide-hit-target-city-region-25',
            position: 'left',
            requireAction: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND, QIDAHEN_COMMANDS.RESOLVE_GRANT_PARDON_CHOICE],
            allowedTargets: ['jinzhou->city-region-25'],
            advanceOnEvents: [{ type: 'GRANT_PARDON_CHOICE_RESOLVED', match: { choiceId: 'jinzhou->city-region-25' } }],
        },
        {
            id: 'action-result',
            content: 'game-qidahen:tutorial.basic.steps.actionResult',
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'morale-level',
            content: 'game-qidahen:tutorial.basic.steps.moraleLevel',
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'wheel-action',
            content: 'game-qidahen:tutorial.basic.steps.wheelAction',
            highlightTarget: 'qidahen-turn-banner',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.basic.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
        },
    ],
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
            id: 'choose-action',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.chooseAction',
            highlightTarget: 'qidahen-action-raid',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            allowedTargets: ['raid'],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'raid' } }],
        },
        {
            id: 'pay-raid',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.payRaid',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
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
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
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
            id: 'battle-finish',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
    ],
};

const QIDAHEN_SIEGE_TUTORIAL: TutorialManifest = {
    id: 'siege-and-occupation',
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
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            allowedTargets: ['defender-hold-city'],
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
            id: 'besiege-choice',
            content: 'game-qidahen:tutorial.siege.steps.besiegeChoice',
            highlightTarget: 'qidahen-post-battle-choice-besiege',
            position: 'left',
            requireAction: true,
            allowManualSkip: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION],
            advanceOnEvents: [{ type: 'POST_BATTLE_DECISION_RESOLVED', match: { choiceId: 'besiege' } }],
        },
        {
            id: 'occupy-choice',
            content: 'game-qidahen:tutorial.siege.steps.occupyChoice',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.siege.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
    ],
};

const QIDAHEN_RETREAT_AND_ROUT_TUTORIAL: TutorialManifest = {
    id: 'retreat-and-rout',
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
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED', match: { retreatLossMode: 'rout' } }],
        },
        {
            id: 'rout-result',
            content: 'game-qidahen:tutorial.retreatAndRout.steps.routResult',
            highlightTarget: 'qidahen-player-ming',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.retreatAndRout.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.cavalryPlunder.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.cavalryEvasion.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-3-all-opponents'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-3-all-opponents' } }],
        },
        {
            id: 'draw-result',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.drawResult',
            highlightTarget: 'qidahen-player-float',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'dispatch-ready',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.dispatchReady',
            highlightTarget: 'qidahen-wheel-dispatch-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.wheelSharedCost.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
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
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.wheelReclaim.steps.result',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.wheelMilitaryFarm.steps.result',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            id: 'choose-move',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.chooseMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.result',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.wheelRecruitTrain.steps.finish',
            position: 'center',
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
            id: 'choose-action',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.chooseAction',
            highlightTarget: 'qidahen-atlas05-1626-artillery-tech',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            allowedTargets: ['qidahen-atlas05-1626-artillery-tech'],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'upgrade-armament' } }],
        },
        {
            id: 'pay-cards',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.payCards',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_PAYMENT_CARD, QIDAHEN_COMMANDS.EXECUTE_SELECTED_ACTION],
            advanceOnEvents: [{ type: 'SELECTED_ACTION_EXECUTED', match: { actionId: 'upgrade-armament' } }],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.armamentUpgrade.steps.result',
            highlightTarget: 'qidahen-armaments-ming',
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
            id: 'choose-action',
            content: 'game-qidahen:tutorial.eventAction.steps.chooseAction',
            highlightTarget: 'qidahen-action-khan-edict',
            position: 'left',
            requireAction: true,
            viewAs: '1',
            allowedCommands: [QIDAHEN_COMMANDS.CONFIRM_PREVIEW_ACTION],
            allowedTargets: ['khan-edict'],
            advanceOnEvents: [{ type: 'PREVIEW_ACTION_CONFIRMED', match: { actionId: 'khan-edict' } }],
        },
        {
            id: 'pay-cards',
            content: 'game-qidahen:tutorial.eventAction.steps.payCards',
            highlightTarget: 'qidahen-hand-zone',
            position: 'top',
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
            allowedTargets: ['city-region-25', 'recruit-train'],
        },
        {
            id: 'result',
            content: 'game-qidahen:tutorial.eventAction.steps.result',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            allowedTargets: ['move-1-free'],
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
            allowedTargets: ['city-region-24', 'place-friendly'],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'place-friendly' } }],
        },
        {
            id: 'tribute-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.tributeMark',
            highlightTarget: 'qidahen-diplomacy-choice-flip-vassal',
            position: 'left',
            requireAction: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND],
            allowedTargets: ['flip-vassal'],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'flip-vassal' } }],
        },
        {
            id: 'remove-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.removeMark',
            highlightTarget: 'qidahen-map-guide-hit-target-city-region-22',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
            allowedTargets: ['city-region-22', 'remove-marker'],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'remove-marker' } }],
        },
        {
            id: 'hire-only',
            content: 'game-qidahen:tutorial.diplomacy.steps.hireOnly',
            highlightTarget: 'qidahen-diplomacy-choice-hire-only',
            position: 'left',
            requireAction: true,
            allowManualSkip: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND],
            allowedTargets: ['hire-only'],
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.diplomacy.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            viewAs: '1',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-2-one-opponent'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-2-one-opponent' } }],
        },
        {
            id: 'midyear-tax',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.midyearTax',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            viewAs: '1',
            infoStep: true,
        },
        {
            id: 'midyear-characters',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.midyearCharacters',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            viewAs: '1',
            infoStep: true,
        },
        {
            id: 'advance-new-year',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.advanceNewYear',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            viewAs: '2',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
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
            allowedTargets: ['auto-pay'],
        },
        {
            id: 'new-year-attrition',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.newYearAttrition',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            highlightTarget: 'qidahen-turn-banner',
            position: 'top',
            viewAs: '2',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            allowedTargets: ['auto-pay'],
        },
        {
            id: 'korea-attrition',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.koreaAttrition',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'shanhaiguan',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.shanhaiguan',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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

const QIDAHEN_TUTORIALS: TutorialCollection = {
    defaultTutorialId: QIDAHEN_DEFAULT_TUTORIAL_ID,
    tutorials: {
        'basic-opening': {
            titleKey: 'tutorial.basic.title',
            descriptionKey: 'tutorial.basic.description',
            manifest: QIDAHEN_BASIC_TUTORIAL,
        },
        'attack-and-battle': {
            titleKey: 'tutorial.attackAndBattle.title',
            descriptionKey: 'tutorial.attackAndBattle.description',
            nextTutorialId: 'retreat-and-rout',
            manifest: QIDAHEN_ATTACK_AND_BATTLE_TUTORIAL,
        },
        'siege-and-occupation': {
            titleKey: 'tutorial.siege.title',
            descriptionKey: 'tutorial.siege.description',
            manifest: QIDAHEN_SIEGE_TUTORIAL,
        },
        'retreat-and-rout': {
            titleKey: 'tutorial.retreatAndRout.title',
            descriptionKey: 'tutorial.retreatAndRout.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'cavalry-evasion',
            manifest: QIDAHEN_RETREAT_AND_ROUT_TUTORIAL,
        },
        'cavalry-evasion': {
            titleKey: 'tutorial.cavalryEvasion.title',
            descriptionKey: 'tutorial.cavalryEvasion.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'cavalry-plunder',
            manifest: QIDAHEN_CAVALRY_EVASION_TUTORIAL,
        },
        'cavalry-plunder': {
            titleKey: 'tutorial.cavalryPlunder.title',
            descriptionKey: 'tutorial.cavalryPlunder.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'neutral-invasion',
            manifest: QIDAHEN_CAVALRY_PLUNDER_TUTORIAL,
        },
        'neutral-invasion': {
            titleKey: 'tutorial.neutralInvasion.title',
            descriptionKey: 'tutorial.neutralInvasion.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'water-dispatch',
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
            nextTutorialId: 'wheel-reclaim',
            manifest: QIDAHEN_WHEEL_SHARED_COST_TUTORIAL,
        },
        'wheel-reclaim': {
            titleKey: 'tutorial.wheelReclaim.title',
            descriptionKey: 'tutorial.wheelReclaim.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'wheel-military-farm',
            manifest: QIDAHEN_WHEEL_RECLAIM_TUTORIAL,
        },
        'wheel-military-farm': {
            titleKey: 'tutorial.wheelMilitaryFarm.title',
            descriptionKey: 'tutorial.wheelMilitaryFarm.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'wheel-recruit-train',
            manifest: QIDAHEN_WHEEL_MILITARY_FARM_TUTORIAL,
        },
        'wheel-recruit-train': {
            titleKey: 'tutorial.wheelRecruitTrain.title',
            descriptionKey: 'tutorial.wheelRecruitTrain.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'armament-upgrade',
            manifest: QIDAHEN_WHEEL_RECRUIT_TRAIN_TUTORIAL,
        },
        'armament-upgrade': {
            titleKey: 'tutorial.armamentUpgrade.title',
            descriptionKey: 'tutorial.armamentUpgrade.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'event-action',
            manifest: QIDAHEN_ARMAMENT_UPGRADE_TUTORIAL,
        },
        'event-action': {
            titleKey: 'tutorial.eventAction.title',
            descriptionKey: 'tutorial.eventAction.description',
            hiddenFromCatalog: true,
            nextTutorialId: 'diplomacy-and-hire',
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
            manifest: QIDAHEN_YEAR_AND_CHARACTERS_TUTORIAL,
        },
        'korea-and-special-map-rules': {
            titleKey: 'tutorial.koreaSpecial.title',
            descriptionKey: 'tutorial.koreaSpecial.description',
            manifest: QIDAHEN_KOREA_SPECIAL_TUTORIAL,
        },
    },
};

export default QIDAHEN_TUTORIALS;
