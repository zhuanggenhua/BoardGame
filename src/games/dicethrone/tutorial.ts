import type { TutorialManifest } from '../../contexts/TutorialContext';

export const DiceThroneTutorial: TutorialManifest = {
    id: 'dicethrone-basic',
    steps: [
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
        },
        {
            id: 'dice-confirm',
            content: 'game-dicethrone:tutorial.steps.confirmButton',
            highlightTarget: 'dice-confirm-button',
            position: 'left',
            requireAction: true,
        },
        {
            id: 'abilities',
            content: 'game-dicethrone:tutorial.steps.abilities',
            highlightTarget: 'ability-slots',
            position: 'left',
            requireAction: true,
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
            requireAction: true,
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
