import type { TutorialManifest } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { OFFICIAL_FANTASY_REALMS_CARDS } from './data/cards';
import type { TableCard } from './foundation';

function byId(cardId: string): TableCard {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`[FantasyRealmsTutorial] 未找到卡牌: ${cardId}`);
    }
    return { ...card };
}

const DRAW_STEP_HAND = [
    byId('wizard-collector'),
];

const DRAW_STEP_DISCARD = [
    byId('weather-rainstorm'),
];

const TAKE_STEP_HAND = [
    byId('artifact-gem-of-order'),
    byId('leader-king'),
    byId('flood-swamp'),
    byId('weapon-magic-wand'),
    byId('land-forest'),
    byId('beast-hydra'),
    byId('flame-candle'),
];

const TAKE_STEP_DISCARD = [
    byId('land-bell-tower'),
    byId('weather-rainstorm'),
];

const TAKE_STEP_DRAW_PILE = [
    byId('leader-queen'),
    byId('army-rangers'),
    byId('flood-island'),
];

export const FantasyRealmsTutorial: TutorialManifest = {
    id: 'fantasyrealms-basic',
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-draw-turn',
            content: 'game-fantasyrealms:tutorial.steps.setupDrawTurn',
            position: 'center',
            showMask: true,
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            currentPlayer: '0',
                            turn: 1,
                            stage: 'draw',
                            discardPile: DRAW_STEP_DISCARD,
                            drawPile: [
                                byId('flame-candle'),
                                byId('land-bell-tower'),
                                byId('weather-rainstorm'),
                                byId('artifact-book-of-changes'),
                                byId('wild-mirage'),
                            ],
                            players: {
                                '0': {
                                    hand: DRAW_STEP_HAND,
                                },
                                '1': {
                                    hand: [],
                                },
                            },
                            focusCardId: DRAW_STEP_HAND[0]!.id,
                        },
                    },
                },
            ],
        },
        {
            id: 'welcome',
            content: 'game-fantasyrealms:tutorial.steps.welcome',
            position: 'center',
            infoStep: true,
        },
        {
            id: 'deck-intro',
            content: 'game-fantasyrealms:tutorial.steps.deckIntro',
            highlightTarget: 'fantasyrealms-live-deck',
            position: 'right',
            infoStep: true,
        },
        {
            id: 'center-row-intro',
            content: 'game-fantasyrealms:tutorial.steps.centerRowIntro',
            highlightTarget: 'fantasyrealms-live-center-row',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'draw-from-deck',
            content: 'game-fantasyrealms:tutorial.steps.drawFromDeck',
            highlightTarget: 'fantasyrealms-live-action-draw',
            position: 'right',
            requireAction: true,
            allowedCommands: ['DRAW_FROM_DECK'],
            advanceOnEvents: [{ type: 'CARDS_DRAWN', match: { playerId: '0' } }],
        },
        {
            id: 'discard-after-draw',
            content: 'game-fantasyrealms:tutorial.steps.discardAfterDraw',
            highlightTarget: 'fantasyrealms-live-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: ['DISCARD_CARD'],
            allowedTargets: ['land-bell-tower'],
            advanceOnEvents: [{ type: 'CARD_DISCARDED', match: { playerId: '0' } }],
        },
        {
            id: 'setup-take-center',
            content: 'game-fantasyrealms:tutorial.steps.setupTakeCenter',
            position: 'center',
            showMask: true,
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            currentPlayer: '0',
                            turn: 2,
                            stage: 'draw',
                            discardPile: TAKE_STEP_DISCARD,
                            drawPile: TAKE_STEP_DRAW_PILE,
                            players: {
                                '0': {
                                    hand: TAKE_STEP_HAND,
                                },
                                '1': {
                                    hand: [],
                                },
                            },
                            focusCardId: TAKE_STEP_DISCARD[0]!.id,
                        },
                    },
                },
            ],
        },
        {
            id: 'take-center-card',
            content: 'game-fantasyrealms:tutorial.steps.takeCenterCard',
            highlightTarget: 'fantasyrealms-live-center-row',
            position: 'top',
            requireAction: true,
            allowedCommands: ['TAKE_FROM_DISCARD'],
            allowedTargets: ['land-bell-tower'],
            advanceOnEvents: [{ type: 'DISCARD_CARD_TAKEN', match: { playerId: '0' } }],
        },
        {
            id: 'discard-after-center',
            content: 'game-fantasyrealms:tutorial.steps.discardAfterCenter',
            highlightTarget: 'fantasyrealms-live-hand-zone',
            position: 'top',
            requireAction: true,
            allowedCommands: ['DISCARD_CARD'],
            allowedTargets: ['weapon-magic-wand'],
            advanceOnEvents: [{ type: 'CARD_DISCARDED', match: { playerId: '0' } }],
        },
        {
            id: 'turn-loop',
            content: 'game-fantasyrealms:tutorial.steps.turnLoop',
            highlightTarget: 'fantasyrealms-live-hand-zone',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'endgame-rule',
            content: 'game-fantasyrealms:tutorial.steps.endgameRule',
            highlightTarget: 'fantasyrealms-live-center-row',
            position: 'top',
            infoStep: true,
        },
        {
            id: 'finish',
            content: 'game-fantasyrealms:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
        },
    ],
};

export default FantasyRealmsTutorial;
