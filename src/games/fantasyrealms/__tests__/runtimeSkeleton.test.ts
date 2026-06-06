import { describe, expect, it } from 'vitest';
import manifest from '../manifest';
import { OFFICIAL_FANTASY_REALMS_CARDS } from '../data/cards';
import { engineConfig } from '../game';
import { evaluateFantasyRealmsScore, FantasyRealmsDomain } from '../domain';
import type { FantasyRealmsCommand, FantasyRealmsCore } from '../domain';
import { FANTASY_REALMS_DISCARD_END_THRESHOLD } from '../foundation';

const stateOf = (core: FantasyRealmsCore) => ({ core, sys: {} as any });
const random = {
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
};

const byId = (cardId: string) => {
    const card = OFFICIAL_FANTASY_REALMS_CARDS.find((entry) => entry.id === cardId);
    if (!card) {
        throw new Error(`Unknown card: ${cardId}`);
    }
    return { ...card };
};

const applyCommand = (core: FantasyRealmsCore, command: FantasyRealmsCommand) => {
    const events = FantasyRealmsDomain.execute(stateOf(core), command, random);
    return events.reduce((nextCore, event) => FantasyRealmsDomain.reduce(nextCore, event), core);
};

describe('fantasyrealms runtime skeleton', () => {
    it('manifest 已启用本地入口，并暴露 2~6 人 runtime 元信息', () => {
        expect(manifest.id).toBe('fantasyrealms');
        expect(manifest.enabled).toBe(true);
        expect(manifest.mobileProfile).toBe('landscape-adapted');
        expect(manifest.mobileLayoutPreset).toBe('board-shell');
        expect(manifest.playerOptions).toEqual([2, 3, 4, 5, 6]);
        expect(manifest.bestPlayers).toEqual([3, 4]);
    });

    it('domain setup 产出双人变体开局：0 手牌、真实牌库、空弃牌堆', () => {
        const core = FantasyRealmsDomain.setup(['0', '1'], random);

        expect(core.currentPlayer).toBe('0');
        expect(core.stage).toBe('draw');
        expect(core.players['0']?.hand).toHaveLength(0);
        expect(core.players['1']?.hand).toHaveLength(0);
        expect(core.discardPile).toHaveLength(0);
        expect(core.drawPile).toHaveLength(53);
    });

    it('domain setup 产出 4 人基础版开局：每人 7 手牌，弃牌堆为空', () => {
        const core = FantasyRealmsDomain.setup(['0', '1', '2', '3'], random);

        expect(core.currentPlayer).toBe('0');
        expect(core.stage).toBe('draw');
        expect(core.players['0']?.hand).toHaveLength(7);
        expect(core.players['1']?.hand).toHaveLength(7);
        expect(core.players['2']?.hand).toHaveLength(7);
        expect(core.players['3']?.hand).toHaveLength(7);
        expect(core.discardPile).toHaveLength(0);
        expect(core.drawPile).toHaveLength(25);
    });

    it('手牌未满 7 时，从牌库行动会进入摸 2 弃 1阶段', () => {
        let core = FantasyRealmsDomain.setup(['0', '1'], random);
        core = applyCommand(core, {
            type: 'DRAW_FROM_DECK',
            playerId: '0',
            payload: {},
            timestamp: 1,
        });

        expect(core.stage).toBe('discard');
        expect(core.players['0']?.hand).toHaveLength(2);
        expect(core.focusCardId).toBe(core.players['0']?.hand[1]?.id);

        core = applyCommand(core, {
            type: 'DISCARD_CARD',
            playerId: '0',
            payload: { cardId: core.players['0']!.hand[0]!.id },
            timestamp: 2,
        });

        expect(core.currentPlayer).toBe('1');
        expect(core.turn).toBe(2);
        expect(core.stage).toBe('draw');
        expect(core.players['0']?.hand).toHaveLength(1);
        expect(core.discardPile).toHaveLength(1);
    });

    it('手牌未满 7 时，可以直接拿弃牌 1 张并结束回合', () => {
        let core = FantasyRealmsDomain.setup(['0', '1'], random);
        core = applyCommand(core, {
            type: 'DRAW_FROM_DECK',
            playerId: '0',
            payload: {},
            timestamp: 1,
        });
        core = applyCommand(core, {
            type: 'DISCARD_CARD',
            playerId: '0',
            payload: { cardId: core.players['0']!.hand[0]!.id },
            timestamp: 2,
        });

        const discardCardId = core.discardPile[0]!.id;
        core = applyCommand(core, {
            type: 'TAKE_FROM_DISCARD',
            playerId: '1',
            payload: { cardId: discardCardId },
            timestamp: 3,
        });

        expect(core.currentPlayer).toBe('0');
        expect(core.turn).toBe(3);
        expect(core.stage).toBe('draw');
        expect(core.players['1']?.hand).toHaveLength(1);
        expect(core.discardPile).toHaveLength(0);
    });

    it('满 7 后，从弃牌堆拿牌必须再弃 1，回合结束后维持 7 张', () => {
        let core = FantasyRealmsDomain.setup(['0', '1'], random);
        core = {
            ...core,
            currentPlayer: '0',
            stage: 'draw',
            discardPile: core.drawPile.slice(0, 2),
            drawPile: core.drawPile.slice(2),
            players: {
                ...core.players,
                '0': {
                    ...core.players['0']!,
                    hand: core.drawPile.slice(2, 9),
                    score: 0,
                    scoreBreakdown: [],
                },
                '1': {
                    ...core.players['1']!,
                    hand: core.drawPile.slice(9, 15),
                    score: 0,
                    scoreBreakdown: [],
                },
            },
        };

        const discardCardId = core.discardPile[core.discardPile.length - 1]!.id;
        core = applyCommand(core, {
            type: 'TAKE_FROM_DISCARD',
            playerId: '0',
            payload: { cardId: discardCardId },
            timestamp: 20,
        });

        expect(core.currentPlayer).toBe('0');
        expect(core.stage).toBe('discard');
        expect(core.players['0']?.hand).toHaveLength(8);
    });

    it('domain validate 会拒绝非当前阶段或不可用来源', () => {
        let core = FantasyRealmsDomain.setup(['0', '1'], random);

        expect(FantasyRealmsDomain.validate(stateOf(core), {
            type: 'TAKE_FROM_DISCARD',
            playerId: '0',
            payload: { cardId: 'missing' },
            timestamp: 1,
        })).toEqual({ valid: false, error: 'discardCardUnavailable' });

        core = applyCommand(core, {
            type: 'DRAW_FROM_DECK',
            playerId: '0',
            payload: {},
            timestamp: 2,
        });

        expect(FantasyRealmsDomain.validate(stateOf(core), {
            type: 'DRAW_FROM_DECK',
            playerId: '0',
            payload: {},
            timestamp: 3,
        })).toEqual({ valid: false, error: 'notInDrawStage' });
    });

    it('基础版回合固定抽 1 弃 1，首回合后可从弃牌堆拿牌', () => {
        let core = FantasyRealmsDomain.setup(['0', '1', '2'], random);
        const initialHandSize = core.players['0']!.hand.length;

        core = applyCommand(core, {
            type: 'DRAW_FROM_DECK',
            playerId: '0',
            payload: {},
            timestamp: 1,
        });

        expect(core.stage).toBe('discard');
        expect(core.players['0']?.hand).toHaveLength(initialHandSize + 1);
        expect(core.focusCardId).toBe(core.players['0']?.hand[core.players['0']!.hand.length - 1]?.id);

        const discardCardId = core.players['0']!.hand[0]!.id;
        core = applyCommand(core, {
            type: 'DISCARD_CARD',
            playerId: '0',
            payload: { cardId: discardCardId },
            timestamp: 2,
        });

        expect(core.currentPlayer).toBe('1');
        expect(core.players['0']?.hand).toHaveLength(initialHandSize);
        expect(core.discardPile).toHaveLength(1);

        core = applyCommand(core, {
            type: 'TAKE_FROM_DISCARD',
            playerId: '1',
            payload: { cardId: discardCardId },
            timestamp: 3,
        });

        expect(core.stage).toBe('discard');
        expect(core.currentPlayer).toBe('1');
        expect(core.players['1']?.hand).toHaveLength(8);
    });

    it('双方满 7 且弃牌堆达到 12 张时，会按正式计分裁出胜者', () => {
        let core = FantasyRealmsDomain.setup(['0', '1'], random);
        core = {
            ...core,
            discardPile: [
                byId('army-rangers'),
                byId('army-elven-archers'),
                byId('army-dwarvish-infantry'),
                byId('army-light-cavalry'),
                byId('army-celestial-knights'),
                byId('artifact-protection-rune'),
                byId('artifact-world-tree'),
                byId('artifact-shield-of-keth'),
                byId('artifact-gem-of-order'),
                byId('beast-warhorse'),
                byId('beast-unicorn'),
                byId('beast-hydra'),
            ],
            drawPile: [],
            players: {
                ...core.players,
                '0': {
                    ...core.players['0']!,
                    hand: [
                        byId('flame-candle'),
                        byId('artifact-book-of-changes'),
                        byId('land-bell-tower'),
                        byId('wizard-necromancer'),
                        byId('artifact-protection-rune'),
                        byId('weapon-magic-wand'),
                        byId('land-earth-elemental'),
                    ],
                    score: 0,
                    scoreBreakdown: [],
                },
                '1': {
                    ...core.players['1']!,
                    hand: [
                        byId('weather-blizzard'),
                        byId('flood-great-flood'),
                        byId('flame-wildfire'),
                        byId('land-underground-caverns'),
                        byId('flood-swamp'),
                        byId('leader-princess'),
                        byId('wizard-warlock-lord'),
                    ],
                    score: 0,
                    scoreBreakdown: [],
                },
            },
        };

        const player0Score = evaluateFantasyRealmsScore(core.players['0']!.hand, core.discardPile).totalScore;
        const player1Score = evaluateFantasyRealmsScore(core.players['1']!.hand, core.discardPile).totalScore;

        expect(FantasyRealmsDomain.isGameOver?.(core)).toEqual({
            winner: '0',
            scores: {
                '0': player0Score,
                '1': player1Score,
            },
        });
    });

    it('基础版弃牌堆达到 10 张时进入结束态', () => {
        const player0Hand = [
            byId('flame-candle'),
            byId('artifact-book-of-changes'),
            byId('land-bell-tower'),
            byId('artifact-protection-rune'),
            byId('weapon-magic-wand'),
            byId('land-earth-elemental'),
            byId('wizard-necromancer'),
        ];
        const player1Hand = [
            byId('weather-blizzard'),
            byId('flood-great-flood'),
            byId('flame-wildfire'),
            byId('land-underground-caverns'),
            byId('flood-swamp'),
            byId('leader-princess'),
            byId('wizard-warlock-lord'),
        ];
        const player2Hand = [
            byId('army-rangers'),
            byId('land-forest'),
            byId('beast-warhorse'),
            byId('leader-king'),
            byId('weapon-sword-of-keth'),
            byId('artifact-world-tree'),
            byId('weather-air-elemental'),
        ];

        const core = FantasyRealmsDomain.setup(['0', '1', '2'], random);
        const forcedCore: FantasyRealmsCore = {
            ...core,
            discardPile: [
                byId('army-elven-archers'),
                byId('army-dwarvish-infantry'),
                byId('army-light-cavalry'),
                byId('army-celestial-knights'),
                byId('artifact-shield-of-keth'),
                byId('artifact-gem-of-order'),
                byId('beast-unicorn'),
                byId('beast-hydra'),
                byId('flood-island'),
                byId('flood-water-elemental'),
            ],
            drawPile: [],
            players: {
                ...core.players,
                '0': { ...core.players['0']!, hand: player0Hand, score: 0, scoreBreakdown: [] },
                '1': { ...core.players['1']!, hand: player1Hand, score: 0, scoreBreakdown: [] },
                '2': { ...core.players['2']!, hand: player2Hand, score: 0, scoreBreakdown: [] },
            },
        };

        const player0Score = evaluateFantasyRealmsScore(player0Hand, forcedCore.discardPile).totalScore;
        const player1Score = evaluateFantasyRealmsScore(player1Hand, forcedCore.discardPile).totalScore;
        const player2Score = evaluateFantasyRealmsScore(player2Hand, forcedCore.discardPile).totalScore;

        expect(FantasyRealmsDomain.isGameOver?.(forcedCore)).toEqual({
            winner: '0',
            scores: {
                '0': player0Score,
                '1': player1Score,
                '2': player2Score,
            },
        });
    });

    it('game engine 暴露双人核心回合 commandTypes', () => {
        expect(engineConfig.gameId).toBe('fantasyrealms');
        expect(engineConfig.commandTypes).toEqual(['SET_FOCUS_CARD', 'DRAW_FROM_DECK', 'TAKE_FROM_DISCARD', 'DISCARD_CARD']);
        expect(engineConfig.minPlayers).toBe(2);
        expect(engineConfig.maxPlayers).toBe(6);
    });
});
