import type { TutorialCollection, TutorialManifest } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { BETRAYAL_COMMANDS } from './game';
import {
    createExchangeReadyTutorialCore,
    createHeroAttackTraitorReadyTutorialCore,
    createFirstScenarioReadyToExorciseTutorialCore,
    createFirstScenarioReadyToTraitorVictoryTutorialCore,
    createJackSpiritPostReviveAttackReadyTutorialCore,
    createStartedFirstScenarioTutorialCore,
} from './testing/firstScenarioTestUtils';

const BETRAYAL_BASIC_SETUP_AND_TURN: TutorialManifest = {
    id: 'basic-setup-and-turn',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-runtime',
            content: 'game-betrayal:tutorial.basicSetup.steps.setupRuntime',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createStartedFirstScenarioTutorialCore().core ?? createStartedFirstScenarioTutorialCore(),
                    },
                },
            ],
        },
        {
            id: 'objective-and-turn',
            content: 'game-betrayal:tutorial.basicSetup.steps.objectiveAndTurn',
            highlightTarget: 'betrayal-action-move',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'traits-and-speed',
            content: 'game-betrayal:tutorial.basicSetup.steps.traitsAndSpeed',
            highlightTarget: 'betrayal-current-traits',
            position: 'right',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'moves-remaining',
            content: 'game-betrayal:tutorial.basicSetup.steps.movesRemaining',
            highlightTarget: 'betrayal-moves-remaining',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'room-board',
            content: 'game-betrayal:tutorial.basicSetup.steps.roomBoard',
            highlightTarget: 'betrayal-room-board',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'inventory-and-help',
            content: 'game-betrayal:tutorial.basicSetup.steps.inventoryAndHelp',
            highlightTarget: 'betrayal-inventory-zone',
            position: 'right',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'use-book',
            content: 'game-betrayal:tutorial.basicSetup.steps.useBook',
            highlightTarget: 'betrayal-inventory-omen-book',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.USE_POSSESSION],
            allowedTargets: ['omen-book'],
            advanceOnEvents: [{ type: 'POSSESSION_USED', match: { playerId: '0', cardId: 'omen-book' } }],
            viewAs: '0',
        },
        {
            id: 'open-move-targets',
            content: 'game-betrayal:tutorial.basicSetup.steps.openMoveTargets',
            highlightTarget: 'betrayal-action-move',
            position: 'top',
            viewAs: '0',
        },
        {
            id: 'move-to-hallway',
            content: 'game-betrayal:tutorial.basicSetup.steps.moveToHallway',
            highlightTarget: 'betrayal-room-hallway',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.MOVE_TO_ROOM],
            allowedTargets: ['hallway'],
            advanceOnEvents: [{ type: 'EXPLORER_MOVED', match: { playerId: '0', roomId: 'hallway' } }],
            viewAs: '0',
        },
        {
            id: 'explore-upper',
            content: 'game-betrayal:tutorial.basicSetup.steps.exploreUpper',
            highlightTarget: 'betrayal-action-explore',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.EXPLORE_ROOM],
            advanceOnEvents: [{ type: 'ROOM_EXPLORED', match: { playerId: '0' } }],
            viewAs: '0',
        },
        {
            id: 'finish',
            content: 'game-betrayal:tutorial.basicSetup.steps.finish',
            highlightTarget: 'betrayal-latest-discovery',
            position: 'center',
            infoStep: true,
            allowedCommands: [BETRAYAL_COMMANDS.USE_RABBIT_FOOT],
            viewAs: '0',
        },
    ],
};

const BETRAYAL_TRADE_AND_AGREEMENT: TutorialManifest = {
    id: 'trade-and-agreement',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-trade',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.setupTrade',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createExchangeReadyTutorialCore().core ?? createExchangeReadyTutorialCore(),
                    },
                },
            ],
            autoAdvanceAfterAi: false,
        },
        {
            id: 'choose-trade-item',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.chooseTradeItem',
            highlightTarget: 'betrayal-inventory-rope',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'choose-trade-target',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.chooseTradeTarget',
            highlightTarget: 'betrayal-room-occupant-hallway-1',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'choose-trade-return',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.chooseTradeReturn',
            highlightTarget: 'betrayal-trade-return-selector',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'send-trade-request',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.sendTradeRequest',
            highlightTarget: 'betrayal-action-trade',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.TRADE_POSSESSION],
            advanceOnEvents: [{ type: 'POSSESSION_TRADE_REQUESTED', match: { playerId: '0', targetPlayerId: '1' } }],
            viewAs: '0',
        },
        {
            id: 'request-waiting',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.requestWaiting',
            highlightTarget: 'betrayal-trade-flow-banner',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'accept-trade-request',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.acceptTradeRequest',
            highlightTarget: 'betrayal-trade-agreement-panel',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.RESOLVE_TRADE_AGREEMENT],
            advanceOnEvents: [{ type: 'POSSESSION_TRADED', match: { playerId: '0', targetPlayerId: '1' } }],
            viewAs: '1',
        },
        {
            id: 'trade-review',
            content: 'game-betrayal:tutorial.tradeAndAgreement.steps.tradeReview',
            highlightTarget: 'betrayal-room-latest-feedback',
            position: 'center',
            infoStep: true,
            viewAs: '0',
        },
    ],
};

const BETRAYAL_HAUNT_ACTIONS_AND_FINISH: TutorialManifest = {
    id: 'haunt-actions-and-finish',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-ready-to-exorcise',
            content: 'game-betrayal:tutorial.hauntActions.steps.setupReadyToExorcise',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createFirstScenarioReadyToExorciseTutorialCore().core ?? createFirstScenarioReadyToExorciseTutorialCore(),
                    },
                },
            ],
        },
        {
            id: 'help-entry',
            content: 'game-betrayal:tutorial.hauntActions.steps.helpEntry',
            highlightTarget: 'betrayal-reference-entry',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'haunt-actions',
            content: 'game-betrayal:tutorial.hauntActions.steps.hauntActions',
            highlightTarget: 'betrayal-action-use',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'exorcise-jack',
            content: 'game-betrayal:tutorial.hauntActions.steps.exorciseJack',
            highlightTarget: 'betrayal-action-use',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.EXORCISE_JACK],
            randomPolicy: { mode: 'fixed', values: [3] },
            advanceOnEvents: [{ type: 'JACK_EXORCISED', match: { playerId: '0', success: true } }],
            viewAs: '0',
        },
        {
            id: 'endgame-review',
            content: 'game-betrayal:tutorial.hauntActions.steps.endgameReview',
            highlightTarget: 'betrayal-endgame-screen',
            position: 'center',
            infoStep: true,
            viewAs: '0',
        },
    ],
};

const BETRAYAL_HERO_ATTACK_PATH: TutorialManifest = {
    id: 'hero-attack-path',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-hero-attack',
            content: 'game-betrayal:tutorial.heroAttackPath.steps.setupHeroAttack',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createHeroAttackTraitorReadyTutorialCore().core ?? createHeroAttackTraitorReadyTutorialCore(),
                    },
                },
            ],
        },
        {
            id: 'hero-attack-objective',
            content: 'game-betrayal:tutorial.heroAttackPath.steps.heroAttackObjective',
            highlightTarget: 'betrayal-reference-entry',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'attack-traitor',
            content: 'game-betrayal:tutorial.heroAttackPath.steps.attackTraitor',
            highlightTarget: 'betrayal-room-board',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.HAUNT_ATTACK],
            randomPolicy: { mode: 'fixed', values: [3, 3, 1, 1, 1, 1, 1, 1] },
            advanceOnEvents: [{ type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '0', target: 'traitor' } }],
            viewAs: '0',
        },
        {
            id: 'hero-attack-review',
            content: 'game-betrayal:tutorial.heroAttackPath.steps.heroAttackReview',
            highlightTarget: 'betrayal-attack-roll-review',
            position: 'center',
            infoStep: true,
            viewAs: '0',
        },
    ],
};

const BETRAYAL_JACK_SPIRIT_PATH: TutorialManifest = {
    id: 'jack-spirit-path',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-jack-spirit',
            content: 'game-betrayal:tutorial.jackSpiritPath.steps.setupJackSpirit',
            position: 'center',
            showMask: true,
            viewAs: '2',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createJackSpiritPostReviveAttackReadyTutorialCore().core ?? createJackSpiritPostReviveAttackReadyTutorialCore(),
                    },
                },
            ],
        },
        {
            id: 'jack-spirit-objective',
            content: 'game-betrayal:tutorial.jackSpiritPath.steps.jackSpiritObjective',
            highlightTarget: 'betrayal-reference-entry',
            position: 'left',
            infoStep: true,
            viewAs: '2',
        },
        {
            id: 'jack-spirit-attack',
            content: 'game-betrayal:tutorial.jackSpiritPath.steps.jackSpiritAttack',
            highlightTarget: 'betrayal-room-board',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.HAUNT_ATTACK],
            randomPolicy: { mode: 'sequence', values: [3, 3, 1, 3, 2, 1, 1] },
            advanceOnEvents: [{ type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '2', target: 'hero' } }],
            viewAs: '2',
        },
        {
            id: 'jack-spirit-review',
            content: 'game-betrayal:tutorial.jackSpiritPath.steps.jackSpiritReview',
            highlightTarget: 'betrayal-attack-roll-review',
            position: 'center',
            infoStep: true,
            viewAs: '2',
        },
    ],
};

const BETRAYAL_TRAITOR_PATH: TutorialManifest = {
    id: 'traitor-path',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-traitor-turn',
            content: 'game-betrayal:tutorial.traitorPath.steps.setupTraitorTurn',
            position: 'center',
            showMask: true,
            viewAs: '2',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createFirstScenarioReadyToTraitorVictoryTutorialCore().core ?? createFirstScenarioReadyToTraitorVictoryTutorialCore(),
                    },
                },
            ],
        },
        {
            id: 'traitor-objective',
            content: 'game-betrayal:tutorial.traitorPath.steps.traitorObjective',
            highlightTarget: 'betrayal-reference-entry',
            position: 'left',
            infoStep: true,
            viewAs: '2',
        },
        {
            id: 'attack-hero',
            content: 'game-betrayal:tutorial.traitorPath.steps.attackHero',
            highlightTarget: 'betrayal-room-board',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.HAUNT_ATTACK],
            advanceOnEvents: [{ type: 'HAUNT_ATTACK_RESOLVED', match: { attackerPlayerId: '2', target: 'hero' } }],
            viewAs: '2',
        },
        {
            id: 'traitor-finish',
            content: 'game-betrayal:tutorial.traitorPath.steps.traitorFinish',
            highlightTarget: 'betrayal-endgame-screen',
            position: 'center',
            infoStep: true,
            viewAs: '2',
        },
    ],
};

const BETRAYAL_TUTORIAL_CATALOG: TutorialCollection = {
    defaultTutorialId: 'basic-setup-and-turn',
    tutorials: {
        'basic-setup-and-turn': {
            titleKey: 'tutorial.basicSetup.title',
            descriptionKey: 'tutorial.basicSetup.description',
            manifest: BETRAYAL_BASIC_SETUP_AND_TURN,
        },
        'trade-and-agreement': {
            titleKey: 'tutorial.tradeAndAgreement.title',
            descriptionKey: 'tutorial.tradeAndAgreement.description',
            manifest: BETRAYAL_TRADE_AND_AGREEMENT,
        },
        'move-explore-use': {
            titleKey: 'tutorial.basicSetup.title',
            descriptionKey: 'tutorial.basicSetup.description',
            manifest: BETRAYAL_BASIC_SETUP_AND_TURN,
            hiddenFromCatalog: true,
        },
        'crimson-jack-objective': {
            titleKey: 'tutorial.hauntActions.title',
            descriptionKey: 'tutorial.hauntActions.description',
            manifest: BETRAYAL_HAUNT_ACTIONS_AND_FINISH,
            hiddenFromCatalog: true,
        },
        'haunt-actions-and-finish': {
            titleKey: 'tutorial.hauntActions.title',
            descriptionKey: 'tutorial.hauntActions.description',
            manifest: BETRAYAL_HAUNT_ACTIONS_AND_FINISH,
        },
        'hero-attack-path': {
            titleKey: 'tutorial.heroAttackPath.title',
            descriptionKey: 'tutorial.heroAttackPath.description',
            manifest: BETRAYAL_HERO_ATTACK_PATH,
        },
        'jack-spirit-path': {
            titleKey: 'tutorial.jackSpiritPath.title',
            descriptionKey: 'tutorial.jackSpiritPath.description',
            manifest: BETRAYAL_JACK_SPIRIT_PATH,
        },
        'traitor-path': {
            titleKey: 'tutorial.traitorPath.title',
            descriptionKey: 'tutorial.traitorPath.description',
            manifest: BETRAYAL_TRAITOR_PATH,
        },
    },
};

export default BETRAYAL_TUTORIAL_CATALOG;
