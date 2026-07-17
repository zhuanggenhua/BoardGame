import { describe, expect, test } from 'vitest';
import { createReplayAdapter } from '../../../engine/adapter';
import { buildShowdownResults, TheGangDomain } from '../domain';
import { engineConfig } from '../game';
import { THE_GANG_COMMANDS, type PlayingCard, type TheGangCommand, type TheGangCore } from '../domain/types';

const stateOf = (core: TheGangCore) => ({
    core,
    sys: {
        schemaVersion: 1,
        undo: { snapshots: [], maxSnapshots: 50 },
        interaction: { queue: [] },
        log: { entries: [], maxEntries: 0 },
        eventStream: { entries: [], maxEntries: 200, nextId: 1 },
        actionLog: { entries: [], maxEntries: 50 },
        rematch: { votes: {}, ready: false },
        responseWindow: {},
        tutorial: { active: false, manifestId: null, stepIndex: 0, steps: [], step: null },
        turnNumber: 0,
        phase: '',
    },
});

const standardCard = (rank: PlayingCard['rank'], suit: PlayingCard['suit']): PlayingCard => ({
    rank,
    suit,
    kind: 'standard',
});

const confirmProgressForAllPlayers = (
    adapter: ReturnType<typeof createReplayAdapter<TheGangCore, TheGangCommand>>,
    state: ReturnType<ReturnType<typeof createReplayAdapter<TheGangCore, TheGangCommand>>['setup']>,
    type:
        | typeof THE_GANG_COMMANDS.END_ROUND
        | typeof THE_GANG_COMMANDS.REVEAL_SHOWDOWN
        | typeof THE_GANG_COMMANDS.CONFIRM_HAND_SWAP
        | typeof THE_GANG_COMMANDS.START_NEXT_HEIST,
    timestamp: number,
) => {
    let nextState = state;
    for (const [index, playerId] of nextState.core.playerIds.entries()) {
        nextState = adapter.execute(nextState, {
            type,
            playerId,
            payload: {},
            timestamp: timestamp + index,
            skipValidation: true,
        }).state;
    }
    return nextState;
};

const startHeist = (
    adapter: ReturnType<typeof createReplayAdapter<TheGangCore, TheGangCommand>>,
    state: ReturnType<ReturnType<typeof createReplayAdapter<TheGangCore, TheGangCommand>>['setup']>,
    timestamp = 0,
) => adapter.execute(state, {
    type: THE_GANG_COMMANDS.START_HEIST,
    playerId: '0',
    payload: {},
    timestamp,
}).state;

describe('The Gang domain flow', () => {
    test('3 人抢劫可以完成四轮并摊牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-flow-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);

        for (const round of [1, 2, 3, 4]) {
            for (const [index, playerId] of state.core.playerIds.entries()) {
                const result = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: index + 1 },
                    timestamp: round * 10 + index,
                    skipValidation: true,
                });
                state = result.state;
            }

            if (round < 4) {
                state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, round * 100);
            }
        }

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 500);

        expect(state.core.phase).toBe('showdown');
        expect(state.core.communityCards).toHaveLength(5);
        expect(state.core.lastShowdown?.results).toHaveLength(3);
        expect(state.core.successes + state.core.failures).toBe(1);
    });

    test('房主开始抢劫前不能拿筹码，开始后才进入正式选筹码', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-start-heist-gate-test');
        let state = adapter.setup(['0', '1', '2']);

        expect(state.core.heistStarted).toBe(false);
        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 1,
        })).toMatchObject({ valid: false, error: 'heistNotStarted' });

        state = startHeist(adapter, state, 2);
        expect(state.core.heistStarted).toBe(true);
        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 3,
        })).toMatchObject({ valid: true });
    });

    test('非本人 playerView 隐藏其他玩家底牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-view-test');
        let state = adapter.setup(['0', '1', '2']);
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;
        const view = TheGangDomain.playerView?.(state.core, '1');

        expect(view?.players?.['1'].pocketCards).toHaveLength(2);
        expect(view?.players?.['1'].secondaryPocketCards).toHaveLength(2);
        expect(view?.players?.['0'].pocketCards).toHaveLength(0);
        expect(view?.players?.['0'].secondaryPocketCards).toHaveLength(0);
        expect(view?.players?.['2'].pocketCards).toHaveLength(0);
        expect(view?.players?.['2'].secondaryPocketCards).toHaveLength(0);
    });

    test('扩展接入后玩家数边界注册为 3-10 人', () => {
        expect(engineConfig.minPlayers).toBe(3);
        expect(engineConfig.maxPlayers).toBe(10);
    });

    test('不改变牌结构的扩展配置不会重新发牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-rules-config-no-redeal-test');
        let state = adapter.setup(['0', '1', '2']);
        const initialPlayers = state.core.players;
        const initialDeck = state.core.deck;

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    ...state.core.rules.config,
                    exitChipMode: 'mastermind',
                    automode: true,
                    challenges: {
                        'retina-scan': 1,
                        'fingerprint-scan': 1,
                        blackout: 1,
                    },
                },
            },
            timestamp: 1,
        }).state;

        expect(state.core.rules.config.exitChipMode).toBe('mastermind');
        expect(state.core.rules.config.automode).toBe(true);
        expect(state.core.rules.config.challenges['retina-scan']).toBe(1);
        expect(state.core.players).toBe(initialPlayers);
        expect(state.core.deck).toBe(initialDeck);
    });

    test('手牌调换开关不会重新发牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-hand-swap-no-redeal-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;

        const twoHandPlayers = state.core.players;
        const twoHandDeck = state.core.deck;

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    ...state.core.rules.config,
                    handSwap: true,
                },
            },
            timestamp: 2,
        }).state;

        expect(state.core.rules.config.twoHand).toBe(true);
        expect(state.core.rules.config.handSwap).toBe(true);
        expect(state.core.players).toBe(twoHandPlayers);
        expect(state.core.deck).toBe(twoHandDeck);
    });

    test('改变牌结构的扩展配置才重新发牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-rules-config-redeal-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'seven-card-stud',
                    challenges: {
                        'security-camera': 1,
                        'foot-door': 1,
                    },
                },
            },
            timestamp: 1,
        }).state;

        expect(state.core.rules.config.gameMode).toBe('seven-card-stud');
        expect(state.core.rules.config.challenges['security-camera']).toBe(1);
        expect(state.core.rules.config.challenges['foot-door']).toBeUndefined();
        expect(state.core.players['0'].pocketCards).toHaveLength(4);
        expect(state.core.players['0'].communityCards).toHaveLength(1);
        expect(state.core.communityCards).toHaveLength(0);
    });

    test('两副手牌和奥马哈会改变起手牌张', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-two-hand-omaha-deal-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    omaha: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;

        expect(state.core.rules.config.twoHand).toBe(true);
        expect(state.core.rules.config.omaha).toBe(true);
        expect(state.core.players['0'].pocketCards).toHaveLength(4);
        expect(state.core.players['0'].secondaryPocketCards).toHaveLength(4);
    });

    test('两副手牌最多 5 人', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-two-hand-player-limit-test');
        const state = adapter.setup(['0', '1', '2', '3', '4', '5']);

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        })).toMatchObject({ valid: false, error: 'twoHandPlayerLimit' });
    });

    test('扩展配置开始抢劫后锁定', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-rules-config-lock-test');
        let state = adapter.setup(['0', '1', '2']);

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 2,
        })).toMatchObject({ valid: false, error: 'heistNotStarted' });

        state = startHeist(adapter, state, 2);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 3,
        }).state;

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: { config: { gameMode: 'texas-holdem', challenges: {} } },
            timestamp: 4,
        })).toMatchObject({ valid: false, error: 'rulesLocked' });
    });

    test('自动模式在所有人拿完筹码后直接推进', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-automode-progress-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    ...state.core.rules.config,
                    automode: true,
                },
            },
            timestamp: 1,
        }).state;
        state = startHeist(adapter, state, 2);

        for (const [index, playerId] of state.core.playerIds.entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: 10 + index,
            }).state;
        }

        expect(state.core.round).toBe(2);
        expect(state.core.communityCards).toHaveLength(3);
        expect(state.core.currentRoundChips).toEqual({});
        expect(state.core.roundHistory).toHaveLength(1);
    });

    test('工具牌会按玩家发放且不能重复发放', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-tools-deal-test');
        let state = adapter.setup(['0', '1', '2']);
        const initialToolDeck = [...state.core.toolDeck];

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.DEAL_TOOLS,
            playerId: '0',
            payload: {},
            timestamp: 1,
        }).state;

        expect(state.core.players['0'].toolCards).toEqual([initialToolDeck[0]]);
        expect(state.core.players['1'].toolCards).toEqual([initialToolDeck[1]]);
        expect(state.core.players['2'].toolCards).toEqual([initialToolDeck[2]]);
        expect(state.core.toolDeck).toEqual(initialToolDeck.slice(3));
        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.DEAL_TOOLS,
            playerId: '0',
            payload: {},
            timestamp: 2,
        })).toMatchObject({ valid: false, error: 'toolsAlreadyDealt' });
    });

    test('一次性手机弃掉工具牌并抽取 2 张专家牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-burner-phone-test');
        let state = adapter.setup(['0', '1', '2']);
        const specialistDeck = [...state.core.specialistDeck];
        state = stateOf({
            ...state.core,
            players: {
                ...state.core.players,
                '0': {
                    ...state.core.players['0'],
                    toolCards: ['burner-phone'],
                },
            },
        });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.USE_TOOL,
            playerId: '0',
            payload: { tool: 'burner-phone' },
            timestamp: 1,
        }).state;

        expect(state.core.players['0'].toolCards).toEqual([]);
        expect(state.core.players['0'].activeTools).toContain('burner-phone');
        expect(state.core.players['0'].specialistCards).toEqual(specialistDeck.slice(0, 2));
        expect(state.core.specialistDeck).toEqual(specialistDeck.slice(2));
        expect(state.core.toolDiscardPile).toEqual(['burner-phone']);
    });

    test('手电筒翻出第一张非鬼牌并把跳过的鬼牌弃掉', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-flashlight-test');
        let state = adapter.setup(['0', '1', '2']);
        const joker = { suit: 'special', rank: 'Joker', kind: 'joker' } as const;
        const visibleCard = { suit: 'hearts', rank: 'A', kind: 'standard' } as const;
        const remainingCard = { suit: 'clubs', rank: '2', kind: 'standard' } as const;
        state = stateOf({
            ...state.core,
            deck: [joker, visibleCard, remainingCard],
            players: {
                ...state.core.players,
                '0': {
                    ...state.core.players['0'],
                    toolCards: ['flashlight'],
                },
            },
        });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.USE_TOOL,
            playerId: '0',
            payload: { tool: 'flashlight' },
            timestamp: 1,
        }).state;

        expect(state.core.players['0'].toolCards).toEqual([]);
        expect(state.core.players['0'].activeTools).toContain('flashlight');
        expect(state.core.players['0'].flashlightCards).toEqual([visibleCard]);
        expect(state.core.deck).toEqual([remainingCard]);
        expect(state.core.discardPile).toEqual([joker]);
        expect(state.core.toolDiscardPile).toEqual(['flashlight']);
    });

    test('夜视眼镜把一张手牌移到工具区但摊牌仍计入手牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-night-vision-test');
        let state = adapter.setup(['0', '1', '2']);
        const movedCard = state.core.players['0'].pocketCards[0];
        state = stateOf({
            ...state.core,
            communityCards: [
                { suit: 'spades', rank: 'A', kind: 'standard' },
                { suit: 'hearts', rank: 'K', kind: 'standard' },
                { suit: 'diamonds', rank: 'Q', kind: 'standard' },
                { suit: 'clubs', rank: 'J', kind: 'standard' },
                { suit: 'spades', rank: '10', kind: 'standard' },
            ],
            currentRoundChips: { '0': 1, '1': 2, '2': 3 },
            players: {
                ...state.core.players,
                '0': {
                    ...state.core.players['0'],
                    toolCards: ['night-vision-goggles'],
                },
            },
        });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.USE_TOOL,
            playerId: '0',
            payload: { tool: 'night-vision-goggles', cardIndex: 0 },
            timestamp: 1,
        }).state;

        expect(state.core.players['0'].toolCards).toEqual([]);
        expect(state.core.players['0'].activeTools).toContain('night-vision-goggles');
        expect(state.core.players['0'].pocketCards).not.toContainEqual(movedCard);
        expect(state.core.players['0'].nightVisionCards).toEqual([movedCard]);
        expect(state.core.toolDiscardPile).toEqual(['night-vision-goggles']);

        const result = buildShowdownResults(state.core).find((player) => player.playerId === '0');
        expect(result?.pocketCards).toContainEqual(movedCard);
    });

    test('两副手牌摊牌时分别评估并使用更强的一手', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-two-hand-showdown-test');
        let state = adapter.setup(['0', '1', '2']);

        state = stateOf({
            ...state.core,
            rules: {
                ...state.core.rules,
                config: {
                    ...state.core.rules.config,
                    twoHand: true,
                },
            },
            communityCards: [
                standardCard('2', 'clubs'),
                standardCard('7', 'diamonds'),
                standardCard('9', 'hearts'),
                standardCard('J', 'clubs'),
                standardCard('K', 'diamonds'),
            ],
            currentRoundChips: { '0': 3, '1': 2, '2': 1 },
            players: {
                ...state.core.players,
                '0': {
                    ...state.core.players['0'],
                    pocketCards: [standardCard('3', 'spades'), standardCard('4', 'hearts')],
                    secondaryPocketCards: [standardCard('A', 'spades'), standardCard('A', 'hearts')],
                },
                '1': {
                    ...state.core.players['1'],
                    pocketCards: [standardCard('Q', 'spades'), standardCard('Q', 'hearts')],
                    secondaryPocketCards: [standardCard('5', 'spades'), standardCard('6', 'hearts')],
                },
                '2': {
                    ...state.core.players['2'],
                    pocketCards: [standardCard('5', 'clubs'), standardCard('6', 'clubs')],
                    secondaryPocketCards: [standardCard('8', 'clubs'), standardCard('10', 'clubs')],
                },
            },
        });

        const result = buildShowdownResults(state.core).find((player) => player.playerId === '0');

        expect(result?.winningHandSlot).toBe('bottom');
        expect(result?.secondaryPocketCards).toHaveLength(2);
        expect(result?.strength.code).toBe('1p');
        expect(result?.strength.ranks[0]).toBe(14);
    });

    test('两副手牌投票完先进入调换阶段，确认后才推进下一轮', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-hand-swap-round-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    handSwap: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;
        state = startHeist(adapter, state, 2);

        const topCard = state.core.players['0'].pocketCards[0];
        const bottomCard = state.core.players['0'].secondaryPocketCards?.[1];
        expect(bottomCard).toBeDefined();

        for (const [index, playerId] of state.core.playerIds.entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: 10 + index,
            }).state;
        }

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, 20);

        expect(state.core.phase).toBe('hand-swap');
        expect(state.core.round).toBe(1);
        expect(state.core.communityCards).toHaveLength(0);
        expect(state.core.pendingProgress).toBeUndefined();

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.CONFIRM_HAND_SWAP,
            playerId: '0',
            payload: { topIndex: 0, bottomIndex: 1 },
            timestamp: 30,
        }).state;

        expect(state.core.players['0'].pocketCards[0]).toEqual(bottomCard);
        expect(state.core.players['0'].secondaryPocketCards?.[1]).toEqual(topCard);
        expect(state.core.pendingProgress).toEqual({ kind: 'hand-swap', approvals: ['0'] });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.CONFIRM_HAND_SWAP,
            playerId: '1',
            payload: {},
            timestamp: 31,
        }).state;
        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.CONFIRM_HAND_SWAP,
            playerId: '2',
            payload: {},
            timestamp: 32,
        }).state;

        expect(state.core.phase).toBe('chip-selection');
        expect(state.core.round).toBe(2);
        expect(state.core.communityCards).toHaveLength(3);
        expect(state.core.currentRoundChips).toEqual({});
        expect(state.core.pendingProgress).toBeUndefined();
    });

    test('两副手牌最终轮调换确认后才摊牌', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-hand-swap-showdown-test');
        let state = adapter.setup(['0', '1', '2']);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.SET_RULES_CONFIG,
            playerId: '0',
            payload: {
                config: {
                    gameMode: 'texas-holdem',
                    twoHand: true,
                    handSwap: true,
                    challenges: {},
                },
            },
            timestamp: 1,
        }).state;
        state = startHeist(adapter, state, 2);

        for (const round of [1, 2, 3, 4]) {
            for (const [index, playerId] of state.core.playerIds.entries()) {
                state = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: index + 1 },
                    timestamp: round * 10 + index,
                    skipValidation: true,
                }).state;
            }

            if (round < 4) {
                state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, round * 100);
                expect(state.core.phase).toBe('hand-swap');
                state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.CONFIRM_HAND_SWAP, round * 100 + 10);
                expect(state.core.phase).toBe('chip-selection');
            }
        }

        expect(state.core.round).toBe(4);
        expect(state.core.communityCards).toHaveLength(5);

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 500);
        expect(state.core.phase).toBe('hand-swap');
        expect(state.core.lastShowdown).toBeUndefined();

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.CONFIRM_HAND_SWAP, 510);
        expect(state.core.phase).toBe('showdown');
        expect(state.core.lastShowdown).toBeDefined();
    });

    test('当前轮可以拿别人面前的筹码，原持有人失去该筹码，且失去筹码的人还能再拿', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-validation-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 1 },
            timestamp: 1,
            skipValidation: true,
        }).state;

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 1 },
            timestamp: 2,
        })).toMatchObject({ valid: true });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 1 },
            timestamp: 2,
        }).state;

        expect(state.core.currentRoundChips).toEqual({ '1': 1 });

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 3,
        })).toMatchObject({ valid: false, error: 'missingChips' });

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 2 },
            timestamp: 4,
        })).toMatchObject({ valid: true });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 2 },
            timestamp: 4,
        }).state;
        expect(state.core.currentRoundChips).toEqual({ '1': 1, '0': 2 });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '2',
            payload: { chip: 3 },
            timestamp: 5,
        }).state;

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 6,
        })).toMatchObject({ valid: true });

        expect(TheGangDomain.validate(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: { chip: 1 },
            timestamp: 7,
        })).toMatchObject({ valid: false, error: 'chipAlreadyHeld' });
    });

    test('教程 AI 补筹码只拿剩余筹码，不会顶掉真人当前筹码', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-tutorial-chip-fill-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '0',
            payload: { chip: 2 },
            timestamp: 1,
            skipValidation: true,
        }).state;

        for (const [index, playerId] of ['1', '2'].entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: {
                    chip: 1,
                    tutorialChipMode: 'lowest-unoccupied',
                    tutorialOnlyIfMissing: true,
                },
                timestamp: 2 + index,
                skipValidation: true,
            }).state;
        }

        expect(state.core.currentRoundChips).toEqual({ '0': 2, '1': 1, '2': 3 });

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.TAKE_CHIP,
            playerId: '1',
            payload: {
                chip: 1,
                tutorialChipMode: 'lowest-unoccupied',
                tutorialOnlyIfMissing: true,
            },
            timestamp: 4,
            skipValidation: true,
        }).state;

        expect(state.core.currentRoundChips).toEqual({ '0': 2, '1': 1, '2': 3 });
    });

    test('推进轮次、摊牌和下一次抢劫都必须等待全员确认', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-progress-confirmation-test');
        let state = adapter.setup(['0', '1', '2']);
        state = startHeist(adapter, state);

        for (const [index, playerId] of state.core.playerIds.entries()) {
            state = adapter.execute(state, {
                type: THE_GANG_COMMANDS.TAKE_CHIP,
                playerId,
                payload: { chip: index + 1 },
                timestamp: index,
            }).state;
        }

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.END_ROUND,
            playerId: '0',
            payload: {},
            timestamp: 10,
        }).state;
        expect(state.core.round).toBe(1);
        expect(state.core.communityCards).toHaveLength(0);
        expect(state.core.pendingProgress).toEqual({ kind: 'end-round', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, 20);
        expect(state.core.round).toBe(2);
        expect(state.core.communityCards).toHaveLength(3);
        expect(state.core.pendingProgress).toBeUndefined();

        for (const round of [2, 3, 4]) {
            for (const [index, playerId] of state.core.playerIds.entries()) {
                state = adapter.execute(state, {
                    type: THE_GANG_COMMANDS.TAKE_CHIP,
                    playerId,
                    payload: { chip: index + 1 },
                    timestamp: round * 10 + index,
                }).state;
            }
            if (round < 4) {
                state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.END_ROUND, round * 100);
            }
        }

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.REVEAL_SHOWDOWN,
            playerId: '0',
            payload: {},
            timestamp: 500,
        }).state;
        expect(state.core.phase).toBe('chip-selection');
        expect(state.core.lastShowdown).toBeUndefined();
        expect(state.core.pendingProgress).toEqual({ kind: 'reveal-showdown', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.REVEAL_SHOWDOWN, 510);
        expect(state.core.phase).toBe('showdown');
        expect(state.core.lastShowdown).toBeDefined();
        expect(state.core.pendingProgress).toBeUndefined();

        state = adapter.execute(state, {
            type: THE_GANG_COMMANDS.START_NEXT_HEIST,
            playerId: '0',
            payload: {},
            timestamp: 600,
        }).state;
        expect(state.core.phase).toBe('showdown');
        expect(state.core.heistNumber).toBe(1);
        expect(state.core.pendingProgress).toEqual({ kind: 'start-next-heist', approvals: ['0'] });

        state = confirmProgressForAllPlayers(adapter, state, THE_GANG_COMMANDS.START_NEXT_HEIST, 610);
        expect(state.core.phase).toBe('chip-selection');
        expect(state.core.heistNumber).toBe(2);
        expect(state.core.heistStarted).toBe(false);
        expect(state.core.pendingProgress).toBeUndefined();
    });

    test('游戏结束后拒绝继续执行抢劫命令', () => {
        const adapter = createReplayAdapter(TheGangDomain, 'the-gang-gameover-test');
        const state = adapter.setup(['0', '1', '2']);
        const gameOverState = stateOf({
            ...state.core,
            phase: 'game-over',
            gameResult: { winners: ['0', '1', '2'] },
        });

        expect(TheGangDomain.validate(gameOverState, {
            type: THE_GANG_COMMANDS.START_NEXT_HEIST,
            playerId: '0',
            payload: {},
            timestamp: 1,
        })).toMatchObject({ valid: false, error: 'gameOver' });
    });
});
