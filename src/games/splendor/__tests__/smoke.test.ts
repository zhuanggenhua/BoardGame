import { describe, expect, test } from 'vitest';
import { injectSimpleChoiceBlockingInteraction } from '../../../engine/testing/interactionTestFacade';
import { SplendorDomain } from '../domain';
import type { SplendorCommand, SplendorCore, TokenColor } from '../domain';
import { CARD_DEFS_BY_ID, NOBLE_DEFS_BY_ID, calculateDiscounts, calculateEffectiveCost, computeGameResult, createPlayerState, getBankForPlayerCount } from '../domain/rules';
import { AI_ACTION_KINDS, buildSplendorAiLegalActions, splendorScorers } from '../ai';
import { formatSplendorActionEntry, engineConfig } from '../game';
import { resolveNextLocalAiAction } from '../../../engine/ai';
import type { AiDecisionContext, AiLegalAction } from '../../../engine/ai';
import { resolveAiDifficultyProfile } from '../../../engine/ai/difficulty';
import { createInitialSystemState } from '../../../engine/pipeline';
import type { ActionLogEntry, ActionLogSegment, Command, GameEvent, MatchState, RandomFn } from '../../../engine/types';
import { SPLENDOR_AUDIO_CONFIG } from '../audio.config';
import type { AudioEvent } from '../../../lib/audio/types';
import { SPLENDOR_ASSETS } from '../assets';
import { splendorCriticalImageResolver, _testExports as criticalImageResolverTestExports } from '../criticalImageResolver';

const stateOf = (core: SplendorCore) => ({ core, sys: {} as any });
const startedCore = (core: SplendorCore): SplendorCore => ({ ...core, hostStarted: true });
const { SPLENDOR_CRITICAL_IMAGE_PATHS } = criticalImageResolverTestExports;

const makeRandom = (): RandomFn => ({
    random: () => 0.5,
    d: (max: number) => Math.max(1, Math.ceil(max / 2)),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T,>(array: T[]) => [...array],
});

const createAiState = (coreOverrides: Partial<SplendorCore> = {}): MatchState<SplendorCore> => {
    const playerIds = ['0', '1'];
    const baseCore: SplendorCore = {
        playerOrder: playerIds,
        hostPlayerId: '0',
        hostStarted: true,
        startingPlayerId: '0',
        currentPlayer: '0',
        round: 1,
        players: {
            '0': createPlayerState('0'),
            '1': createPlayerState('1'),
        },
        bank: getBankForPlayerCount(2),
        market: {
            1: ['t1-black-1', 't1-blue-1', 't1-green-1', 't1-red-1'],
            2: ['t2-black-1', 't2-blue-1', 't2-green-1', 't2-red-1'],
            3: ['t3-black-1', 't3-blue-1', 't3-green-1', 't3-red-1'],
        },
        decks: { 1: [], 2: [], 3: [] },
        nobleIds: ['noble-1', 'noble-2', 'noble-3'],
        endgame: { triggered: false },
        setupPlayerCount: 2,
    };
    const core = { ...baseCore, ...coreOverrides } as SplendorCore;
    return {
        core,
        sys: {
            ...createInitialSystemState(playerIds, []),
            phase: 'main',
            interaction: { current: undefined, queue: [] },
            responseWindow: { current: undefined },
        },
    } as unknown as MatchState<SplendorCore>;
};

const createAiDecisionContext = (
    state: MatchState<SplendorCore>,
    difficulty: 'easy' | 'normal' | 'hard' | 'expert' = 'hard',
): AiDecisionContext => ({
    gameId: 'splendor',
    matchId: 'test',
    playerId: '0',
    visibleState: state,
    interaction: null,
    responseWindow: null,
    legalActions: [],
    rulesVersion: null,
    decisionBudgetMs: 250,
    source: 'local',
    difficulty: resolveAiDifficultyProfile(difficulty),
});

const createAiTestAction = (kind: string, metadata: Record<string, unknown> = {}): AiLegalAction => ({
    actionId: `test-${kind}-${JSON.stringify(metadata)}`,
    kind,
    label: kind,
    commands: [{ type: 'TEST', payload: {} }],
    metadata,
});

const reduceAll = (core: SplendorCore, events: ReturnType<typeof SplendorDomain.execute>) => {
    let next = core;
    for (const event of events) {
        next = SplendorDomain.reduce(next, event);
    }
    return next;
};

const normalizeEntries = (result: ActionLogEntry | ActionLogEntry[] | null): ActionLogEntry[] => {
    if (!result) return [];
    return Array.isArray(result) ? result : [result];
};

const resolveAudioKey = (event: AudioEvent, ctx: unknown = {
    G: {} as SplendorCore,
    ctx: {
        selfPlayerId: '0',
        currentPlayer: '0',
        pendingType: null,
        endgameTriggered: false,
        isGameOver: false,
    },
}) => SPLENDOR_AUDIO_CONFIG.feedbackResolver(event, ctx as never);

const findI18nSegment = (segments: ActionLogSegment[], key: string) =>
    segments.find((segment) => segment.type === 'i18n' && (segment as { key: string }).key === key) as
        | { type: 'i18n'; ns: string; key: string; params?: Record<string, string | number> }
        | undefined;

const hasTokenPair = (segments: ActionLogSegment[], color: TokenColor, count: number): boolean =>
    segments.some((segment, index) => {
        if (segment.type !== 'text' || segment.text !== `${count}枚`) return false;
        const next = segments[index + 1];
        return next?.type === 'i18n' && (next as { key: string }).key === `colors.${color}`;
    });

describe('splendor smoke', () => {
    test('setup creates bank and market for two players', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        expect(core.bank.white).toBe(4);
        expect(core.bank.gold).toBe(5);
        expect(core.market[1].length).toBeGreaterThan(0);
        expect(core.nobleIds).toHaveLength(3);
    });

    test('critical image resolver preloads splendor first-paint assets', () => {
        const pregame = splendorCriticalImageResolver({
            core: { hostStarted: false } as Partial<SplendorCore> as SplendorCore,
        }, undefined, '0');
        const playing = splendorCriticalImageResolver({
            core: { hostStarted: true } as Partial<SplendorCore> as SplendorCore,
        }, undefined, '0');

        expect(pregame.phaseKey).toBe('splendor:pregame:0');
        expect(playing.phaseKey).toBe('splendor:playing:0');
        expect(pregame.warm).toEqual([]);
        expect(pregame.critical).toEqual(SPLENDOR_CRITICAL_IMAGE_PATHS);
        expect(pregame.critical).toContain(SPLENDOR_ASSETS.BOARD_DESK);
        expect(pregame.critical).toContain(SPLENDOR_ASSETS.THUMBNAIL);
        expect(pregame.critical).toContain(SPLENDOR_ASSETS.CARD_LEVEL_1);
        expect(pregame.critical).toContain(SPLENDOR_ASSETS.NOBLES);
    });

    test('audio config maps gem gains and gold gains to different sounds', () => {
        expect(resolveAudioKey({
            type: 'TOKENS_GAINED',
            payload: { playerId: '0', tokens: { white: 1, blue: 1, green: 1 } },
        } as AudioEvent)).toBe('status.general.player_status_sound_fx_pack_vol.positive_buffs_and_cures.charged_a');

        expect(resolveAudioKey({
            type: 'TOKENS_GAINED',
            payload: { playerId: '0', tokens: { gold: 1 } },
        } as AudioEvent)).toBe('coins.decks_and_cards_sound_fx_pack.small_reward_001');
    });

    test('audio config distinguishes reserve source and purchase flow', () => {
        expect(resolveAudioKey({
            type: 'CARD_RESERVED',
            payload: { playerId: '0', tier: 1, cardId: 't1-white-1', source: 'open' },
        } as AudioEvent)).toBe('card.handling.decks_and_cards_sound_fx_pack.card_take_001');

        expect(resolveAudioKey({
            type: 'CARD_RESERVED',
            payload: { playerId: '0', tier: 2, cardId: 't2-red-1', source: 'deck' },
        } as AudioEvent)).toBe('card.fx.decks_and_cards_sound_fx_pack.fx_magic_deck_001');

        expect(resolveAudioKey({
            type: 'CARD_PURCHASED',
            payload: { playerId: '0', cardId: 't1-white-1', source: 'open' },
        } as AudioEvent)).toBe('ui.general.mini_games_sound_effects_and_music_pack.click.sfx_ui_click_buy');
    });

    test('audio config handles noble, endgame and final result', () => {
        expect(resolveAudioKey({
            type: 'NOBLE_GAINED',
            payload: { playerId: '0', nobleId: 'noble-1' },
        } as AudioEvent)).toBe('ui.general.ui_menu_sound_fx_pack_vol.signals.positive.signal_positive_bells_a');

        expect(resolveAudioKey({
            type: 'ENDGAME_TRIGGERED',
            payload: { triggeredByPlayerId: '0', triggerRound: 6 },
        } as AudioEvent)).toBe('ui.general.mini_games_sound_effects_and_music_pack.success.sfx_success_point_medium');

        expect(resolveAudioKey({
            type: 'GAME_ENDED',
            payload: { winners: ['0'], scores: { '0': 15, '1': 12 } },
        } as AudioEvent, {
            G: {} as SplendorCore,
            ctx: {
                selfPlayerId: '0',
                currentPlayer: '0',
                pendingType: null,
                endgameTriggered: true,
                isGameOver: true,
            },
        })).toBe('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_win');

        expect(resolveAudioKey({
            type: 'GAME_ENDED',
            payload: { winners: ['1'], scores: { '0': 12, '1': 15 } },
        } as AudioEvent, {
            G: {} as SplendorCore,
            ctx: {
                selfPlayerId: '0',
                currentPlayer: '1',
                pendingType: null,
                endgameTriggered: true,
                isGameOver: true,
            },
        })).toBe('stinger.mini_games_sound_effects_and_music_pack.stinger.stgr_action_lose');
    });

    test('setup uses correct bank and noble counts for 3 and 4 players', () => {
        const core3 = SplendorDomain.setup(['0', '1', '2'], makeRandom());
        const core4 = SplendorDomain.setup(['0', '1', '2', '3'], makeRandom());

        expect(core3.bank.white).toBe(5);
        expect(core3.nobleIds).toHaveLength(4);
        expect(core4.bank.white).toBe(7);
        expect(core4.nobleIds).toHaveLength(5);
    });

    test('setup starts in pregame state and waits for host to start', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        expect(core.hostPlayerId).toBe('0');
        expect(core.hostStarted).toBe(false);
    });

    test('setupData.startingPlayerId can override opening player and keeps turn order rotation', () => {
        const core = SplendorDomain.setup(['0', '1', '2'], makeRandom(), { startingPlayerId: '2' });

        expect(core.startingPlayerId).toBe('2');
        expect(core.currentPlayer).toBe('2');
        expect(core.playerOrder).toEqual(['0', '1', '2']);

        const started = startedCore(core);
        const firstTurn = reduceAll(started, SplendorDomain.execute(stateOf(started), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '2',
            payload: { colors: ['white', 'blue', 'green'] },
            timestamp: 1,
        }, makeRandom()));
        expect(firstTurn.currentPlayer).toBe('0');

        const secondTurn = reduceAll(firstTurn, SplendorDomain.execute(stateOf(firstTurn), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'red', 'black'] },
            timestamp: 2,
        }, makeRandom()));
        expect(secondTurn.currentPlayer).toBe('1');
    });

    test('invalid setupData.startingPlayerId falls back to the first seat', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom(), { startingPlayerId: '3' });

        expect(core.startingPlayerId).toBe('0');
        expect(core.currentPlayer).toBe('0');
    });

    test('gameplay commands are rejected before host starts the game', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'blue', 'green'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('gameNotStarted');
    });

    test('host can start the game and unlock gameplay commands', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const startCommand: SplendorCommand = {
            type: 'HOST_START_GAME',
            playerId: '0',
            payload: {},
            timestamp: 1,
        };

        const startValidation = SplendorDomain.validate(stateOf(core), startCommand);
        expect(startValidation.valid).toBe(true);

        const startedCore = reduceAll(core, SplendorDomain.execute(stateOf(core), startCommand, makeRandom()));
        expect(startedCore.hostStarted).toBe(true);

        const gameplayCommand: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'blue', 'green'] },
            timestamp: 2,
        };
        const gameplayValidation = SplendorDomain.validate(stateOf(startedCore), gameplayCommand);
        expect(gameplayValidation.valid).toBe(true);
    });

    test('non-host cannot start the game', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const command: SplendorCommand = {
            type: 'HOST_START_GAME',
            playerId: '1',
            payload: {},
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('onlyHostCanStart');
    });

    test('card and noble display names no longer expose internal placeholders', () => {
        expect(CARD_DEFS_BY_ID['t1-white-1']?.name).not.toBe('t1-white-1');
        expect(CARD_DEFS_BY_ID['t1-white-1']?.name).not.toMatch(/^t\d-/);
        expect(NOBLE_DEFS_BY_ID['noble-1']?.name).not.toBe('Noble 1');
        expect(NOBLE_DEFS_BY_ID['noble-1']?.name).not.toMatch(/^Noble\s+\d+$/);
    });

    test('take three gems updates player and turn', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'blue', 'green'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(true);

        const events = SplendorDomain.execute(stateOf(core), command, makeRandom());
        let next = core;
        for (const event of events) {
            next = SplendorDomain.reduce(next, event);
        }

        expect(next.players['0'].tokens.white).toBe(1);
        expect(next.players['0'].tokens.blue).toBe(1);
        expect(next.players['0'].tokens.green).toBe(1);
        expect(next.currentPlayer).toBe('1');
    });

    test('take two same gems is rejected when pile has fewer than four', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const command: SplendorCommand = {
            type: 'TAKE_TWO_SAME_GEMS',
            playerId: '0',
            payload: { color: 'white' },
            timestamp: 1,
        };

        const invalidCore: SplendorCore = {
            ...core,
            bank: {
                ...core.bank,
                white: 3,
            },
        };

        const validation = SplendorDomain.validate(stateOf(invalidCore), command);
        expect(validation.valid).toBe(false);
    });

    test('take two same gems rejects invalid gem colors before reading bank state', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const command = {
            type: 'TAKE_TWO_SAME_GEMS',
            playerId: '0',
            payload: { color: 'gold' },
            timestamp: 1,
        } as unknown as SplendorCommand;

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('invalidGemColor');
    });

    test('reserve open card grants gold when available and refills market', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const cardId = core.market[1][0];
        const deckBefore = core.decks[1].length;

        const command: SplendorCommand = {
            type: 'RESERVE_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(core, SplendorDomain.execute(stateOf(core), command, makeRandom()));
        expect(next.players['0'].reservedCardIds).toContain(cardId);
        expect(next.players['0'].tokens.gold).toBe(1);
        expect(next.market[1]).not.toContain(cardId);
        expect(next.decks[1].length).toBe(deckBefore - 1);
    });

    test('reserve still works when gold supply is empty', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const cardId = core.market[1][0];
        const noGoldCore: SplendorCore = {
            ...core,
            bank: {
                ...core.bank,
                gold: 0,
            },
        };

        const command: SplendorCommand = {
            type: 'RESERVE_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId },
            timestamp: 1,
        };

        const next = reduceAll(noGoldCore, SplendorDomain.execute(stateOf(noGoldCore), command, makeRandom()));
        expect(next.players['0'].reservedCardIds).toContain(cardId);
        expect(next.players['0'].tokens.gold).toBe(0);
    });

    test('reserve deck top removes exactly one card from the chosen deck', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const topCard = core.decks[2][0];
        const command: SplendorCommand = {
            type: 'RESERVE_DECK_TOP_CARD',
            playerId: '0',
            payload: { tier: 2 },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(core, SplendorDomain.execute(stateOf(core), command, makeRandom()));
        expect(next.players['0'].reservedCardIds).toContain(topCard);
        expect(next.decks[2].length).toBe(core.decks[2].length - 1);
    });

    test('reserve deck top is rejected when the chosen deck is empty', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const emptyDeckCore: SplendorCore = {
            ...core,
            decks: {
                ...core.decks,
                2: [],
            },
        };

        const command: SplendorCommand = {
            type: 'RESERVE_DECK_TOP_CARD',
            playerId: '0',
            payload: { tier: 2 },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(emptyDeckCore), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('deckEmpty');
    });

    test('reserve is rejected when player already has three reserved cards', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const crowdedCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    reservedCardIds: ['t1-white-1', 't1-white-2', 't1-blue-1'],
                },
            },
        };
        const cardId = crowdedCore.market[1][0];
        const command: SplendorCommand = {
            type: 'RESERVE_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(crowdedCore), command);
        expect(validation.valid).toBe(false);
    });

    test('buy open card spends tokens and moves card to purchased area', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const cardId = core.market[1][0];
        const card = CARD_DEFS_BY_ID[cardId];

        const richCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        ...core.players['0'].tokens,
                        white: 5,
                        blue: 5,
                        green: 5,
                        red: 5,
                        black: 5,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(richCore), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(richCore, SplendorDomain.execute(stateOf(richCore), command, makeRandom()));
        expect(next.players['0'].purchasedCardIds).toContain(cardId);
        expect(next.market[1]).not.toContain(cardId);
        expect(next.players['0'].tokens[card.bonus]).toBeLessThanOrEqual(5);
        expect(next.players['0'].points).toBeGreaterThanOrEqual(card.points);
    });

    test('buy reserved card can spend gold as wildcard', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const cardId = 't1-red-8';
        const reservedCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    reservedCardIds: [cardId],
                    tokens: {
                        white: 0,
                        blue: 0,
                        green: 0,
                        red: 0,
                        black: 0,
                        gold: 4,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_RESERVED_CARD',
            playerId: '0',
            payload: { cardId },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(reservedCore), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(reservedCore, SplendorDomain.execute(stateOf(reservedCore), command, makeRandom()));
        expect(next.players['0'].reservedCardIds).not.toContain(cardId);
        expect(next.players['0'].purchasedCardIds).toContain(cardId);
        expect(next.players['0'].tokens.gold).toBe(0);
    });

    test('free purchase works when discounts fully cover cost', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const freeCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t1-white-1', 't1-white-2', 't1-white-3', 't1-white-4'],
                    points: 0,
                },
            },
        };

        const cardId = 't1-red-8';
        const reservedCore: SplendorCore = {
            ...freeCore,
            players: {
                ...freeCore.players,
                '0': {
                    ...freeCore.players['0'],
                    reservedCardIds: [cardId],
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_RESERVED_CARD',
            playerId: '0',
            payload: { cardId },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(reservedCore), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(reservedCore, SplendorDomain.execute(stateOf(reservedCore), command, makeRandom()));
        expect(next.players['0'].purchasedCardIds).toContain(cardId);
        expect(next.players['0'].tokens.gold).toBe(0);
    });

    test('discounts reduce card cost correctly', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const state: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t1-red-1', 't1-red-2', 't1-blue-1'],
                    points: 0,
                },
            },
        };
        const discounts = calculateDiscounts(state.players['0']);
        expect(discounts.red).toBe(2);
        expect(discounts.blue).toBe(1);

        const cost = calculateEffectiveCost(state.players['0'], CARD_DEFS_BY_ID['t2-red-3']);
        expect(cost.blue).toBe(3);
        expect(cost.green).toBe(2);
        expect(cost.black).toBe(0);
    });

    test('take three allows taking two colors when only two colors are available', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const reducedCore: SplendorCore = {
            ...core,
            bank: {
                ...core.bank,
                white: 1,
                blue: 1,
                green: 0,
                red: 0,
                black: 0,
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'blue'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(reducedCore), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(reducedCore, SplendorDomain.execute(stateOf(reducedCore), command, makeRandom()));
        expect(next.players['0'].tokens.white).toBe(1);
        expect(next.players['0'].tokens.blue).toBe(1);
    });

    test('take three allows taking one color when only one color is available', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const reducedCore: SplendorCore = {
            ...core,
            bank: {
                ...core.bank,
                white: 1,
                blue: 0,
                green: 0,
                red: 0,
                black: 0,
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(reducedCore), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(reducedCore, SplendorDomain.execute(stateOf(reducedCore), command, makeRandom()));
        expect(next.players['0'].tokens.white).toBe(1);
    });

    test('take three rejects taking two colors when three or more colors are available', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'blue'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('invalidTakeThreeSelection');
    });

    test('take three rejects taking one color when three or more colors are available', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(core), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('invalidTakeThreeSelection');
    });

    test('non-pending commands are rejected while discard resolution is active', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const pendingCore: SplendorCore = {
            ...core,
            pendingResolution: {
                type: 'discardToLimit',
                excess: 2,
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId: pendingCore.market[1][0] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(pendingCore), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('mustDiscardGems');
    });

    test('non-pending commands are rejected while noble choice is active', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const pendingCore: SplendorCore = {
            ...core,
            pendingResolution: {
                type: 'chooseNoble',
                nobleIds: ['noble-1', 'noble-4'],
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(pendingCore), command);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBe('mustChooseNoble');
    });

    test('fully tied players share victory', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const tieCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t3-white-4'],
                    nobleIds: ['noble-1', 'noble-2'],
                    points: 11,
                },
                '1': {
                    ...core.players['1'],
                    purchasedCardIds: ['t3-blue-4'],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 11,
                },
            },
        };

        const result = computeGameResult(tieCore);
        expect(result.draw).toBe(true);
        expect(result.winners).toEqual(['0', '1']);
    });

    test('setting more than 10 tokens triggers discard resolution', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const richCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 2,
                        blue: 2,
                        green: 2,
                        red: 2,
                        black: 2,
                        gold: 2,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const next = reduceAll(richCore, SplendorDomain.execute(stateOf(richCore), command, makeRandom()));
        expect(next.pendingResolution?.type).toBe('discardToLimit');
    });

    test('discard command clears pending discard and keeps turn closure flowing', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const pendingCore: SplendorCore = {
            ...core,
            pendingResolution: {
                type: 'discardToLimit',
                excess: 1,
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 1,
                        blue: 0,
                        green: 0,
                        red: 0,
                        black: 0,
                        gold: 0,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'DISCARD_GEMS_TO_LIMIT',
            playerId: '0',
            payload: { color: 'white' },
            timestamp: 1,
        };

        const next = reduceAll(pendingCore, SplendorDomain.execute(stateOf(pendingCore), command, makeRandom()));
        expect(next.pendingResolution).toBeUndefined();
        expect(next.players['0'].tokens.white).toBe(0);
        expect(next.currentPlayer).toBe('1');
    });

    test('discard command re-enters discard pending when player still has more than 10 tokens', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const pendingCore: SplendorCore = {
            ...core,
            pendingResolution: {
                type: 'discardToLimit',
                excess: 2,
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 2,
                        blue: 2,
                        green: 2,
                        red: 2,
                        black: 2,
                        gold: 2,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'DISCARD_GEMS_TO_LIMIT',
            playerId: '0',
            payload: { color: 'white' },
            timestamp: 1,
        };

        const next = reduceAll(pendingCore, SplendorDomain.execute(stateOf(pendingCore), command, makeRandom()));
        expect(next.pendingResolution?.type).toBe('discardToLimit');
        expect(next.pendingResolution && next.pendingResolution.type === 'discardToLimit' ? next.pendingResolution.excess : 0).toBe(1);
        expect(next.currentPlayer).toBe('0');
    });

    test('two discard steps can finish and then continue into noble choice before turn advances', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const setupCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-4', 'noble-9'],
            pendingResolution: {
                type: 'discardToLimit',
                excess: 2,
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 1,
                        blue: 2,
                        green: 2,
                        red: 2,
                        black: 2,
                        gold: 3,
                    },
                    purchasedCardIds: [
                        't1-white-1', 't1-white-2', 't2-white-1',
                        't1-blue-1', 't1-blue-2', 't2-blue-1',
                        't1-black-1', 't1-black-2', 't2-black-1',
                    ],
                    points: 0,
                },
            },
        };

        const afterFirst = reduceAll(setupCore, SplendorDomain.execute(stateOf(setupCore), {
            type: 'DISCARD_GEMS_TO_LIMIT',
            playerId: '0',
            payload: { color: 'gold' },
            timestamp: 1,
        }, makeRandom()));
        expect(afterFirst.pendingResolution?.type).toBe('discardToLimit');

        const afterSecond = reduceAll(afterFirst, SplendorDomain.execute(stateOf(afterFirst), {
            type: 'DISCARD_GEMS_TO_LIMIT',
            playerId: '0',
            payload: { color: 'gold' },
            timestamp: 2,
        }, makeRandom()));

        expect(afterSecond.pendingResolution).toBeUndefined();
        expect(afterSecond.players['0'].nobleIds).toContain('noble-4');
        expect(afterSecond.currentPlayer).toBe('1');
    });

    test('multiple eligible nobles trigger choose noble resolution', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        const forcedCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1', 'noble-3'],
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: [
                        't1-white-1', 't1-white-2', 't2-white-1', 't2-white-2',
                        't1-blue-1', 't1-blue-2', 't2-blue-1', 't2-blue-2',
                        't1-green-1', 't1-green-2', 't2-green-1', 't2-green-2',
                    ],
                    points: 0,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const next = reduceAll(forcedCore, SplendorDomain.execute(stateOf(forcedCore), command, makeRandom()));
        expect(next.pendingResolution?.type).toBe('chooseNoble');
        expect(next.pendingResolution && next.pendingResolution.type === 'chooseNoble' ? next.pendingResolution.nobleIds.length : 0).toBe(2);
    });

    test('choosing noble grants exactly one noble and clears pending state', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const pendingCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1', 'noble-3'],
            pendingResolution: {
                type: 'chooseNoble',
                nobleIds: ['noble-1', 'noble-3'],
            },
        };

        const command: SplendorCommand = {
            type: 'CHOOSE_NOBLE',
            playerId: '0',
            payload: { nobleId: 'noble-1' },
            timestamp: 1,
        };

        const next = reduceAll(pendingCore, SplendorDomain.execute(stateOf(pendingCore), command, makeRandom()));
        expect(next.pendingResolution).toBeUndefined();
        expect(next.players['0'].nobleIds).toContain('noble-1');
        expect(next.nobleIds).not.toContain('noble-1');
        expect(next.players['0'].points).toBe(3);
    });

    test('choosing noble can be the final step that triggers endgame', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const pendingCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1', 'noble-3'],
            pendingResolution: {
                type: 'chooseNoble',
                nobleIds: ['noble-1', 'noble-3'],
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t3-white-4', 't3-blue-4', 't2-white-1'],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 0,
                },
            },
        };

        const next = reduceAll(pendingCore, SplendorDomain.execute(stateOf(pendingCore), {
            type: 'CHOOSE_NOBLE',
            playerId: '0',
            payload: { nobleId: 'noble-1' },
            timestamp: 1,
        }, makeRandom()));

        expect(next.players['0'].nobleIds).toContain('noble-1');
        expect(next.endgame.triggered).toBe(true);
    });

    test('market refill does nothing when the deck is empty', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const cardId = core.market[3][0];
        const emptyDeckCore: SplendorCore = {
            ...core,
            decks: {
                ...core.decks,
                3: [],
            },
        };

        const richCore: SplendorCore = {
            ...emptyDeckCore,
            players: {
                ...emptyDeckCore.players,
                '0': {
                    ...emptyDeckCore.players['0'],
                    tokens: {
                        ...emptyDeckCore.players['0'].tokens,
                        white: 10,
                        blue: 10,
                        green: 10,
                        red: 10,
                        black: 10,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 3, cardId },
            timestamp: 1,
        };

        const next = reduceAll(richCore, SplendorDomain.execute(stateOf(richCore), command, makeRandom()));
        expect(next.market[3]).not.toContain(cardId);
        expect(next.market[3].length).toBe(emptyDeckCore.market[3].length - 1);
        expect(next.decks[3]).toHaveLength(0);
    });

    test('buy open card can refill market and then immediately trigger noble and endgame', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        const setupCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1'],
            market: {
                ...core.market,
                1: ['t1-black-1', ...core.market[1].filter((id) => id !== 't1-black-1')],
            },
            decks: {
                ...core.decks,
                1: ['t1-blue-8', ...core.decks[1].filter((id) => id !== 't1-blue-8')],
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 1,
                        blue: 1,
                        green: 1,
                        red: 1,
                        black: 0,
                        gold: 0,
                    },
                    purchasedCardIds: [
                        't3-white-2',
                        't3-blue-2',
                        't1-white-1',
                        't1-white-2',
                        't2-white-1',
                        't2-white-2',
                        't1-blue-1',
                        't1-blue-2',
                        't2-blue-1',
                    ],
                    nobleIds: ['noble-4', 'noble-5', 'noble-6'],
                    points: 13,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId: 't1-black-1' },
            timestamp: 1,
        };

        const next = reduceAll(setupCore, SplendorDomain.execute(stateOf(setupCore), command, makeRandom()));
        expect(next.players['0'].purchasedCardIds).toContain('t1-black-1');
        expect(next.market[1]).not.toContain('t1-black-1');
        expect(next.market[1]).toContain('t1-blue-8');
        expect(next.players['0'].nobleIds).toContain('noble-1');
        expect(next.endgame.triggered).toBe(true);
    });

    test('playerView masks opponent reserved cards', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const hiddenCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '1': {
                    ...core.players['1'],
                    reservedCardIds: ['t1-white-1', 't1-blue-1'],
                },
            },
        };

        const partial = SplendorDomain.playerView?.(hiddenCore, '0');
        expect(partial?.players?.['1'].reservedCardIds).toEqual(['hidden-reserved-1-0', 'hidden-reserved-1-1']);
        expect(partial?.decks?.[1]).toHaveLength(hiddenCore.decks[1].length);
        expect(partial?.decks?.[1]?.[0]).toBe('hidden-deck-1-0');
        expect(partial?.decks?.[1]).not.toEqual(hiddenCore.decks[1]);
    });

    test('playerView masks each opponent reserved cards consistently in three-player game', () => {
        const core = SplendorDomain.setup(['0', '1', '2'], makeRandom());
        const hiddenCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '1': {
                    ...core.players['1'],
                    reservedCardIds: ['t1-white-1'],
                },
                '2': {
                    ...core.players['2'],
                    reservedCardIds: ['t1-blue-1', 't1-green-1'],
                },
            },
        };

        const p0View = SplendorDomain.playerView?.(hiddenCore, '0');
        const p1View = SplendorDomain.playerView?.(hiddenCore, '1');

        expect(p0View?.players?.['1'].reservedCardIds).toEqual(['hidden-reserved-1-0']);
        expect(p0View?.players?.['2'].reservedCardIds).toEqual(['hidden-reserved-2-0', 'hidden-reserved-2-1']);
        expect(p1View?.players?.['1'].reservedCardIds).toEqual(['t1-white-1']);
        expect(p1View?.players?.['2'].reservedCardIds).toEqual(['hidden-reserved-2-0', 'hidden-reserved-2-1']);
        expect(p0View?.decks?.[2]).toHaveLength(hiddenCore.decks[2].length);
        expect(p0View?.decks?.[2]?.[0]).toBe('hidden-deck-2-0');
        expect(p1View?.decks?.[3]).toHaveLength(hiddenCore.decks[3].length);
        expect(p1View?.decks?.[3]?.[0]).toBe('hidden-deck-3-0');
    });

    test('game ends after last player completes round once endgame was triggered', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        const triggerCore: SplendorCore = {
            ...core,
            currentPlayer: '1',
            endgame: {
                triggered: true,
                triggerRound: 1,
                triggeredByPlayerId: '0',
            },
            players: {
                ...core.players,
                '1': {
                    ...core.players['1'],
                    purchasedCardIds: ['t3-white-4'],
                    nobleIds: ['noble-1', 'noble-2', 'noble-3', 'noble-4'],
                    points: 17,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '1',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const next = reduceAll(triggerCore, SplendorDomain.execute(stateOf(triggerCore), command, makeRandom()));
        expect(next.gameResult).toBeDefined();
    });

    test('endgame closure follows triggeredBy turn cycle when starting player is not seat0', () => {
        const core = SplendorDomain.setup(['0', '1', '2'], makeRandom(), { startingPlayerId: '2' });
        const baseCore: SplendorCore = startedCore({
            ...core,
            endgame: {
                triggered: true,
                triggerRound: 2,
                triggeredByPlayerId: '2',
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t3-white-4'],
                    nobleIds: ['noble-1', 'noble-2', 'noble-3', 'noble-4'],
                    points: 17,
                },
                '1': {
                    ...core.players['1'],
                    purchasedCardIds: ['t3-blue-4'],
                    nobleIds: ['noble-5', 'noble-6', 'noble-7', 'noble-8'],
                    points: 17,
                },
            },
        });

        const beforeFinalPlayer: SplendorCore = {
            ...baseCore,
            currentPlayer: '0',
        };
        const notFinalYet = reduceAll(beforeFinalPlayer, SplendorDomain.execute(stateOf(beforeFinalPlayer), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        }, makeRandom()));
        expect(notFinalYet.gameResult).toBeUndefined();
        expect(notFinalYet.currentPlayer).toBe('1');

        const finalPlayerTurn: SplendorCore = {
            ...baseCore,
            currentPlayer: '1',
        };
        const finished = reduceAll(finalPlayerTurn, SplendorDomain.execute(stateOf(finalPlayerTurn), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '1',
            payload: { colors: ['white'] },
            timestamp: 2,
        }, makeRandom()));
        expect(finished.gameResult).toBeDefined();
    });

    test('gaining a noble can trigger endgame at turn closure', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        const setupCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1'],
            bank: {
                ...core.bank,
                white: 1,
                blue: 0,
                green: 0,
                red: 0,
                black: 0,
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: [
                        't1-white-1', 't1-white-2', 't2-white-1', 't2-white-2', 't1-white-8',
                        't1-blue-1', 't1-blue-2', 't2-blue-1', 't2-blue-2', 't1-blue-8',
                    ],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 12,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const next = reduceAll(setupCore, SplendorDomain.execute(stateOf(setupCore), command, makeRandom()));
        expect(next.players['0'].nobleIds).toContain('noble-1');
        expect(next.endgame.triggered).toBe(true);
    });

    test('discard to limit can chain into noble gain and endgame trigger', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        const setupCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1'],
            pendingResolution: {
                type: 'discardToLimit',
                excess: 1,
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 1,
                        blue: 0,
                        green: 0,
                        red: 0,
                        black: 0,
                        gold: 0,
                    },
                    purchasedCardIds: [
                        't1-white-1', 't1-white-2', 't2-white-1', 't2-white-2', 't1-white-8',
                        't1-blue-1', 't1-blue-2', 't2-blue-1', 't2-blue-2', 't1-blue-8',
                    ],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 12,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'DISCARD_GEMS_TO_LIMIT',
            playerId: '0',
            payload: { color: 'white' },
            timestamp: 1,
        };

        const next = reduceAll(setupCore, SplendorDomain.execute(stateOf(setupCore), command, makeRandom()));
        expect(next.pendingResolution).toBeUndefined();
        expect(next.players['0'].tokens.white).toBe(0);
        expect(next.players['0'].nobleIds).toContain('noble-1');
        expect(next.endgame.triggered).toBe(true);
    });

    test('three-player game does not end before trigger round is fully completed', () => {
        const core = SplendorDomain.setup(['0', '1', '2'], makeRandom());

        const triggerCore: SplendorCore = {
            ...core,
            currentPlayer: '2',
            round: 1,
            endgame: {
                triggered: true,
                triggerRound: 2,
                triggeredByPlayerId: '1',
            },
        };

        const command: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '2',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const next = reduceAll(triggerCore, SplendorDomain.execute(stateOf(triggerCore), command, makeRandom()));
        expect(next.gameResult).toBeUndefined();
        expect(next.currentPlayer).toBe('0');
        expect(next.round).toBe(2);
    });

    test('three-player game with trigger by player 1 ends when turn cycle is about to return to player 1', () => {
        const core = SplendorDomain.setup(['0', '1', '2'], makeRandom());

        const afterPlayer2: SplendorCore = {
            ...core,
            currentPlayer: '2',
            round: 2,
            endgame: {
                triggered: true,
                triggerRound: 2,
                triggeredByPlayerId: '1',
            },
            players: {
                ...core.players,
                '2': {
                    ...core.players['2'],
                    purchasedCardIds: ['t3-red-4'],
                    nobleIds: ['noble-1', 'noble-4', 'noble-5', 'noble-8'],
                    points: 17,
                },
            },
        };

        const commandP2: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '2',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const afterP2 = reduceAll(afterPlayer2, SplendorDomain.execute(stateOf(afterPlayer2), commandP2, makeRandom()));
        expect(afterP2.gameResult).toBeUndefined();
        expect(afterP2.currentPlayer).toBe('0');

        const afterPlayer0: SplendorCore = {
            ...afterP2,
            players: {
                ...afterP2.players,
                '0': {
                    ...afterP2.players['0'],
                    purchasedCardIds: ['t3-blue-4'],
                    nobleIds: ['noble-2', 'noble-4', 'noble-6', 'noble-9'],
                    points: 17,
                },
            },
        };

        const commandP0: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 2,
        };

        const final = reduceAll(afterPlayer0, SplendorDomain.execute(stateOf(afterPlayer0), commandP0, makeRandom()));
        expect(final.gameResult).toBeDefined();
    });

    test('buying a card can immediately create multiple eligible nobles', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));

        const setupCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-1', 'noble-4'],
            market: {
                ...core.market,
                1: ['t1-black-1', ...core.market[1].filter((id) => id !== 't1-black-1')],
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 1,
                        blue: 1,
                        green: 1,
                        red: 1,
                        black: 0,
                        gold: 0,
                    },
                    purchasedCardIds: [
                        't1-white-1',
                        't1-white-2',
                        't2-white-1',
                        't2-white-2',
                        't1-blue-1',
                        't1-blue-2',
                        't2-blue-1',
                        't2-blue-2',
                        't1-black-2',
                        't1-black-3',
                        't2-black-1',
                        't2-black-2',
                    ],
                    points: 0,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId: 't1-black-1' },
            timestamp: 1,
        };

        const validation = SplendorDomain.validate(stateOf(setupCore), command);
        expect(validation.valid).toBe(true);

        const next = reduceAll(setupCore, SplendorDomain.execute(stateOf(setupCore), command, makeRandom()));
        expect(next.players['0'].purchasedCardIds).toContain('t1-black-1');
        expect(next.pendingResolution?.type).toBe('chooseNoble');
        expect(next.pendingResolution && next.pendingResolution.type === 'chooseNoble'
            ? next.pendingResolution.nobleIds.sort()
            : []).toEqual(['noble-1', 'noble-4']);
    });

    test('buying a card that satisfies multiple nobles does not auto-claim any noble before choice', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());

        const setupCore: SplendorCore = {
            ...core,
            nobleIds: ['noble-3', 'noble-8'],
            market: {
                ...core.market,
                1: ['t1-green-1', ...core.market[1].filter((id) => id !== 't1-green-1')],
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 1,
                        blue: 1,
                        green: 0,
                        red: 1,
                        black: 1,
                        gold: 0,
                    },
                    purchasedCardIds: [
                        't1-white-1', 't1-white-2', 't2-white-1',
                        't1-blue-1', 't1-blue-2', 't2-blue-1',
                        't1-red-1', 't1-red-2', 't2-red-1',
                        't1-green-2', 't2-green-1',
                    ],
                    points: 0,
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId: 't1-green-1' },
            timestamp: 1,
        };

        const next = reduceAll(setupCore, SplendorDomain.execute(stateOf(setupCore), command, makeRandom()));
        expect(next.players['0'].purchasedCardIds).toContain('t1-green-1');
        expect(next.players['0'].nobleIds).toEqual([]);
        expect(next.pendingResolution?.type).toBe('chooseNoble');
        expect(next.pendingResolution && next.pendingResolution.type === 'chooseNoble'
            ? next.pendingResolution.nobleIds.sort()
            : []).toEqual(['noble-3', 'noble-8']);
    });

    test('four-player game triggered by player 1 only ends after players 2, 3, and 0 complete', () => {
        const core = SplendorDomain.setup(['0', '1', '2', '3'], makeRandom());

        const preFinalCore: SplendorCore = {
            ...core,
            currentPlayer: '2',
            round: 2,
            endgame: {
                triggered: true,
                triggerRound: 2,
                triggeredByPlayerId: '1',
            },
        };

        const commandBeforeLast: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '2',
            payload: { colors: ['white'] },
            timestamp: 1,
        };

        const mid = reduceAll(preFinalCore, SplendorDomain.execute(stateOf(preFinalCore), commandBeforeLast, makeRandom()));
        expect(mid.gameResult).toBeUndefined();
        expect(mid.currentPlayer).toBe('3');

        const finalCore: SplendorCore = {
            ...mid,
            players: {
                ...mid.players,
                '3': {
                    ...mid.players['3'],
                    purchasedCardIds: ['t3-blue-4'],
                    nobleIds: ['noble-1', 'noble-2', 'noble-3', 'noble-4'],
                    points: 17,
                },
            },
        };

        const commandLast: SplendorCommand = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '3',
            payload: { colors: ['white'] },
            timestamp: 2,
        };

        const afterP3 = reduceAll(finalCore, SplendorDomain.execute(stateOf(finalCore), commandLast, makeRandom()));
        expect(afterP3.gameResult).toBeUndefined();
        expect(afterP3.currentPlayer).toBe('0');

        const afterP0Setup: SplendorCore = {
            ...afterP3,
            players: {
                ...afterP3.players,
                '0': {
                    ...afterP3.players['0'],
                    purchasedCardIds: ['t3-red-4'],
                    nobleIds: ['noble-5', 'noble-6', 'noble-7', 'noble-8'],
                    points: 17,
                },
            },
        };

        const final = reduceAll(afterP0Setup, SplendorDomain.execute(stateOf(afterP0Setup), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 3,
        }, makeRandom()));
        expect(final.gameResult).toBeDefined();
    });

    test('four-player game triggered by player 0 only ends after players 1, 2, and 3 finish the same round', () => {
        const core = SplendorDomain.setup(['0', '1', '2', '3'], makeRandom());

        const afterTrigger: SplendorCore = {
            ...core,
            currentPlayer: '1',
            round: 1,
            endgame: {
                triggered: true,
                triggerRound: 1,
                triggeredByPlayerId: '0',
            },
        };

        const afterP1 = reduceAll(afterTrigger, SplendorDomain.execute(stateOf(afterTrigger), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '1',
            payload: { colors: ['white'] },
            timestamp: 1,
        }, makeRandom()));
        expect(afterP1.gameResult).toBeUndefined();
        expect(afterP1.currentPlayer).toBe('2');

        const afterP2 = reduceAll(afterP1, SplendorDomain.execute(stateOf(afterP1), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '2',
            payload: { colors: ['white'] },
            timestamp: 2,
        }, makeRandom()));
        expect(afterP2.gameResult).toBeUndefined();
        expect(afterP2.currentPlayer).toBe('3');

        const afterP3Setup: SplendorCore = {
            ...afterP2,
            players: {
                ...afterP2.players,
                '3': {
                    ...afterP2.players['3'],
                    purchasedCardIds: ['t3-red-4'],
                    nobleIds: ['noble-1', 'noble-4', 'noble-5', 'noble-8'],
                    points: 17,
                },
            },
        };

        const final = reduceAll(afterP3Setup, SplendorDomain.execute(stateOf(afterP3Setup), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '3',
            payload: { colors: ['white'] },
            timestamp: 3,
        }, makeRandom()));
        expect(final.gameResult).toBeDefined();
    });

    test('four-player game triggered by player 2 ends after players 3, 0, and 1 complete', () => {
        const core = SplendorDomain.setup(['0', '1', '2', '3'], makeRandom());

        const afterTrigger: SplendorCore = {
            ...core,
            currentPlayer: '3',
            round: 2,
            endgame: {
                triggered: true,
                triggerRound: 2,
                triggeredByPlayerId: '2',
            },
            players: {
                ...core.players,
                '3': {
                    ...core.players['3'],
                    purchasedCardIds: ['t3-blue-4'],
                    nobleIds: ['noble-2', 'noble-4', 'noble-6', 'noble-9'],
                    points: 17,
                },
            },
        };

        const afterP3 = reduceAll(afterTrigger, SplendorDomain.execute(stateOf(afterTrigger), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '3',
            payload: { colors: ['white'] },
            timestamp: 1,
        }, makeRandom()));
        expect(afterP3.gameResult).toBeUndefined();
        expect(afterP3.currentPlayer).toBe('0');

        const afterP0 = reduceAll(afterP3, SplendorDomain.execute(stateOf(afterP3), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 2,
        }, makeRandom()));
        expect(afterP0.gameResult).toBeUndefined();
        expect(afterP0.currentPlayer).toBe('1');

        const afterP1Setup: SplendorCore = {
            ...afterP0,
            players: {
                ...afterP0.players,
                '1': {
                    ...afterP0.players['1'],
                    purchasedCardIds: ['t3-green-4'],
                    nobleIds: ['noble-1', 'noble-3', 'noble-5', 'noble-7'],
                    points: 17,
                },
            },
        };

        const final = reduceAll(afterP1Setup, SplendorDomain.execute(stateOf(afterP1Setup), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '1',
            payload: { colors: ['white'] },
            timestamp: 3,
        }, makeRandom()));

        expect(final.gameResult).toBeDefined();
    });

    test('tiebreak prefers fewer purchased development cards', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const tieCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t3-white-4'],
                    nobleIds: ['noble-1', 'noble-2', 'noble-3'],
                    points: 14,
                },
                '1': {
                    ...core.players['1'],
                    purchasedCardIds: ['t2-blue-1', 't2-green-1', 't2-red-1', 't2-white-1', 't2-black-1'],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 11,
                },
            },
        };

        const result = computeGameResult(tieCore);
        expect(result.winner).toBe('0');
    });

    test('players share victory when both score and purchased card count are tied', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const sharedCore: SplendorCore = {
            ...core,
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t3-white-4', 't2-white-1'],
                    nobleIds: ['noble-1', 'noble-2'],
                    points: 0,
                },
                '1': {
                    ...core.players['1'],
                    purchasedCardIds: ['t3-blue-4', 't2-blue-1'],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 0,
                },
            },
        };

        const result = computeGameResult(sharedCore);
        expect(result.draw).toBe(true);
        expect(result.winners).toEqual(['0', '1']);
    });

    test('four-player final round can end in shared victory when score and purchased card count are tied', () => {
        const core = SplendorDomain.setup(['0', '1', '2', '3'], makeRandom());
        const finalCore: SplendorCore = {
            ...core,
            currentPlayer: '0',
            round: 2,
            endgame: {
                triggered: true,
                triggerRound: 2,
                triggeredByPlayerId: '1',
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    purchasedCardIds: ['t3-white-4', 't2-white-1'],
                    nobleIds: ['noble-1', 'noble-2'],
                    points: 0,
                },
                '3': {
                    ...core.players['3'],
                    purchasedCardIds: ['t3-blue-4', 't2-blue-1'],
                    nobleIds: ['noble-4', 'noble-5'],
                    points: 0,
                },
            },
        };

        const next = reduceAll(finalCore, SplendorDomain.execute(stateOf(finalCore), {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white'] },
            timestamp: 1,
        }, makeRandom()));

        expect(next.gameResult?.draw).toBe(true);
        expect(next.gameResult?.winners).toEqual(['0', '3']);
    });

    test('action log uses i18n segment for take three gems', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const command: Command = {
            type: 'TAKE_THREE_DIFFERENT_GEMS',
            playerId: '0',
            payload: { colors: ['white', 'blue', 'green'] },
            timestamp: 1,
        };

        const entries = normalizeEntries(formatSplendorActionEntry({
            command,
            state: stateOf(core),
            events: [] as GameEvent[],
        }));

        expect(entries).toHaveLength(1);
        const seg = findI18nSegment(entries[0].segments, 'actionLog.takeThree');
        expect(seg?.ns).toBe('game-splendor');
        expect(seg?.params).toBeUndefined();
        expect(entries[0].segments.some((segment) => segment.type === 'i18n' && (segment as { key: string }).key === 'colors.white')).toBe(true);
        expect(entries[0].segments.some((segment) => segment.type === 'i18n' && (segment as { key: string }).key === 'colors.blue')).toBe(true);
        expect(entries[0].segments.some((segment) => segment.type === 'i18n' && (segment as { key: string }).key === 'colors.green')).toBe(true);
    });

    test('action log uses i18n segment and card segment for reserve open', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const cardId = core.market[1][0];
        const command: Command = {
            type: 'RESERVE_OPEN_CARD',
            playerId: '0',
            payload: { tier: 1, cardId },
            timestamp: 1,
        };

        const entries = normalizeEntries(formatSplendorActionEntry({
            command,
            state: stateOf(core),
            events: [] as GameEvent[],
        }));

        expect(entries).toHaveLength(1);
        const seg = findI18nSegment(entries[0].segments, 'actionLog.reserveOpen');
        expect(seg?.params).toBeUndefined();
        expect(entries[0].segments.some((segment) => segment.type === 'i18n' && (segment as { key: string }).key === 'actionLog.reserveOpenCost')).toBe(true);
        const cardSeg = entries[0].segments.find((segment) => segment.type === 'card') as
            | { type: 'card'; cardId: string; previewText?: string; previewRef?: { type: string; rendererId?: string } }
            | undefined;
        expect(cardSeg?.cardId).toBe(cardId);
        expect(cardSeg?.previewText).toBe(CARD_DEFS_BY_ID[cardId]?.name);
        expect(cardSeg?.previewRef?.type).toBe('renderer');
        expect(cardSeg?.previewRef?.rendererId).toBe('splendor-card-renderer');
    });

    test('action log buy card uses TOKENS_SPENT event payload instead of recomputing from post-buy state', () => {
        const core = startedCore(SplendorDomain.setup(['0', '1'], makeRandom()));
        const cardId = 't2-white-2';
        const setupCore: SplendorCore = {
            ...core,
            market: {
                ...core.market,
                2: [cardId, ...core.market[2].filter((id) => id !== cardId)],
            },
            players: {
                ...core.players,
                '0': {
                    ...core.players['0'],
                    tokens: {
                        white: 2,
                        blue: 3,
                        green: 0,
                        red: 3,
                        black: 0,
                        gold: 0,
                    },
                },
            },
        };

        const command: SplendorCommand = {
            type: 'BUY_OPEN_CARD',
            playerId: '0',
            payload: { tier: 2, cardId },
            timestamp: 1,
        };
        const events = SplendorDomain.execute(stateOf(setupCore), command, makeRandom());
        const nextCore = reduceAll(setupCore, events);
        const entries = normalizeEntries(formatSplendorActionEntry({
            command,
            state: stateOf(nextCore),
            events: events as GameEvent[],
        }));

        expect(entries).toHaveLength(1);
        expect(hasTokenPair(entries[0].segments, 'white', 2)).toBe(true);
        expect(hasTokenPair(entries[0].segments, 'blue', 3)).toBe(true);
        expect(hasTokenPair(entries[0].segments, 'red', 3)).toBe(true);
        expect(entries[0].segments.some((segment) =>
            segment.type === 'i18n' && (segment as { key: string }).key === 'colors.gold')).toBe(false);
        expect(entries[0].segments.some((segment) =>
            segment.type === 'text' && segment.text === '7枚')).toBe(false);
    });

    test('action log uses resolved noble name for choose noble', () => {
        const core = SplendorDomain.setup(['0', '1'], makeRandom());
        const command: Command = {
            type: 'CHOOSE_NOBLE',
            playerId: '0',
            payload: { nobleId: 'noble-1' },
            timestamp: 1,
        };

        const entries = normalizeEntries(formatSplendorActionEntry({
            command,
            state: stateOf(core),
            events: [] as GameEvent[],
        }));

        expect(entries).toHaveLength(1);
        const seg = findI18nSegment(entries[0].segments, 'actionLog.chooseNoble');
        expect(seg?.params).toEqual({ noble: NOBLE_DEFS_BY_ID['noble-1']?.name });
    });

    test('AI 待处理丢弃时只生成 discard 动作', () => {
        const state = createAiState({
            players: {
                '0': { ...createPlayerState('0'), tokens: { white: 3, blue: 3, green: 3, red: 2, black: 0, gold: 0 } },
                '1': createPlayerState('1'),
            },
            pendingResolution: { type: 'discardToLimit', excess: 1 },
        });

        const actions = buildSplendorAiLegalActions({ playerId: '0', state });
        expect(actions.length).toBeGreaterThan(0);
        expect(actions.every((action) => action.kind === 'discard')).toBe(true);
    });

    test('AI 未开局时不生成会被领域层拒绝的行动', () => {
        const state = createAiState({
            hostStarted: false,
            currentPlayer: '0',
        });

        const actions = buildSplendorAiLegalActions({ playerId: '0', state });

        expect(actions).toEqual([]);
    });

    test('AI 存在全局阻塞交互时不应继续生成普通行动', () => {
        const state = createAiState({
            hostStarted: true,
            currentPlayer: '0',
        });
        injectSimpleChoiceBlockingInteraction(state, {
            id: 'splendor-future-choice',
            playerId: '1',
            sourceId: 'splendor-future-choice',
        });

        const actions = buildSplendorAiLegalActions({ playerId: '0', state });

        expect(actions).toEqual([]);
    });

    test('AI 无宝石可拿时仍会预留任意可预留公开牌，避免空动作卡住', () => {
        const state = createAiState({
            bank: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
            market: { 1: ['t1-white-1'], 2: [], 3: [] },
            decks: { 1: [], 2: [], 3: [] },
            players: {
                '0': createPlayerState('0'),
                '1': createPlayerState('1'),
            },
        });

        const actions = buildSplendorAiLegalActions({ playerId: '0', state });

        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: AI_ACTION_KINDS.RESERVE_OPEN,
            commands: [{ type: 'RESERVE_OPEN_CARD', payload: { tier: 1, cardId: 't1-white-1' } }],
        });
    });

    test('AI 只有在买牌、拿宝石、预留都不可用时才生成跳过当前玩家兜底', () => {
        const state = createAiState({
            bank: { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0 },
            market: { 1: [], 2: [], 3: [] },
            decks: { 1: [], 2: [], 3: [] },
            players: {
                '0': {
                    ...createPlayerState('0'),
                    reservedCardIds: ['t1-white-1', 't1-blue-1', 't1-green-1'],
                },
                '1': createPlayerState('1'),
            },
        });

        const actions = buildSplendorAiLegalActions({ playerId: '0', state });
        expect(actions).toHaveLength(1);
        expect(actions[0]).toMatchObject({
            kind: AI_ACTION_KINDS.PASS_TURN,
            commands: [{ type: 'PASS_TURN', payload: {} }],
        });

        const valid = SplendorDomain.validate(state, {
            type: 'PASS_TURN',
            playerId: '0',
            payload: {},
            timestamp: 1,
        });
        const events = SplendorDomain.execute(state, {
            type: 'PASS_TURN',
            playerId: '0',
            payload: {},
            timestamp: 1,
        }, makeRandom());
        const nextCore = reduceAll(state.core, events);

        expect(valid).toEqual({ valid: true });
        expect(nextCore.currentPlayer).toBe('1');
    });

    test('跳过当前玩家兜底在仍有标准动作时会被领域校验拒绝', () => {
        const state = createAiState();

        expect(SplendorDomain.validate(state, {
            type: 'PASS_TURN',
            playerId: '0',
            payload: {},
            timestamp: 1,
        })).toEqual({ valid: false, error: 'standardActionAvailable' });
    });

    test('discard scorer 会把仅存在于 reserved 中的目标颜色算进弃牌偏好', () => {
        const discardScorer = splendorScorers.find((scorer) => scorer.id === 'discard');
        expect(discardScorer).toBeTruthy();

        const state = createAiState({
            market: { 1: [], 2: [], 3: [] },
            decks: { 1: [], 2: [], 3: [] },
            players: {
                '0': {
                    ...createPlayerState('0'),
                    tokens: { white: 1, blue: 1, green: 0, red: 1, black: 8, gold: 0 },
                    reservedCardIds: ['t1-black-3'],
                },
                '1': createPlayerState('1'),
            },
            pendingResolution: { type: 'discardToLimit', excess: 1 },
        });
        const context = createAiDecisionContext(state, 'hard');

        const blackScore = discardScorer?.score(
            context,
            createAiTestAction(AI_ACTION_KINDS.DISCARD, { color: 'black' }),
        );
        const whiteScore = discardScorer?.score(
            context,
            createAiTestAction(AI_ACTION_KINDS.DISCARD, { color: 'white' }),
        );
        const blueScore = discardScorer?.score(
            context,
            createAiTestAction(AI_ACTION_KINDS.DISCARD, { color: 'blue' }),
        );

        expect(blackScore).not.toBeNull();
        expect(whiteScore).not.toBeNull();
        expect(blueScore).not.toBeNull();
        expect((blackScore as { score: number }).score).toBeGreaterThan((whiteScore as { score: number }).score);
        expect((blackScore as { score: number }).score).toBeGreaterThan((blueScore as { score: number }).score);
    });

    test('AI 贵族选择决议不会退化成选第一个动作', async () => {
        const state = createAiState({
            nobleIds: ['noble-3', 'noble-1'],
            players: {
                '0': {
                    ...createPlayerState('0'),
                    purchasedCardIds: ['t1-white-1', 't1-white-2', 't1-blue-1', 't1-blue-2'],
                },
                '1': createPlayerState('1'),
            },
            pendingResolution: { type: 'chooseNoble', nobleIds: ['noble-3', 'noble-1'] },
        });

        const resolution = await resolveNextLocalAiAction({
            engineConfig,
            state,
            matchId: 'local:splendor-choose-noble-alignment',
            seatControllers: {
                '0': { type: 'local-ai', difficulty: 'hard' },
            },
        });

        expect(resolution).not.toBeNull();
        expect(resolution?.action.kind).toBe('choose-noble');
        expect(resolution?.action.metadata?.nobleId).toBe('noble-1');
    });
});
