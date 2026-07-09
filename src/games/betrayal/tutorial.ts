import type { TutorialCollection, TutorialManifest } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { BETRAYAL_COMMANDS } from './game';
import {
    createFirstScenarioHauntTutorialCore,
    createFirstScenarioReadyToExorciseTutorialCore,
    createFirstScenarioReadyToTraitorVictoryTutorialCore,
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
            id: 'finish',
            content: 'game-betrayal:tutorial.basicSetup.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
            viewAs: '0',
        },
    ],
};

const BETRAYAL_MOVE_EXPLORE_USE: TutorialManifest = {
    id: 'move-explore-use',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-runtime',
            content: 'game-betrayal:tutorial.moveExploreUse.steps.setupRuntime',
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
            id: 'use-book',
            content: 'game-betrayal:tutorial.moveExploreUse.steps.useBook',
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
            content: 'game-betrayal:tutorial.moveExploreUse.steps.openMoveTargets',
            highlightTarget: 'betrayal-action-move',
            position: 'top',
            viewAs: '0',
        },
        {
            id: 'move-to-hallway',
            content: 'game-betrayal:tutorial.moveExploreUse.steps.moveToHallway',
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
            content: 'game-betrayal:tutorial.moveExploreUse.steps.exploreUpper',
            highlightTarget: 'betrayal-action-explore',
            position: 'top',
            requireAction: true,
            allowedCommands: [BETRAYAL_COMMANDS.EXPLORE_ROOM],
            advanceOnEvents: [{ type: 'ROOM_EXPLORED', match: { playerId: '0' } }],
            viewAs: '0',
        },
        {
            id: 'finish',
            content: 'game-betrayal:tutorial.moveExploreUse.steps.finish',
            highlightTarget: 'betrayal-latest-discovery',
            position: 'center',
            infoStep: true,
            allowedCommands: [BETRAYAL_COMMANDS.USE_RABBIT_FOOT],
            viewAs: '0',
        },
    ],
};

const BETRAYAL_CRIMSON_JACK_OBJECTIVE: TutorialManifest = {
    id: 'crimson-jack-objective',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-haunt',
            content: 'game-betrayal:tutorial.crimsonJack.steps.setupHaunt',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: createFirstScenarioHauntTutorialCore().core ?? createFirstScenarioHauntTutorialCore(),
                    },
                },
            ],
        },
        {
            id: 'haunt-reveal',
            content: 'game-betrayal:tutorial.crimsonJack.steps.hauntReveal',
            highlightTarget: 'betrayal-reference-entry',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'hero-goal',
            content: 'game-betrayal:tutorial.crimsonJack.steps.heroGoal',
            highlightTarget: 'betrayal-action-use',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'traitor-goal',
            content: 'game-betrayal:tutorial.crimsonJack.steps.traitorGoal',
            highlightTarget: 'betrayal-room-board',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'finish',
            content: 'game-betrayal:tutorial.crimsonJack.steps.finish',
            position: 'center',
            infoStep: true,
            showMask: true,
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
        'move-explore-use': {
            titleKey: 'tutorial.moveExploreUse.title',
            descriptionKey: 'tutorial.moveExploreUse.description',
            manifest: BETRAYAL_MOVE_EXPLORE_USE,
        },
        'crimson-jack-objective': {
            titleKey: 'tutorial.crimsonJack.title',
            descriptionKey: 'tutorial.crimsonJack.description',
            manifest: BETRAYAL_CRIMSON_JACK_OBJECTIVE,
        },
        'haunt-actions-and-finish': {
            titleKey: 'tutorial.hauntActions.title',
            descriptionKey: 'tutorial.hauntActions.description',
            manifest: BETRAYAL_HAUNT_ACTIONS_AND_FINISH,
        },
        'traitor-path': {
            titleKey: 'tutorial.traitorPath.title',
            descriptionKey: 'tutorial.traitorPath.description',
            manifest: BETRAYAL_TRAITOR_PATH,
        },
    },
};

export default BETRAYAL_TUTORIAL_CATALOG;
