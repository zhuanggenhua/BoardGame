import type { TutorialManifest, TutorialEventMatcher } from '../../engine/types';

const MATCH_PHASE_OFFENSIVE: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'offensiveRoll' },
};

const MATCH_PHASE_DEFENSE: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'defensiveRoll' },
};

const MATCH_PHASE_MAIN2: TutorialEventMatcher = {
    type: 'SYS_PHASE_CHANGED',
    match: { to: 'main2' },
};

export const DiceThroneTutorial: TutorialManifest = {
    id: 'dicethrone-basic',
    randomPolicy: {
        mode: 'fixed',
        values: [1],
    },
    steps: [
        {
            id: 'setup',
            content: 'game-dicethrone:tutorial.steps.setup',
            position: 'center',
            requireAction: false,
            showMask: true,
            aiActions: [
                { commandType: 'SELECT_CHARACTER', payload: { characterId: 'monk' } },
                { commandType: 'HOST_START_GAME', payload: {} },
            ],
            advanceOnEvents: [
                { type: 'HOST_STARTED' },
                { type: 'SYS_PHASE_CHANGED', match: { to: 'income' } },
                { type: 'SYS_PHASE_CHANGED', match: { to: 'main1' } },
            ],
        },
        {
            id: 'intro',
            content: 'game-dicethrone:tutorial.steps.intro',
            position: 'center',
            requireAction: false,
            showMask: true,
        },
        {
            id: 'stats',
            content: 'game-dicethrone:tutorial.steps.stats',
            highlightTarget: 'player-stats',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'phases',
            content: 'game-dicethrone:tutorial.steps.phases',
            highlightTarget: 'phase-indicator',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'player-board',
            content: 'game-dicethrone:tutorial.steps.playerBoard',
            highlightTarget: 'player-board',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'tip-board',
            content: 'game-dicethrone:tutorial.steps.tipBoard',
            highlightTarget: 'tip-board',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'hand',
            content: 'game-dicethrone:tutorial.steps.hand',
            highlightTarget: 'hand-area',
            position: 'top',
            requireAction: false,
        },
        {
            id: 'discard',
            content: 'game-dicethrone:tutorial.steps.discard',
            highlightTarget: 'discard-pile',
            position: 'left',
            requireAction: false,
        },
        {
            id: 'status-tokens',
            content: 'game-dicethrone:tutorial.steps.statusTokens',
            highlightTarget: 'status-tokens',
            position: 'right',
            requireAction: false,
        },
        {
            id: 'advance',
            content: 'game-dicethrone:tutorial.steps.advance',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [MATCH_PHASE_OFFENSIVE],
        },
        {
            id: 'dice-tray',
            content: 'game-dicethrone:tutorial.steps.dice',
            highlightTarget: 'dice-tray',
            position: 'left',
            requireAction: false,
        },
        {
            id: 'dice-roll',
            content: 'game-dicethrone:tutorial.steps.rollButton',
            highlightTarget: 'dice-roll-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'dice-confirm',
            content: 'game-dicethrone:tutorial.steps.confirmButton',
            highlightTarget: 'dice-confirm-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [{ type: 'ROLL_CONFIRMED' }],
        },
        {
            id: 'abilities',
            content: 'game-dicethrone:tutorial.steps.abilities',
            highlightTarget: 'ability-slots',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [{ type: 'ABILITY_ACTIVATED' }],
        },
        {
            id: 'resolve-attack',
            content: 'game-dicethrone:tutorial.steps.resolveAttack',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: true,
            advanceOnEvents: [MATCH_PHASE_DEFENSE, MATCH_PHASE_MAIN2],
        },
        {
            id: 'defense-roll',
            content: 'game-dicethrone:tutorial.steps.defenseRoll',
            highlightTarget: 'dice-tray',
            position: 'left',
            requireAction: false,
            advanceOnEvents: [{ type: 'DICE_ROLLED' }],
        },
        {
            id: 'defense-end',
            content: 'game-dicethrone:tutorial.steps.defenseEnd',
            highlightTarget: 'advance-phase-button',
            position: 'left',
            requireAction: false,
            advanceOnEvents: [MATCH_PHASE_MAIN2],
        },
        {
            id: 'finish',
            content: 'game-dicethrone:tutorial.steps.finish',
            position: 'center',
            requireAction: false,
        },
    ],
};

export default DiceThroneTutorial;
