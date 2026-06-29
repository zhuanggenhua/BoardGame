import type { MatchState, TutorialCollection, TutorialManifest } from '../../engine/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS } from './domain/commands';
import type { QidahenCore } from './domain/types';

const asCore = (state: MatchState<unknown>): QidahenCore => state.core as QidahenCore;

const fieldBattleStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'casualty-priority':
            return Boolean(core.pendingTargetAction);
        case 'battle-result':
            return Boolean(core.postBattleSelection);
        case 'occupy-region':
            return Boolean(core.postBattleSelection);
        case 'field-finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const siegeStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'siege-result':
            return Boolean(core.postBattleSelection);
        case 'besiege-choice':
            return Boolean(core.postBattleSelection);
        case 'siege-finish':
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
        case 'place-friendly':
            return core.turnPhase === 'diplomacy-choice'
                && (core.diplomacyProgress?.resolvedSteps.length ?? 0) === 0;
        case 'hire-only':
            return core.turnPhase === 'diplomacy-choice'
                && core.lastSeasonSummary == null;
        default:
            return true;
    }
};

const seasonFlowStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'advance-midyear':
            return core.turnPhase === 'action-window'
                && core.lastSeasonSummary == null;
        case 'midyear-summary':
            return Boolean(core.lastSeasonSummary);
        case 'advance-new-year':
            return core.turnPhase !== 'season-resolution'
                && core.lastSeasonSummary?.title === '年中结算';
        case 'new-year-maintenance':
            return core.turnPhase === 'season-resolution';
        default:
            return true;
    }
};

const QIDAHEN_BASIC_TUTORIAL: TutorialManifest = {
    id: 'basic-opening',
    steps: [
        {
            id: 'welcome',
            content: 'game-qidahen:tutorial.basic.steps.welcome',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'opening-entry',
            content: 'game-qidahen:tutorial.basic.steps.openingEntry',
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
            id: 'select-region',
            content: 'game-qidahen:tutorial.basic.steps.selectRegion',
            highlightTarget: 'qidahen-map-target-song-jin',
            position: 'bottom',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION],
            allowedTargets: ['song-jin'],
            advanceOnEvents: [{ type: 'REGION_SELECTED', match: { regionId: 'song-jin' } }],
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
            id: 'wheel-move',
            content: 'game-qidahen:tutorial.basic.steps.wheelMove',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.basic.steps.finish',
            highlightTarget: 'qidahen-turn-banner',
            position: 'top',
            infoStep: true,
        },
    ],
};

const QIDAHEN_FIELD_BATTLE_TUTORIAL: TutorialManifest = {
    id: 'field-battle',
    stepValidator: fieldBattleStepValidator,
    steps: [
        {
            id: 'battle-overview',
            content: 'game-qidahen:tutorial.fieldBattle.steps.battleOverview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'battle-target',
            content: 'game-qidahen:tutorial.fieldBattle.steps.battleTarget',
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'casualty-priority',
            content: 'game-qidahen:tutorial.fieldBattle.steps.casualtyPriority',
            highlightTarget: 'qidahen-pending-casualty-priority',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_PENDING_ACTION],
            advanceOnEvents: [{ type: 'PENDING_ACTION_RESOLVED' }],
        },
        {
            id: 'battle-result',
            content: 'game-qidahen:tutorial.fieldBattle.steps.battleResult',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'occupy-region',
            content: 'game-qidahen:tutorial.fieldBattle.steps.occupyRegion',
            highlightTarget: 'qidahen-post-battle-choice-occupy',
            position: 'left',
            requireAction: true,
            allowManualSkip: true,
            allowedCommands: [QIDAHEN_COMMANDS.RESOLVE_POST_BATTLE_DECISION],
            advanceOnEvents: [{ type: 'POST_BATTLE_DECISION_RESOLVED', match: { choiceId: 'occupy' } }],
        },
        {
            id: 'field-finish',
            content: 'game-qidahen:tutorial.fieldBattle.steps.finish',
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
            id: 'siege-overview',
            content: 'game-qidahen:tutorial.siege.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'siege-target',
            content: 'game-qidahen:tutorial.siege.steps.target',
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'siege-result',
            content: 'game-qidahen:tutorial.siege.steps.result',
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
            id: 'siege-finish',
            content: 'game-qidahen:tutorial.siege.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
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
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'place-friendly',
            content: 'game-qidahen:tutorial.diplomacy.steps.placeFriendly',
            highlightTarget: 'qidahen-map-layer',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
            allowedTargets: ['city-region-24', 'place-friendly'],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'place-friendly' } }],
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
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'hire-only' } }],
        },
    ],
};

const QIDAHEN_SEASON_FLOW_TUTORIAL: TutorialManifest = {
    id: 'season-flow',
    stepValidator: seasonFlowStepValidator,
    steps: [
        {
            id: 'overview',
            content: 'game-qidahen:tutorial.season.steps.overview',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'advance-midyear',
            content: 'game-qidahen:tutorial.season.steps.advanceMidyear',
            highlightTarget: 'qidahen-wheel-move-move-2-one-opponent',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-2-one-opponent'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-2-one-opponent' } }],
        },
        {
            id: 'midyear-summary',
            content: 'game-qidahen:tutorial.season.steps.midyearSummary',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'advance-new-year',
            content: 'game-qidahen:tutorial.season.steps.advanceNewYear',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'new-year-maintenance',
            content: 'game-qidahen:tutorial.season.steps.newYearMaintenance',
            highlightTarget: 'qidahen-fortification-maintenance-choice-auto-pay',
            position: 'left',
            viewAs: '2',
            requireAction: true,
            allowManualSkip: true,
            allowedCommands: [INTERACTION_COMMANDS.RESPOND, QIDAHEN_COMMANDS.RESOLVE_FORTIFICATION_MAINTENANCE],
            allowedTargets: ['auto-pay'],
            advanceOnEvents: [
                { type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'auto-pay' } },
                { type: 'FORTIFICATION_MAINTENANCE_RESOLVED', match: { choiceId: 'auto-pay' } },
            ],
        },
        {
            id: 'season-finish',
            content: 'game-qidahen:tutorial.season.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
    ],
};

const QIDAHEN_TUTORIALS: TutorialCollection = {
    defaultTutorialId: 'basic-opening',
    tutorials: {
        'basic-opening': {
            titleKey: 'tutorial.basic.title',
            descriptionKey: 'tutorial.basic.description',
            manifest: QIDAHEN_BASIC_TUTORIAL,
        },
        'field-battle': {
            titleKey: 'tutorial.fieldBattle.title',
            descriptionKey: 'tutorial.fieldBattle.description',
            manifest: QIDAHEN_FIELD_BATTLE_TUTORIAL,
        },
        'diplomacy-and-hire': {
            titleKey: 'tutorial.diplomacy.title',
            descriptionKey: 'tutorial.diplomacy.description',
            manifest: QIDAHEN_DIPLOMACY_HIRE_TUTORIAL,
        },
        'siege-and-occupation': {
            titleKey: 'tutorial.siege.title',
            descriptionKey: 'tutorial.siege.description',
            manifest: QIDAHEN_SIEGE_TUTORIAL,
        },
        'season-flow': {
            titleKey: 'tutorial.season.title',
            descriptionKey: 'tutorial.season.description',
            manifest: QIDAHEN_SEASON_FLOW_TUTORIAL,
        },
    },
};

export default QIDAHEN_TUTORIALS;
