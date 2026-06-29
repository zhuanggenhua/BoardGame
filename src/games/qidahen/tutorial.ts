import type { MatchState, TutorialCollection, TutorialManifest } from '../../engine/types';
import { INTERACTION_COMMANDS } from '../../engine/systems/InteractionSystem';
import { QIDAHEN_COMMANDS } from './domain/commands';
import type { QidahenCore } from './domain/types';

export const QIDAHEN_DEFAULT_TUTORIAL_ID = 'basic-opening';

const asCore = (state: MatchState<unknown>): QidahenCore => state.core as QidahenCore;

const attackAndBattleStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'move-entry':
            return core.turnPhase === 'dispatch-targeting';
        case 'battle-open':
        case 'battle-damage':
            return Boolean(core.pendingTargetAction);
        case 'retreat-and-defeat':
            return Boolean(core.pendingTargetAction);
        case 'battle-result':
            return Boolean(core.postBattleSelection);
        case 'battle-finish':
            return Boolean(core.lastSeasonSummary);
        default:
            return true;
    }
};

const siegeStepValidator = (state: MatchState<unknown>, step: { id: string }): boolean => {
    const core = asCore(state);
    switch (step.id) {
        case 'city-battle':
        case 'city-result':
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
            return core.koreaDeckCount >= 0;
        case 'water-limit':
        case 'shanhaiguan':
            return core.regions.length > 0;
        default:
            return true;
    }
};

const QIDAHEN_BASIC_TUTORIAL: TutorialManifest = {
    id: QIDAHEN_DEFAULT_TUTORIAL_ID,
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
            infoStep: true,
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
            id: 'move-entry',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.moveEntry',
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
        },
        {
            id: 'battle-open',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.battleOpen',
            highlightTarget: 'qidahen-raid-intent',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'battle-damage',
            content: 'game-qidahen:tutorial.attackAndBattle.steps.battleDamage',
            highlightTarget: 'qidahen-pending-casualty-priority',
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
            highlightTarget: 'qidahen-map-layer',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'city-battle',
            content: 'game-qidahen:tutorial.siege.steps.cityBattle',
            highlightTarget: 'qidahen-post-battle-selection',
            position: 'left',
            infoStep: true,
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
            highlightTarget: 'qidahen-map-layer',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_REGION, INTERACTION_COMMANDS.RESPOND],
            allowedTargets: ['city-region-24', 'place-friendly'],
            advanceOnEvents: [{ type: 'SYS_INTERACTION_RESOLVED', match: { optionId: 'place-friendly' } }],
        },
        {
            id: 'tribute-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.tributeMark',
            highlightTarget: 'qidahen-diplomacy-history',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'remove-mark',
            content: 'game-qidahen:tutorial.diplomacy.steps.removeMark',
            highlightTarget: 'qidahen-diplomacy-history',
            position: 'left',
            infoStep: true,
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
            infoStep: true,
        },
        {
            id: 'midyear-characters',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.midyearCharacters',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'advance-new-year',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.advanceNewYear',
            highlightTarget: 'qidahen-wheel-move-move-1-free',
            position: 'left',
            requireAction: true,
            allowedCommands: [QIDAHEN_COMMANDS.SELECT_WHEEL_MOVE, QIDAHEN_COMMANDS.EXECUTE_WHEEL_MOVE],
            allowedTargets: ['move-1-free'],
            advanceOnEvents: [{ type: 'WHEEL_MOVE_EXECUTED', match: { moveId: 'move-1-free' } }],
        },
        {
            id: 'new-year-maintenance',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.newYearMaintenance',
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
            id: 'new-year-attrition',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.newYearAttrition',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'chronology-score',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.chronologyScore',
            highlightTarget: 'qidahen-chronology-zone',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'turn-order-refresh',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.turnOrderRefresh',
            highlightTarget: 'qidahen-turn-banner',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-qidahen:tutorial.yearAndCharacters.steps.finish',
            highlightTarget: 'qidahen-season-summary',
            position: 'top',
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
            highlightTarget: 'qidahen-korea-zone',
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
            id: 'shanhaiguan',
            content: 'game-qidahen:tutorial.koreaSpecial.steps.shanhaiguan',
            highlightTarget: 'qidahen-map-layer',
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
            manifest: QIDAHEN_ATTACK_AND_BATTLE_TUTORIAL,
        },
        'siege-and-occupation': {
            titleKey: 'tutorial.siege.title',
            descriptionKey: 'tutorial.siege.description',
            manifest: QIDAHEN_SIEGE_TUTORIAL,
        },
        'diplomacy-and-hire': {
            titleKey: 'tutorial.diplomacy.title',
            descriptionKey: 'tutorial.diplomacy.description',
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
