import type { TutorialManifest } from '../../engine/types';
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';
import { OFFICIAL_FANTASY_REALMS_CARDS } from './data/cards';

type TableCard = (typeof OFFICIAL_FANTASY_REALMS_CARDS)[number];

function byId(cardId: string): TableCard {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`[FantasyRealmsTutorial] 未找到卡牌: ${cardId}`);
    }
    return { ...card };
}

const DRAW_CASE_HAND = [
    byId('artifact-book-of-changes'),
    byId('flame-candle'),
    byId('weapon-magic-wand'),
    byId('leader-queen'),
    byId('flood-swamp'),
    byId('weather-rainstorm'),
    byId('weather-smoke'),
];

const DRAW_CASE_DISCARD = [
    byId('flood-swamp'),
];

const DRAW_CASE_DRAW_PILE = [
    byId('wild-mirage'),
    byId('leader-queen'),
    byId('land-bell-tower'),
    byId('wizard-necromancer'),
];

const TAKE_CASE_HAND = [
    byId('artifact-book-of-changes'),
    byId('flame-candle'),
    byId('weapon-magic-wand'),
    byId('wild-mirage'),
    byId('weather-rainstorm'),
    byId('weather-smoke'),
    byId('flood-swamp'),
];

const TAKE_CASE_DISCARD = [
    byId('land-bell-tower'),
    byId('leader-queen'),
];

const TAKE_CASE_DRAW_PILE = [
    byId('wizard-necromancer'),
    byId('artifact-protection-rune'),
    byId('land-forest'),
];

const SCORE_CASE_HAND = [
    byId('artifact-book-of-changes'),
    byId('flame-candle'),
    byId('weapon-magic-wand'),
    byId('wild-mirage'),
    byId('weather-smoke'),
    byId('wizard-collector'),
    byId('land-bell-tower'),
];

const SCORE_CASE_DISCARD = [
    byId('leader-queen'),
    byId('artifact-protection-rune'),
    byId('land-forest'),
    byId('wizard-necromancer'),
    byId('leader-king'),
    byId('weather-air-elemental'),
    byId('army-rangers'),
    byId('weapon-sword-of-keth'),
    byId('beast-hydra'),
    byId('flood-island'),
];

const SCORE_CASE_OPPONENT_HAND = [
    byId('leader-king'),
    byId('leader-queen'),
    byId('army-rangers'),
    byId('flood-island'),
    byId('weather-rainstorm'),
    byId('flame-lightning'),
    byId('weapon-sword-of-keth'),
];

export const FantasyRealmsTutorial: TutorialManifest = {
    id: 'fantasyrealms-basic',
    numPlayers: 3,
    allowManualSkip: true,
    steps: [
        {
            id: 'setup-state',
            content: 'game-fantasyrealms:tutorial.steps.setupOverview',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            setupConfig: {
                                variant: 'standard',
                                expansion: 'base',
                                cursedHoardSuitsEnabled: false,
                            },
                            playerIds: ['0', '1', '2'],
                            currentPlayer: '0',
                            turn: 3,
                            stage: 'draw',
                            discardPile: DRAW_CASE_DISCARD,
                            drawPile: DRAW_CASE_DRAW_PILE,
                            players: {
                                '0': {
                                    id: '0',
                                    name: '你',
                                    hand: DRAW_CASE_HAND,
                                },
                                '1': {
                                    id: '1',
                                    name: '对手 1',
                                    hand: [],
                                },
                                '2': {
                                    id: '2',
                                    name: '对手 2',
                                    hand: [],
                                },
                            },
                            focusCardId: 'flame-candle',
                        },
                    },
                },
            ],
        },
        {
            id: 'setup-overview',
            content: 'game-fantasyrealms:tutorial.steps.setupOverview',
            position: 'center',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'draw-overview',
            content: 'game-fantasyrealms:tutorial.steps.drawOverview',
            highlightTarget: 'fantasyrealms-live-hand-zone',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'draw-from-deck',
            content: 'game-fantasyrealms:tutorial.steps.drawFromDeck',
            highlightTarget: 'fantasyrealms-live-action-draw',
            position: 'right',
            requireAction: true,
            viewAs: '0',
            allowedCommands: ['DRAW_FROM_DECK'],
            advanceOnEvents: [{ type: 'CARDS_DRAWN', match: { playerId: '0' } }],
        },
        {
            id: 'discard-after-draw',
            content: 'game-fantasyrealms:tutorial.steps.discardAfterDraw',
            highlightTarget: 'fantasyrealms-card-hand-leader-queen',
            position: 'top',
            requireAction: true,
            viewAs: '0',
            allowedCommands: ['DISCARD_CARD'],
            allowedTargets: ['leader-queen'],
            advanceOnEvents: [{ type: 'CARD_DISCARDED', match: { playerId: '0' } }],
        },
        {
            id: 'setup-take-center',
            content: 'game-fantasyrealms:tutorial.steps.setupTakeCenter',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            setupConfig: {
                                variant: 'standard',
                                expansion: 'base',
                                cursedHoardSuitsEnabled: false,
                            },
                            playerIds: ['0', '1', '2'],
                            currentPlayer: '0',
                            turn: 4,
                            stage: 'draw',
                            discardPile: TAKE_CASE_DISCARD,
                            drawPile: TAKE_CASE_DRAW_PILE,
                            players: {
                                '0': {
                                    id: '0',
                                    name: '你',
                                    hand: TAKE_CASE_HAND,
                                },
                                '1': {
                                    id: '1',
                                    name: '对手 1',
                                    hand: [],
                                },
                                '2': {
                                    id: '2',
                                    name: '对手 2',
                                    hand: [],
                                },
                            },
                            focusCardId: 'land-bell-tower',
                        },
                    },
                },
            ],
        },
        {
            id: 'take-center-card',
            content: 'game-fantasyrealms:tutorial.steps.takeCenterCard',
            highlightTarget: 'fantasyrealms-card-discard-land-bell-tower',
            position: 'top',
            requireAction: true,
            viewAs: '0',
            allowedCommands: ['TAKE_FROM_DISCARD'],
            allowedTargets: ['land-bell-tower'],
            advanceOnEvents: [{ type: 'DISCARD_CARD_TAKEN', match: { playerId: '0' } }],
        },
        {
            id: 'discard-after-center',
            content: 'game-fantasyrealms:tutorial.steps.discardAfterCenter',
            highlightTarget: 'fantasyrealms-card-hand-weather-rainstorm',
            position: 'top',
            requireAction: true,
            viewAs: '0',
            allowedCommands: ['DISCARD_CARD'],
            allowedTargets: ['weather-rainstorm'],
            advanceOnEvents: [{ type: 'CARD_DISCARDED', match: { playerId: '0' } }],
        },
        {
            id: 'setup-score-showcase',
            content: 'game-fantasyrealms:tutorial.steps.setupScoreShowcase',
            position: 'center',
            showMask: true,
            viewAs: '0',
            aiActions: [
                {
                    commandType: CHEAT_COMMANDS.MERGE_STATE,
                    payload: {
                        fields: {
                            setupConfig: {
                                variant: 'standard',
                                expansion: 'base',
                                cursedHoardSuitsEnabled: false,
                            },
                            playerIds: ['0', '1', '2'],
                            currentPlayer: '0',
                            turn: 9,
                            stage: 'draw',
                            drawPile: [],
                            discardPile: SCORE_CASE_DISCARD,
                            players: {
                                '0': {
                                    id: '0',
                                    name: '你',
                                    hand: SCORE_CASE_HAND,
                                    score: 198,
                                    scoreBreakdown: [
                                        { label: '有效基础分', value: 48 },
                                        { label: '总加分', value: 150 },
                                        { label: '总减分', value: 0 },
                                    ],
                                },
                                '1': {
                                    id: '1',
                                    name: '对手 1',
                                    hand: SCORE_CASE_OPPONENT_HAND,
                                    score: 154,
                                    scoreBreakdown: [
                                        { label: '有效基础分', value: 71 },
                                        { label: '总加分', value: 83 },
                                        { label: '总减分', value: 0 },
                                    ],
                                },
                                '2': {
                                    id: '2',
                                    name: '对手 2',
                                    hand: [],
                                    score: 0,
                                    scoreBreakdown: [
                                        { label: '有效基础分', value: 0 },
                                        { label: '总加分', value: 0 },
                                        { label: '总减分', value: 0 },
                                    ],
                                },
                            },
                            focusCardId: 'flame-candle',
                        },
                    },
                },
                {
                    commandType: 'SET_FOCUS_CARD',
                    payload: {
                        cardId: 'flame-candle',
                    },
                    playerId: '0',
                },
            ],
        },
        {
            id: 'score-intro',
            content: 'game-fantasyrealms:tutorial.steps.scoreIntro',
            highlightTarget: 'fantasyrealms-live-score-band',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'score-card-details',
            content: 'game-fantasyrealms:tutorial.steps.scoreCardDetails',
            highlightTarget: 'fantasyrealms-card-hand-flame-candle',
            position: 'top',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'score-total-review',
            content: 'game-fantasyrealms:tutorial.steps.scoreTotalReview',
            highlightTarget: 'fantasyrealms-live-score-band',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'endgame-review',
            content: 'game-fantasyrealms:tutorial.steps.endgameReview',
            highlightTarget: 'fantasyrealms-card-hand-flame-candle',
            position: 'left',
            infoStep: true,
            viewAs: '0',
        },
        {
            id: 'finish',
            content: 'game-fantasyrealms:tutorial.steps.finish',
            position: 'center',
            infoStep: true,
            viewAs: '0',
        },
    ],
};

export default FantasyRealmsTutorial;
