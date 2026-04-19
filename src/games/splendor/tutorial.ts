import type { TutorialManifest } from '../../contexts/TutorialContext';

export const SplendorTutorial: TutorialManifest = {
    id: 'splendor-basic',
    allowManualSkip: true,
    steps: [
        {
            id: 'intro',
            content: 'game-splendor:tutorial.steps.intro',
            position: 'center',
            showMask: true,
            infoStep: true,
        },
        {
            id: 'goal',
            content: 'game-splendor:tutorial.steps.goal',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'nobles',
            content: 'game-splendor:tutorial.steps.nobles',
            highlightTarget: 'sp-nobles',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'actions',
            content: 'game-splendor:tutorial.steps.actions',
            highlightTarget: 'sp-actions',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'market',
            content: 'game-splendor:tutorial.steps.market',
            highlightTarget: 'sp-market',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'bank',
            content: 'game-splendor:tutorial.steps.bank',
            highlightTarget: 'sp-bank',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'bank-confirm',
            content: 'game-splendor:tutorial.steps.bankConfirm',
            highlightTarget: 'sp-bank-confirm',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'take-gems-action',
            content: 'game-splendor:tutorial.steps.takeGemsAction',
            highlightTarget: 'sp-bank',
            position: 'left',
            requireAction: true,
            allowedCommands: ['TAKE_THREE_DIFFERENT_GEMS', 'TAKE_TWO_SAME_GEMS'],
            advanceOnEvents: [
                { type: 'TOKENS_GAINED', match: { playerId: '0' } },
            ],
        },
        {
            id: 'player-status',
            content: 'game-splendor:tutorial.steps.playerStatus',
            highlightTarget: 'sp-player-status',
            position: 'left',
            infoStep: true,
        },
        {
            id: 'reserve-action',
            content: 'game-splendor:tutorial.steps.reserveAction',
            highlightTarget: 'sp-market',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'buy-action',
            content: 'game-splendor:tutorial.steps.buyAction',
            highlightTarget: 'sp-market',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'noble-timing',
            content: 'game-splendor:tutorial.steps.nobleTiming',
            highlightTarget: 'sp-nobles',
            position: 'bottom',
            infoStep: true,
        },
        {
            id: 'token-limit',
            content: 'game-splendor:tutorial.steps.tokenLimit',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'endgame-detail',
            content: 'game-splendor:tutorial.steps.endgameDetail',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-splendor:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
        },
    ],
};

export default SplendorTutorial;
