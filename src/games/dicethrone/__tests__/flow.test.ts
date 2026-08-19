/**
 * 王权骰铸（DiceThrone）流程测试
 *
 * 重构说明：
 * - 所有共享工具函数（fixedRandom/cmd/createRunner 等）统一从 test-utils 导入
 * - errorAtStep → expectError（按命令类型匹配，不依赖步骤索引）
 * - 手动 ADVANCE_PHASE 序列 → advanceTo() helper
 */

import { describe, it, expect } from 'vitest';
import { DiceThroneDomain } from '../domain';
import { execute as executeDomainCommand } from '../domain/execute';
import { DICETHRONE_CHARACTER_CATALOG, type DiceThroneCore, type DiceThroneCommand, type DiceThroneEvent, type TurnPhase } from '../domain/types';
import { CP_MAX, HAND_LIMIT, INITIAL_CP, INITIAL_HEALTH } from '../domain/types';
import { STATUS_IDS, TOKEN_IDS, DICETHRONE_COMMANDS, DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';
import { RESOURCE_IDS } from '../domain/resources';
import { resolveEffectsToEvents, type EffectContext } from '../domain/effects';
import { executeCardCommand } from '../domain/executeCards';
import { getLeftOpponentId, getResponderQueue, getRightOpponentId, getTeamIdByPlayerIdMap } from '../domain/rules';
import { buildAfterRollConfirmedSignature } from '../domain/responseWindowGuards';
import { playerView } from '../domain/view';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { SHADOW_FANG_2 } from '../heroes/ninja/abilities';
import type { AbilityEffect } from '../domain/combat';
import { createSimpleChoice } from '../../../engine/systems/InteractionSystem';
import { GameTestRunner, type TestCase } from '../../../engine/testing';
import { getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, PlayerId, RandomFn } from '../../../engine/types';
import type { EngineSystem } from '../../../engine/systems/types';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { initHeroState } from '../domain/characters';

import {
    fixedRandom,
    createQueuedRandom,
    cmd,
    testSystems,
    createRunner,
    createInitializedState,
    createHeroMatchup,
    createSetupWithHand,
    createNoResponseSetup,
    getCardInteractionPrompt,
    getDefenderChoicePrompt,
    getSimpleChoicePrompt,
    getMultistepChoicePrompt,
    getCardById,
    assertState,
    advanceTo,
    expectedHandSize,
    expectedDeckAfterDraw4,
    expectedIncomeCp,
    fistAttackAbilityId,
    cancelPromptCommand,
    injectPendingInteraction,
    injectSimpleChoicePrompt,
    respondToPrompt,
    respondToPromptWithSystems,
    type DiceThroneExpectation,
    type CommandInput,
} from './test-utils';

// ============================================================================
// flow.test.ts 专用工具（不在 test-utils 中）
// ============================================================================

function createInitializedStateWithCharacters(
    playerIds: PlayerId[],
    random: RandomFn,
    characters: Record<PlayerId, string>
): MatchState<DiceThroneCore> {
    const pipelineConfig = {
        domain: DiceThroneDomain,
        systems: testSystems,
    };

    let state: MatchState<DiceThroneCore> = {
        core: DiceThroneDomain.setup(playerIds, random),
        sys: createInitialSystemState(playerIds, testSystems, undefined),
    };

    const allCharacterIds = DICETHRONE_CHARACTER_CATALOG.map((item) => item.id);
    const usedCharacterIds = new Set<string>();
    const setupCharacters: Record<PlayerId, string> = {} as Record<PlayerId, string>;

    for (const playerId of playerIds) {
        const desiredCharacterId = characters[playerId] ?? 'monk';
        if (!usedCharacterIds.has(desiredCharacterId)) {
            setupCharacters[playerId] = desiredCharacterId;
            usedCharacterIds.add(desiredCharacterId);
            continue;
        }

        const fallbackCharacterId = allCharacterIds.find((id) => !usedCharacterIds.has(id)) ?? desiredCharacterId;
        setupCharacters[playerId] = fallbackCharacterId;
        usedCharacterIds.add(fallbackCharacterId);
    }

    const commands: CommandInput[] = [
        ...playerIds.map((playerId) => cmd('SELECT_CHARACTER', playerId, { characterId: setupCharacters[playerId] })),
        ...playerIds
            .filter((playerId) => playerId !== playerIds[0])
            .map((playerId) => cmd('PLAYER_READY', playerId)),
        cmd('HOST_START_GAME', playerIds[0]),
    ];

    for (const input of commands) {
        const command = {
            type: input.type,
            playerId: input.playerId,
            payload: input.payload,
            timestamp: Date.now(),
        } as DiceThroneCommand;
        const result = executePipeline(pipelineConfig, state, command, random, playerIds);
        if (result.success) {
            state = result.state as MatchState<DiceThroneCore>;
        }
    }

    for (const playerId of playerIds) {
        const desiredCharacterId = characters[playerId];
        if (!desiredCharacterId) continue;
        if (state.core.selectedCharacters[playerId] === desiredCharacterId) continue;
        state.core.selectedCharacters[playerId] = desiredCharacterId as any;
        state.core.players[playerId] = initHeroState(playerId, desiredCharacterId as any, random);
    }

    return state;
}

function createDefenderChoiceInteraction(args: {
    id: string;
    playerId: PlayerId;
    attackerId?: PlayerId;
    sourceAbilityId?: string;
    targetRollValue?: number;
    titleKey?: string;
    options: Array<{ playerId: PlayerId; customId: string; disabled?: boolean }>;
    allowedCommands?: string[];
}) {
    return {
        id: args.id,
        kind: 'dt:defender-choice',
        playerId: args.playerId,
        data: {
            attackerId: args.attackerId ?? '0',
            chooserPlayerId: args.playerId,
            sourceAbilityId: args.sourceAbilityId ?? 'targeting-roll',
            sourceId: args.sourceAbilityId ?? 'targeting-roll',
            titleKey: args.titleKey ?? '选择本次攻击目标',
            targetRollValue: args.targetRollValue ?? 6,
            options: args.options,
            allowedCommands: args.allowedCommands,
        },
    } as any;
}

const MONK_MIRROR_CHARACTERS = {
    '0': 'monk',
    '1': 'monk',
} as const;

function createMonkMirrorInitializedState(
    playerIds: PlayerId[],
    random: RandomFn
): MatchState<DiceThroneCore> {
    return createInitializedStateWithCharacters(
        playerIds,
        random,
        MONK_MIRROR_CHARACTERS as unknown as Record<PlayerId, string>
    );
}

function createMonkMirrorSetupWithHand(
    handCardIds: string[],
    options: { playerId?: PlayerId; cp?: number; mutate?: (core: DiceThroneCore) => void } = {}
) {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createMonkMirrorInitializedState(playerIds, random);
        const pid = options.playerId ?? '0';
        const player = state.core.players[pid];
        if (player) {
            player.hand = handCardIds.map(getCardById);
            player.deck = player.deck.filter((card) => !handCardIds.includes(card.id));
            if (options.cp !== undefined) {
                player.resources[RESOURCE_IDS.CP] = options.cp;
            }
        }
        options.mutate?.(state.core);
        return state;
    };
}

function createMonkMirrorNoResponseSetup() {
    return (playerIds: PlayerId[], random: RandomFn): MatchState<DiceThroneCore> => {
        const state = createMonkMirrorInitializedState(playerIds, random);

        for (const pid of playerIds) {
            const player = state.core.players[pid];
            if (!player) continue;

            const handRespondable = player.hand.filter((card) => card.timing === 'instant' || card.timing === 'roll');
            const handNonRespondable = player.hand.filter((card) => card.timing !== 'instant' && card.timing !== 'roll');
            const deckRespondable = player.deck.filter((card) => card.timing === 'instant' || card.timing === 'roll');
            const deckNonRespondable = player.deck.filter((card) => card.timing !== 'instant' && card.timing !== 'roll');

            player.deck = [...deckNonRespondable, ...handRespondable, ...deckRespondable];
            player.hand = handNonRespondable;

            while (player.hand.length < 4 && player.deck.length > 0) {
                const card = player.deck.shift();
                if (card) player.hand.push(card);
            }
        }

        return state;
    };
}

// ============================================================================
// 测试用例
// ============================================================================

const baseTestCases: TestCase<DiceThroneExpectation>[] = [
    {
        name: '初始设置：体力/CP/手牌数量',
        commands: [],
        expect: {
            turnPhase: 'main1',
            turnNumber: 1,
            activePlayerId: '0',
            players: {
                '0': {
                    hp: INITIAL_HEALTH,
                    cp: INITIAL_CP,
                    handSize: expectedHandSize,
                    deckSize: expectedDeckAfterDraw4,
                },
                '1': {
                    hp: INITIAL_HEALTH,
                    cp: INITIAL_CP,
                    handSize: expectedHandSize,
                    deckSize: expectedDeckAfterDraw4,
                },
            },
        },
    },
    {
        name: '交互未确认不可推进阶段',
        setup: (playerIds, random) => {
            const state = createInitializedState(playerIds, random);
            const pendingInteraction = {
                id: 'test-interaction',
                playerId: '0' as string,
                sourceCardId: 'card-test',
                type: 'modifyDie' as const,
                titleKey: 'interaction.selectDieToChange',
                selectCount: 1,
                selected: [] as string[],
                dieModifyConfig: { mode: 'any' as const },
            };
            injectPendingInteraction(state, pendingInteraction);
            return state;
        },
        commands: [
            { type: 'ADVANCE_PHASE', playerId: '0', payload: {} },
        ],
        expect: {
            expectError: { command: 'ADVANCE_PHASE', error: '请先完成当前交互' },
            turnPhase: 'offensiveRoll',
            pendingInteraction: { type: 'modifyDie', selectCount: 1, playerId: '0', dieModifyMode: 'any' },
        },
    },
    {
        name: '进入防御阶段后掷骰配置正确',
        setup: createMonkMirrorInitializedState,
        commands: [
            ...advanceTo('offensiveRoll'),
            cmd('ROLL_DICE', '0'),
            cmd('CONFIRM_ROLL', '0'),
            cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
            cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
        ],
        expect: {
            turnPhase: 'defensiveRoll',
            roll: { count: 0, limit: 1, diceCount: 4, confirmed: false },
            pendingAttack: {
                attackerId: '0',
                defenderId: '1',
                isDefendable: true,
                sourceAbilityId: fistAttackAbilityId,
            },
            availableAbilityIdsIncludes: ['meditation'],
        },
    },
    {
        name: '先手首回合跳过收入阶段（自动推进）',
        commands: [],
        expect: {
            turnPhase: 'main1',
            players: {
                '0': {
                    cp: INITIAL_CP,
                    handSize: expectedHandSize,
                },
            },
        },
    },
    {
        name: '非先手收入阶段获得1CP与1张牌',
        commands: [
            ...advanceTo('discard'),
            cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (换人，自动推进到 main1)
        ],
        expect: {
            turnPhase: 'main1',
            activePlayerId: '1',
            turnNumber: 2,
            players: {
                '1': {
                    cp: expectedIncomeCp,
                    handSize: expectedHandSize + 1,
                    deckSize: expectedDeckAfterDraw4 - 1,
                },
            },
        },
    },
    {
        name: '掷骰次数上限为3',
        commands: [
            ...advanceTo('offensiveRoll'),
            cmd('ROLL_DICE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('ROLL_DICE', '0'),
            cmd('ROLL_DICE', '0'), // 超过上限
        ],
        expect: {
            expectError: { command: 'ROLL_DICE', error: 'roll_limit_reached' },
            turnPhase: 'offensiveRoll',
            roll: { count: 3, limit: 3, diceCount: 5, confirmed: false },
        },
    },
    {
        name: '弃牌阶段手牌超限不可推进',
        commands: [
            cmd('DRAW_CARD', '0'),
            cmd('DRAW_CARD', '0'),
            cmd('DRAW_CARD', '0'), // 手牌 7 (>6)
            ...advanceTo('discard'),
            cmd('ADVANCE_PHASE', '0'), // discard -> 应被阻止
        ],
        expect: {
            expectError: { command: 'ADVANCE_PHASE', error: 'cannot_advance_phase' },
            turnPhase: 'discard',
            players: {
                '0': {
                    handSize: HAND_LIMIT + 1,
                },
            },
        },
    },
    {
        name: '升级差价：II -> III 仅支付 CP 差价',
        commands: [
            cmd('DRAW_CARD', '0'), // deep-thought
            cmd('DRAW_CARD', '0'), // deep-thought
            cmd('DRAW_CARD', '0'), // buddha-light
            cmd('DRAW_CARD', '0'), // buddha-light
            cmd('DRAW_CARD', '0'), // palm-strike
            cmd('DRAW_CARD', '0'), // palm-strike
            cmd('DRAW_CARD', '0'), // meditation-3
            cmd('DRAW_CARD', '0'), // meditation-2
            // 先升到 II（花费 2 CP）
            cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
            // 卖一张牌获得 1 CP，用于支付 II->III 差价（3-2=1）
            cmd('SELL_CARD', '0', { cardId: 'card-inner-peace' }),
            // 再升到 III：应只扣 1 CP
            cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }),
        ],
        expect: {
            turnPhase: 'main1',
            players: {
                '0': {
                    cp: 0,
                    abilityLevels: { meditation: 3 },
                },
            },
        },
    },
];

// ============================================================================
// 运行测试
// ============================================================================

describe('王权骰铸流程测试', () => {
    describe('基础测试', () => {
        const runner = createRunner(fixedRandom);
        it.each(baseTestCases)('$name', (testCase) => {
            const result = runner.run(testCase);
            expect(result.assertionErrors).toEqual([]);
        });

        it('选角准备后自动进入 main1 阶段（upkeep/income 自动推进）', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const commands = [
                cmd('SELECT_CHARACTER', '0', { characterId: 'monk' }),
                cmd('SELECT_CHARACTER', '1', { characterId: 'barbarian' }),
                cmd('PLAYER_READY', '1'),
                cmd('HOST_START_GAME', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.core.hostStarted).toBe(true);
            expect(state.sys.phase).toBe('main1');
        });

        it('4 人开局会初始化 2v2 团队状态并按敌我交替顺序轮转回合', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createNoResponseSetup()(playerIds, fixedRandom);

            expect(state.core.seatingOrder).toEqual(['0', '1', '2', '3']);
            expect(state.core.teamIdByPlayerId).toEqual({
                '0': 'A',
                '1': 'B',
                '2': 'A',
                '3': 'B',
            });
            expect(state.core.teamHealth).toEqual({ A: INITIAL_HEALTH, B: INITIAL_HEALTH });

            const activePlayerSequence: PlayerId[] = [state.core.activePlayerId];
            const turnAdvanceCommands: CommandInput[] = [
                ...advanceTo('discard', '0'),
                cmd('ADVANCE_PHASE', '0'),
                ...advanceTo('discard', '1'),
                cmd('ADVANCE_PHASE', '1'),
                ...advanceTo('discard', '2'),
                cmd('ADVANCE_PHASE', '2'),
            ];

            for (const input of turnAdvanceCommands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
                if (input.type === 'ADVANCE_PHASE' && state.sys.phase === 'main1') {
                    activePlayerSequence.push(state.core.activePlayerId);
                }
            }

            expect(activePlayerSequence).toEqual(['0', '1', '2', '3']);
        });

        it('4 人 setup 阶段允许房主调整站位并同步更新分队与左右对手', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const moveSeatCommand = {
                type: 'MOVE_SEAT',
                playerId: '0',
                payload: {
                    playerId: '0',
                    targetSeatIndex: 2,
                },
                timestamp: Date.now(),
            } as DiceThroneCommand;

            const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
            expect(result.success).toBe(true);
            state = result.state as MatchState<DiceThroneCore>;

            expect(state.core.seatingOrder).toEqual(['1', '2', '0', '3']);
            expect(getTeamIdByPlayerIdMap(state.core)).toEqual({
                '0': 'A',
                '1': 'A',
                '2': 'B',
                '3': 'B',
            });
            expect(getLeftOpponentId(state.core, '0')).toBe('2');
            expect(getRightOpponentId(state.core, '0')).toBe('3');
        });

        it('4 人 setup 阶段禁止非房主调整站位', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const moveSeatCommand = {
                type: 'MOVE_SEAT',
                playerId: '1',
                payload: {
                    playerId: '0',
                    targetSeatIndex: 2,
                },
                timestamp: Date.now(),
            } as DiceThroneCommand;

            const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
            expect(result.success).toBe(false);
            expect(result.error).toBe('player_mismatch');
        });

        it('4 人 setup 阶段禁止移动到当前位置', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const moveSeatCommand = {
                type: 'MOVE_SEAT',
                playerId: '0',
                payload: {
                    playerId: '2',
                    targetSeatIndex: 2,
                },
                timestamp: Date.now(),
            } as DiceThroneCommand;

            const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
            expect(result.success).toBe(false);
            expect(result.error).toBe('seat_not_changed');
        });

        it('4 人 setup 阶段点到 AI 头像会直接交换座位', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom, {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'human' },
                        '2': { type: 'local-ai' },
                        '3': { type: 'human' },
                    },
                }),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'REQUEST_SEAT_SWAP',
                    playerId: '1',
                    payload: { targetPlayerId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(result.success).toBe(true);
            const nextState = result.state as MatchState<DiceThroneCore>;
            expect(nextState.core.seatingOrder).toEqual(['0', '2', '1', '3']);
            expect(nextState.core.seatSwapRequest).toBeUndefined();
            expect(getTeamIdByPlayerIdMap(nextState.core)).toEqual({
                '0': 'A',
                '1': 'A',
                '2': 'B',
                '3': 'B',
            });
        });

        it('4 人 setup 阶段点到真人头像会写入待审批换位申请', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'REQUEST_SEAT_SWAP',
                    playerId: '1',
                    payload: { targetPlayerId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(result.success).toBe(true);
            const nextState = result.state as MatchState<DiceThroneCore>;
            expect(nextState.core.seatingOrder).toEqual(['0', '1', '2', '3']);
            expect(nextState.core.seatSwapRequest).toEqual({
                requesterId: '1',
                targetPlayerId: '2',
            });
        });

        it('4 人 setup 阶段真人批准换位后会交换座位并清空申请', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const requestResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'REQUEST_SEAT_SWAP',
                    playerId: '1',
                    payload: { targetPlayerId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(requestResult.success).toBe(true);
            state = requestResult.state as MatchState<DiceThroneCore>;

            const approveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESPOND_SEAT_SWAP',
                    playerId: '2',
                    payload: { approve: true },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(approveResult.success).toBe(true);
            const nextState = approveResult.state as MatchState<DiceThroneCore>;
            expect(nextState.core.seatingOrder).toEqual(['0', '2', '1', '3']);
            expect(nextState.core.seatSwapRequest).toBeUndefined();
        });

        it('4 人 setup 阶段真人拒绝或请求者取消后仅清空申请，不改变座位', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const requestResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'REQUEST_SEAT_SWAP',
                    playerId: '1',
                    payload: { targetPlayerId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(requestResult.success).toBe(true);
            state = requestResult.state as MatchState<DiceThroneCore>;

            const rejectResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESPOND_SEAT_SWAP',
                    playerId: '2',
                    payload: { approve: false },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(rejectResult.success).toBe(true);
            const rejectedState = rejectResult.state as MatchState<DiceThroneCore>;
            expect(rejectedState.core.seatingOrder).toEqual(['0', '1', '2', '3']);
            expect(rejectedState.core.seatSwapRequest).toBeUndefined();

            const secondRequestResult = executePipeline(
                pipelineConfig,
                rejectedState,
                {
                    type: 'REQUEST_SEAT_SWAP',
                    playerId: '1',
                    payload: { targetPlayerId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(secondRequestResult.success).toBe(true);

            const cancelResult = executePipeline(
                pipelineConfig,
                secondRequestResult.state as MatchState<DiceThroneCore>,
                {
                    type: 'CANCEL_SEAT_SWAP',
                    playerId: '1',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(cancelResult.success).toBe(true);
            const cancelledState = cancelResult.state as MatchState<DiceThroneCore>;
            expect(cancelledState.core.seatingOrder).toEqual(['0', '1', '2', '3']);
            expect(cancelledState.core.seatSwapRequest).toBeUndefined();
        });

        it('4 人 setup 阶段有待处理换位申请时禁止房主开始游戏', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state: MatchState<DiceThroneCore> = {
                core: DiceThroneDomain.setup(playerIds, fixedRandom),
                sys: createInitialSystemState(playerIds, testSystems, undefined),
            };

            const requestResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'REQUEST_SEAT_SWAP',
                    playerId: '1',
                    payload: { targetPlayerId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(requestResult.success).toBe(true);
            state = requestResult.state as MatchState<DiceThroneCore>;

            const startResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'HOST_START_GAME',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(startResult.success).toBe(false);
            expect(startResult.error).toBe('seat_swap_request_pending');
        });

        it('4 人对局开始后锁定站位', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'pyromancer',
                '3': 'paladin',
            });

            const moveSeatCommand = {
                type: 'MOVE_SEAT',
                playerId: '0',
                payload: {
                    playerId: '0',
                    targetSeatIndex: 3,
                },
                timestamp: Date.now(),
            } as DiceThroneCommand;

            const result = executePipeline(pipelineConfig, state, moveSeatCommand, fixedRandom, playerIds);
            expect(result.success).toBe(false);
            expect(result.error).toBe('invalid_phase');
        });

        it('4 人模式攻击发起时不会在 targetingRoll 前预写 defenderId', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createNoResponseSetup()(playerIds, fixedRandom);
            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            const selectAbilityResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_ABILITY',
                    playerId: '0',
                    payload: { abilityId: fistAttackAbilityId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds
            );
            expect(selectAbilityResult.success).toBe(true);
            state = selectAbilityResult.state as MatchState<DiceThroneCore>;

            expect(state.core.pendingAttack?.attackerId).toBe('0');
            expect(state.core.pendingAttack?.defenderId).toBeUndefined();
        });

        it('4 人模式下队友手牌可见且不会进入同队响应队列', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const state = createInitializedState(playerIds, fixedRandom);
            state.core.players['0'].hand = [getCardById('card-inner-peace')];
            state.core.players['1'].hand = [getCardById('card-surprise')];
            state.core.players['2'].hand = [getCardById('card-surprise')];
            state.core.players['3'].hand = [getCardById('card-surprise')];
            state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['2'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['3'].resources[RESOURCE_IDS.CP] = 10;
            state.core.dice = Array.from({ length: 5 }, (_, index) => ({
                id: index,
                definitionId: 'monk-dice',
                value: 1,
                symbol: 'fist',
                symbols: ['fist'],
                isKept: false,
            }));
            state.core.rollCount = 1;
            state.core.rollConfirmed = true;

            const filtered = playerView(state.core, '0').players!;
            expect(filtered['2'].hand[0]?.name).toBe(state.core.players['2'].hand[0]?.name);
            expect(filtered['1'].hand[0]?.name).toBe('???');
            expect(filtered['3'].hand[0]?.name).toBe('???');

            const responderQueue = getResponderQueue(
                state.core,
                'afterRollConfirmed',
                '0',
                undefined,
                '0',
                'offensiveRoll'
            );
            expect(responderQueue).toEqual(['1', '3']);
        });

        it('4 人模式下卡牌对手效果优先命中当前战斗对手', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'pyromancer',
                '3': 'monk',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            state.core.players['3'].hand = [getCardById('card-palm-strike')];

            const events = executeCardCommand(
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '3',
                    payload: { cardId: 'card-palm-strike' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                state.sys.phase as TurnPhase,
                Date.now()
            );

            const appliedStatusEvent = events.find((event) => event.type === 'STATUS_APPLIED');
            expect(appliedStatusEvent).toBeDefined();
            expect((appliedStatusEvent as { payload: { targetId: PlayerId } }).payload.targetId).toBe('0');
        });

        it('4 人模式下防御掷骰确认后的响应窗口只归当前攻击方', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'monk',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            const commandsToDefensiveRoll: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commandsToDefensiveRoll) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            state.core.players['0'].hand = [getCardById('card-flick')];
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['2'].hand = [getCardById('card-flick')];
            state.core.players['2'].resources[RESOURCE_IDS.CP] = 10;

            for (const input of [
                cmd('ROLL_DICE', '3'),
                cmd('CONFIRM_ROLL', '3'),
            ]) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(state.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
        });

        it('4 人模式下进攻掷骰确认后的响应窗口只归两名对手', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'monk',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            state.core.players['1'].hand = [getCardById('card-flick')];
            state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['2'].hand = [getCardById('card-flick')];
            state.core.players['2'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['3'].hand = [getCardById('card-flick')];
            state.core.players['3'].resources[RESOURCE_IDS.CP] = 10;

            for (const input of [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ]) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(state.sys.responseWindow?.current?.responderQueue).toEqual(['1', '3']);
        });

        it('4 人模式下攻击方队友不会进入响应队列，但可直接打出改骰牌', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'monk',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            const commandsToDefensiveRoll: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commandsToDefensiveRoll) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            state.core.players['0'].hand = [getCardById('card-flick')];
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['2'].hand = [getCardById('card-flick')];
            state.core.players['2'].resources[RESOURCE_IDS.CP] = 10;

            for (const input of [
                cmd('ROLL_DICE', '3'),
                cmd('CONFIRM_ROLL', '3'),
            ]) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(state.sys.responseWindow?.current?.responderQueue).toEqual(['0']);

            const teammatePlayResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '2',
                    payload: { cardId: 'card-flick' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(teammatePlayResult.success).toBe(true);
            state = teammatePlayResult.state as MatchState<DiceThroneCore>;

            expect(state.core.players['2'].discard.some((card) => card.id === 'card-flick')).toBe(true);
            expect(state.sys.responseWindow?.current?.responderQueue).toEqual(['0']);
            const teammateFlickPrompt = getMultistepChoicePrompt(state);
            expect(teammateFlickPrompt.playerId).toBe('2');
            expect(teammateFlickPrompt.meta).toMatchObject({
                dtType: 'modifyDie',
                targetOpponentDice: true,
                diceOwnerId: '3',
            });
        });

        it('4 人模式下非当前 responder 队友打出 card-flick 后，应直接进入改骰交互并保留响应窗口锁', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'samurai',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            state.core.players['1'].hand = [getCardById('card-flick')];
            state.core.players['1'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['3'].hand = [getCardById('card-flick')];
            state.core.players['3'].resources[RESOURCE_IDS.CP] = 10;

            for (const input of [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
            ]) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.responseWindow?.current?.responderQueue).toEqual(['1', '3']);
            expect(state.sys.responseWindow?.current?.currentResponderIndex).toBe(0);

            const playCardResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '3',
                    payload: { cardId: 'card-flick' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(playCardResult.success).toBe(true);
            state = playCardResult.state as MatchState<DiceThroneCore>;

            const flickPrompt = getMultistepChoicePrompt(state);
            expect(flickPrompt.playerId).toBe('3');
            expect(flickPrompt.meta).toMatchObject({
                dtType: 'modifyDie',
                targetOpponentDice: true,
                diceOwnerId: '0',
            });

            const targetDie = state.core.dice[0];
            expect(targetDie).toBeDefined();
            const newValue = targetDie.value === 6 ? 5 : targetDie.value + 1;
            const modifyDieResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'MODIFY_DIE',
                    playerId: '3',
                    payload: { dieId: targetDie.id, newValue },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(modifyDieResult.success).toBe(true);
            state = modifyDieResult.state as MatchState<DiceThroneCore>;

            const interactionId = getMultistepChoicePrompt(state).id;
            expect(typeof interactionId).toBe('string');
            const confirmInteractionResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SYS_INTERACTION_CONFIRM',
                    playerId: '3',
                    payload: { interactionId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(confirmInteractionResult.success).toBe(true);
            state = confirmInteractionResult.state as MatchState<DiceThroneCore>;

            expect(state.sys.interaction.current).toBeUndefined();
            expect(state.core.players['3'].hand.some((card) => card.id === 'card-flick')).toBe(false);
            expect(state.core.players['3'].discard.some((card) => card.id === 'card-flick')).toBe(true);
        });

        it('4 人模式主阶段打出 card-get-away 时，不应先误弹 defender 选择，而应直接进入选状态交互', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'samurai',
                '3': 'gunslinger',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            state.core.players['0'].hand = [getCardById('card-get-away')];
            state.core.players['1'].statusEffects[STATUS_IDS.CONCUSSION] = 1;
            state.core.players['3'].tokens[TOKEN_IDS.BOUNTY] = 1;

            const events = executeCardCommand(
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-get-away' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                state.sys.phase as TurnPhase,
                Date.now(),
            );

            const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as
                | Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }>
                | undefined;
            expect(interactionEvent).toBeDefined();
            expect(interactionEvent?.payload.interaction.type).toBe('selectStatus');
            expect(interactionEvent?.payload.interaction.targetPlayerIds).toEqual(['0', '1', '2', '3']);
            expect(interactionEvent?.payload.interaction.resolveCustomActionId).toBeUndefined();
        });

        it('4 人模式在进攻阶段结算后会先进入 targetingRoll', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createNoResponseSetup()(playerIds, fixedRandom);

            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, fixedRandom, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('targetingRoll');
            expect(state.core.rollLimit).toBe(1);
            expect(state.core.rollDiceCount).toBe(1);
            expect(state.core.rollConfirmed).toBe(false);
            expect(state.core.pendingAttack?.defenderId).toBeUndefined();
        });

        it('4 人模式 targetingRoll 掷出 1/2 时自动锁定左侧对手', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 2]);
            let state = createNoResponseSetup()(playerIds, random);

            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingAttack?.defenderId).toBe('3');
        });

        it('4 人模式 targetingRoll 掷出 1/2 后，攻击修正卡可在 defenderId 写回前直接结算到自动目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'barbarian',
                '1': 'monk',
                '2': 'samurai',
                '3': 'shadow_thief',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
                state.core.players[pid].discard = [];
                state.core.players[pid].statusEffects = {};
            }

            state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['0'].hand = [getCardById('card-more-please')];
            state.core.activePlayerId = '0';
            state.core.turnPhase = 'targetingRoll';
            state.core.dice = [{ id: 0, value: 2, locked: true, ownerId: '0' }] as any;
            state.core.rollCount = 1;
            state.core.rollConfirmed = true;
            state.core.rollsRemaining = 0;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'barbarian-offense',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any;
            state.sys.phase = 'targetingRoll';

            const result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-more-please' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(result.success).toBe(true);

            const pendingBonusState = result.state as MatchState<DiceThroneCore>;
            expect(pendingBonusState.core.pendingBonusDiceSettlement).toMatchObject({
                sourceAbilityId: 'card-more-please',
                attackerId: '0',
                targetId: '3',
                displayOnly: true,
                continuation: {
                    kind: 'attack',
                    settlementStage: 'preDamage',
                    markBonusDiceResolved: true,
                },
            });
            expect(pendingBonusState.core.players['3'].statusEffects[STATUS_IDS.CONCUSSION] ?? 0).toBe(0);
            expect(getCurrentInteractionSummary(pendingBonusState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: '0',
            });

            const confirmResult = executePipeline(
                pipelineConfig,
                pendingBonusState,
                {
                    type: 'SKIP_BONUS_DICE_REROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(confirmResult.success).toBe(true);

            const resolvedState = confirmResult.state as MatchState<DiceThroneCore>;
            expect(resolvedState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(resolvedState.core.players['3'].statusEffects[STATUS_IDS.CONCUSSION]).toBe(1);
            expect(resolvedState.core.players['1'].statusEffects[STATUS_IDS.CONCUSSION] ?? 0).toBe(0);
            expect(getCurrentInteractionSummary(resolvedState).id).toBeUndefined();
        });

        it('4 人模式 targetingRoll 自动目标后，Loaded token 的奖励骰结算应命中自动目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'gunslinger',
                '1': 'monk',
                '2': 'samurai',
                '3': 'shadow_thief',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
                state.core.players[pid].discard = [];
                state.core.players[pid].statusEffects = {};
            }

            state.core.players['0'].tokens.loaded = 1;
            state.core.activePlayerId = '0';
            state.core.turnPhase = 'targetingRoll';
            state.core.dice = [{ id: 0, value: 2, locked: true, ownerId: '0' }] as any;
            state.core.rollCount = 1;
            state.core.rollConfirmed = true;
            state.core.rollsRemaining = 0;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'revolver-3',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
            } as any;
            state.sys.phase = 'targetingRoll';

            const advanceResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(advanceResult.success).toBe(true);
            const tokenChoiceState = advanceResult.state as MatchState<DiceThroneCore>;
            expect(tokenChoiceState.core.pendingAttack?.defenderId).toBe('3');
            expect(tokenChoiceState.sys.interaction.current).toBeTruthy();

            const loadedResult = executePipeline(
                pipelineConfig,
                tokenChoiceState,
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: 'option-0' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );

            expect(loadedResult.success).toBe(true);
            const loadedPendingState = loadedResult.state as MatchState<DiceThroneCore>;
            expect(loadedPendingState.core.players['0'].tokens.loaded).toBe(0);
            expect(loadedPendingState.core.pendingBonusDiceSettlement).toMatchObject({
                attackerId: '0',
                targetId: '3',
                displayOnly: true,
                continuation: {
                    kind: 'attack',
                    settlementStage: 'preDamage',
                    markBonusDiceResolved: false,
                },
            });
            expect(loadedPendingState.core.pendingAttack?.defenderId).toBe('3');
            expect(getCurrentInteractionSummary(loadedPendingState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: '0',
            });

            const loadedConfirmResult = executePipeline(
                pipelineConfig,
                loadedPendingState,
                {
                    type: 'SKIP_BONUS_DICE_REROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(loadedConfirmResult.success).toBe(true);
            const finalState = loadedConfirmResult.state as MatchState<DiceThroneCore>;
            // Loaded 的奖励骰只是补充本次攻击伤害，普通确认后自动目标与防御链必须保留。
            expect(finalState.sys.phase).toBe('defensiveRoll');
            expect(finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(finalState.core.pendingAttack).toMatchObject({
                attackerId: '0',
                defenderId: '3',
                sourceAbilityId: 'revolver-3',
                isDefendable: true,
                bonusDamage: 1,
                settlementStage: 'preDamage',
            });
        });

        it('4 人模式 targetingRoll 手选目标后的 Loaded reroll 不应再次 reopen 同一 token 选择', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([3, 2]);
            const state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'gunslinger',
                '1': 'monk',
                '2': 'samurai',
                '3': 'shadow_thief',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
                state.core.players[pid].discard = [];
                state.core.players[pid].statusEffects = {};
            }

            state.core.players['0'].tokens.loaded = 1;
            state.core.activePlayerId = '0';
            state.core.turnPhase = 'targetingRoll';
            state.core.dice = [{ id: 0, value: 5, locked: true, ownerId: '0' }] as any;
            state.core.rollCount = 1;
            state.core.rollConfirmed = true;
            state.core.rollsRemaining = 0;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: undefined,
                isDefendable: true,
                sourceAbilityId: 'revolver-3',
                damageResolved: false,
                resolvedDamage: 0,
                attackDiceFaceCounts: {},
                loadedBonusDieBoost: {
                    allowReroll: true,
                    postSettleBonusDamageAdds: [
                        {
                            amount: 1,
                            sourceCardId: 'card-wild-west',
                        },
                    ],
                },
            } as any;
            state.sys.phase = 'targetingRoll';

            const openTargetChoiceResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(openTargetChoiceResult.success).toBe(true);
            const targetChoiceState = openTargetChoiceResult.state as MatchState<DiceThroneCore>;
            expect(targetChoiceState.sys.interaction.current?.playerId).toBe('3');
            const targetOptions = (
                targetChoiceState.sys.interaction.current?.data as { options?: Array<{ playerId: string; customId?: string }> } | undefined
            )?.options ?? [];
            const chooseTargetOption = targetOptions.find((option) => option.customId === 'select-target:1');
            expect(chooseTargetOption).toBeDefined();

            const chooseTargetResult = executePipeline(
                pipelineConfig,
                targetChoiceState,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '3',
                    payload: { defenderId: chooseTargetOption!.playerId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(chooseTargetResult.success).toBe(true);
            const loadedChoiceState = chooseTargetResult.state as MatchState<DiceThroneCore>;
            expect(loadedChoiceState.core.pendingAttack?.defenderId).toBe('1');
            expect((loadedChoiceState.sys.interaction.current?.data as { sourceId?: string } | undefined)?.sourceId).toBe('revolver-3');

            const useLoadedResult = executePipeline(
                pipelineConfig,
                loadedChoiceState,
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: 'option-0' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(useLoadedResult.success).toBe(true);
            const afterUseLoadedState = useLoadedResult.state as MatchState<DiceThroneCore>;
            expect(afterUseLoadedState.sys.interaction.current?.kind).toBe('dt:bonus-dice');
            expect(
                (afterUseLoadedState.sys.interaction.queue ?? []).some((interaction) =>
                    interaction.kind === 'simple-choice'
                    && ((interaction.data as { sourceId?: string } | undefined)?.sourceId === 'revolver-3')
                )
            ).toBe(false);

            const rerollBonusDieResult = executePipeline(
                pipelineConfig,
                afterUseLoadedState,
                {
                    type: 'REROLL_BONUS_DIE',
                    playerId: '0',
                    payload: { dieIndex: 0 },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(rerollBonusDieResult.success).toBe(true);

            const settleBonusDieResult = executePipeline(
                pipelineConfig,
                rerollBonusDieResult.state as MatchState<DiceThroneCore>,
                {
                    type: 'SKIP_BONUS_DICE_REROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(settleBonusDieResult.success).toBe(true);
            const finalState = settleBonusDieResult.state as MatchState<DiceThroneCore>;
            const loadedTokenLogs = (finalState.sys.actionLog?.entries ?? []).filter((entry) =>
                entry.kind === 'TOKEN_USED'
                && entry.segments.some((segment) =>
                    segment.type === 'i18n'
                    && (segment as { key?: string }).key === 'actionLog.offensiveRollEndTokenUsed'
                )
            );

            expect(finalState.sys.phase).toBe('defensiveRoll');
            expect(finalState.core.players['0'].tokens.loaded).toBe(0);
            expect(finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(finalState.core.pendingAttack?.defenderId).toBe('1');
            expect(finalState.core.pendingAttack?.bonusDamage).toBe(2);
            expect(finalState.core.pendingAttack?.attackModifierBonusDamage).toBe(1);
            expect(getCurrentInteractionSummary(finalState).id).toBeUndefined();
            expect(loadedTokenLogs).toHaveLength(1);
        });

        it('4 人模式 targetingRoll 掷出 3/4 时自动锁定右侧对手', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 4]);
            let state = createNoResponseSetup()(playerIds, random);

            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingAttack?.defenderId).toBe('1');
        });

        it('4 人模式进入 defensiveRoll 时应保留唯一防御技的掷骰数量，而不是把骰子全部锁死', () => {
            const cases = [
                {
                    targetRoll: 2,
                    expectedDefenderId: '3',
                    expectedDefenseAbilityId: 'holy-defense',
                    expectedDiceDefinitionId: 'paladin-dice',
                },
                {
                    targetRoll: 4,
                    expectedDefenderId: '1',
                    expectedDefenseAbilityId: 'thick-skin',
                    expectedDiceDefinitionId: 'barbarian-dice',
                },
            ] as const;

            for (const testCase of cases) {
                const playerIds: PlayerId[] = ['0', '1', '2', '3'];
                const pipelineConfig = {
                    domain: DiceThroneDomain,
                    systems: testSystems,
                };
                const random = createQueuedRandom([1, 1, 1, 1, 1, testCase.targetRoll]);
                let state = createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'barbarian',
                    '2': 'pyromancer',
                    '3': 'paladin',
                });

                for (const pid of playerIds) {
                    state.core.players[pid].hand = [];
                    state.core.players[pid].deck = [];
                }

                const commands: CommandInput[] = [
                    ...advanceTo('offensiveRoll', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('ADVANCE_PHASE', '0'),
                ];

                for (const input of commands) {
                    const command = {
                        type: input.type,
                        playerId: input.playerId,
                        payload: input.payload,
                        timestamp: Date.now(),
                    } as DiceThroneCommand;
                    const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                    expect(result.success).toBe(true);
                    state = result.state as MatchState<DiceThroneCore>;
                }

                expect(state.sys.phase).toBe('defensiveRoll');
                expect(state.core.pendingAttack?.defenderId).toBe(testCase.expectedDefenderId);
                expect(state.core.pendingAttack?.defenseAbilityId).toBe(testCase.expectedDefenseAbilityId);
                expect(state.core.rollLimit).toBe(1);
                expect(state.core.rollCount).toBe(0);
                expect(state.core.rollDiceCount).toBe(3);
                expect(state.core.dice.every((die) => die.definitionId === testCase.expectedDiceDefinitionId)).toBe(true);
                expect(state.core.dice.slice(0, 3).every((die) => die.isKept === false)).toBe(true);
                expect(state.core.dice.slice(3).every((die) => die.isKept === true)).toBe(true);
            }
        });

        it('忍者打出瞬身 II 升级卡后，真实防御流程应按升级后的防御技结算', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 6, 6]);
            let state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'ninja',
                '1': 'treant',
            });

            state.core.players['0'].hand = [getCardById('upgrade-blink-2')];
            state.core.players['0'].deck = state.core.players['0'].deck.filter((card) => card.id !== 'upgrade-blink-2');
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 3;
            state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
            state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;

            const result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'upgrade-blink-2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(result.success).toBe(true);
            state = result.state as MatchState<DiceThroneCore>;

            state.core.activePlayerId = '1';
            state.core.pendingAttack = {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'splinter',
                isDefendable: true,
                damage: 0,
            } as DiceThroneCore['pendingAttack'];
            state.core.rollCount = 0;
            state.core.rollLimit = 1;
            state.core.rollDiceCount = 0;
            state.core.rollConfirmed = false;
            state.sys.phase = 'defensiveRoll';

            const commands: CommandInput[] = [
                cmd('SELECT_ABILITY', '0', { abilityId: 'blink' }),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.core.players['0'].abilityLevels.blink).toBe(2);
            expect(state.core.pendingAttack).toBeNull();
            expect(state.sys.phase).toBe('main2');
            expect(state.core.players['1'].resources[RESOURCE_IDS.HP]).toBe(49);
            expect(state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(1);
        });

        it('忍者打出瞬身 II 升级卡后，进入 defensiveRoll 自动选中唯一防御技时仍应保留升级版合同', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([
                1, 1, 1, 1, 1,
                6, 6, 1,
                2, 3,
            ]);
            let state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'monk',
                '1': 'ninja',
            });

            state.core.activePlayerId = '1';
            state.core.players['1'].hand = [getCardById('upgrade-blink-2')];
            state.core.players['1'].deck = state.core.players['1'].deck.filter((card) => card.id !== 'upgrade-blink-2');
            state.core.players['1'].resources[RESOURCE_IDS.CP] = 3;
            state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
            state.core.players['1'].resources[RESOURCE_IDS.HP] = 50;

            let result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '1',
                    payload: { cardId: 'upgrade-blink-2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(result.success).toBe(true);
            state = result.state as MatchState<DiceThroneCore>;
            state.core.activePlayerId = '0';

            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingAttack?.defenseAbilityId).toBe('blink');
            expect(state.core.players['1'].abilityLevels.blink).toBe(2);
            expect(state.core.rollCount).toBe(0);
            expect(state.core.rollLimit).toBe(2);
            expect(state.core.rollDiceCount).toBe(3);

            result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ROLL_DICE',
                    playerId: '1',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(result.success).toBe(true);
            state = result.state as MatchState<DiceThroneCore>;

            expect(state.core.rollCount).toBe(1);
            expect(state.core.rollLimit).toBe(2);
            expect(state.core.players['1'].tokens[TOKEN_IDS.SMOKE_BOMB]).toBe(0);

            result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'TOGGLE_DIE_LOCK',
                    playerId: '1',
                    payload: { dieId: 0 },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(result.success).toBe(true);
            state = result.state as MatchState<DiceThroneCore>;
            expect(state.core.dice.find((die) => die.id === 0)?.isKept).toBe(true);

            result = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'ROLL_DICE',
                    playerId: '1',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(result.success).toBe(true);
            state = result.state as MatchState<DiceThroneCore>;
            expect(state.core.rollCount).toBe(2);
            expect(state.core.rollLimit).toBe(2);
        });

        it('4 人模式若已卡成“同一防御技已选中但全锁骰”，再次选择同一防御技应恢复掷骰配置', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 4]);
            let state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'pyromancer',
                '3': 'paladin',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }

            const commands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of commands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            state.core.rollDiceCount = 0;
            state.core.rollCount = 0;
            state.core.dice = state.core.dice.map((die) => ({ ...die, isKept: true }));
            state.core.pendingAttack = {
                ...state.core.pendingAttack!,
                defenseAbilityId: 'thick-skin',
            };

            const reselectResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_ABILITY',
                    playerId: '1',
                    payload: { abilityId: 'thick-skin' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(reselectResult.success).toBe(true);
            if (!reselectResult.success) {
                return;
            }

            const recoveredState = reselectResult.state as MatchState<DiceThroneCore>;
            expect(recoveredState.core.rollDiceCount).toBe(3);
            expect(recoveredState.core.rollCount).toBe(0);
            expect(recoveredState.core.dice.slice(0, 3).every((die) => die.isKept === false)).toBe(true);
            expect(recoveredState.core.dice.slice(3).every((die) => die.isKept === true)).toBe(true);
        });

        it('4 人模式 targetingRoll 掷出 5 时由防守队选择目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 5]);
            let state = createNoResponseSetup()(playerIds, random);

            const setupCommands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of setupCommands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('targetingRoll');
            expect(state.sys.interaction.current?.kind).toBe('dt:defender-choice');
            expect(state.sys.interaction.current?.playerId).toBe('3');
            const choiceOptions = ((state.sys.interaction.current as any)?.data?.options ?? []) as Array<{ playerId: string; customId?: string; disabled?: boolean }>;
            expect(choiceOptions).toHaveLength(2);
            expect(choiceOptions.some((option) => option.customId === 'select-target:2')).toBe(false);

            const chooseRightOpponent = choiceOptions.find((option) => option.customId === 'select-target:1');
            expect(chooseRightOpponent).toBeDefined();

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '3',
                    payload: { defenderId: chooseRightOpponent!.playerId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds
            );
            expect(resolveResult.success).toBe(true);
            state = resolveResult.state as MatchState<DiceThroneCore>;

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingAttack?.defenderId).toBe('1');
            expect(state.core.pendingAttack?.targetingSelectionPending).toBe(false);
        });

        it('4 人模式 targetingRoll 掷出 6 时由进攻方选择目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 6]);
            let state = createNoResponseSetup()(playerIds, random);

            const setupCommands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of setupCommands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('targetingRoll');
            expect(state.sys.interaction.current?.kind).toBe('dt:defender-choice');
            expect(state.sys.interaction.current?.playerId).toBe('0');
            const choiceOptions = ((state.sys.interaction.current as any)?.data?.options ?? []) as Array<{ playerId: string; customId?: string }>;
            expect(choiceOptions).toHaveLength(2);
            expect(choiceOptions.some((option) => option.customId === 'select-target:2')).toBe(false);
            const chooseRightOpponent = choiceOptions.find((option) => option.customId === 'select-target:1');
            expect(chooseRightOpponent).toBeDefined();

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '0',
                    payload: { defenderId: chooseRightOpponent!.playerId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds
            );
            expect(resolveResult.success).toBe(true);
            state = resolveResult.state as MatchState<DiceThroneCore>;

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingAttack?.defenderId).toBe('1');
        });

        it('4 人模式 targetingRoll 掷出 6 且目标面板已打开时，仍可打出攻击修正并把所选敌人同步为当前攻击目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1]);
            let state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'barbarian',
                '1': 'monk',
                '2': 'samurai',
                '3': 'shadow_thief',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
                state.core.players[pid].discard = [];
                state.core.players[pid].statusEffects = {};
            }

            state.core.players['0'].hand = [getCardById('card-more-please')];
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
            state.core.activePlayerId = '0';
            state.core.turnPhase = 'targetingRoll';
            state.core.dice = [{ id: 0, value: 6, locked: true, ownerId: '0' }] as any;
            state.core.rollCount = 1;
            state.core.rollConfirmed = true;
            state.core.rollsRemaining = 0;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: undefined,
                targetingSelectionPending: false,
                targetingSelectionResolved: false,
                isDefendable: true,
                damage: 4,
                sourceAbilityId: 'barbarian-offense',
                defenseAbilityId: undefined,
                preDefenseResolved: false,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
                offensiveRollEndTokenResolved: true,
                bonusDiceResolved: false,
            } as any;
            state.sys.phase = 'targetingRoll';
            state.sys.interaction.current = createDefenderChoiceInteraction({
                id: 'targeting-roll-test',
                playerId: '0',
                options: [
                    { playerId: '1', customId: 'select-target:1' },
                    { playerId: '3', customId: 'select-target:3' },
                ],
                allowedCommands: ['PLAY_CARD'],
            });

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-more-please' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(playResult.success).toBe(true);
            state = playResult.state as MatchState<DiceThroneCore>;
            expect(state.core.players['0'].discard.some((card) => card.id === 'card-more-please')).toBe(true);
            expect(state.core.pendingAttack?.deferredAttackModifierCardIds).toEqual(['card-more-please']);

            const interaction = state.sys.interaction.current as {
                data?: {
                    options?: Array<{ playerId: string; customId?: string }>;
                    resolveCustomActionId?: string;
                };
            } | undefined;
            expect(interaction).toBeDefined();
            expect(interaction?.data?.resolveCustomActionId).not.toBe('resolve-card-effects-on-selected-opponent');

            const chooseTargetOption = interaction?.data?.options?.find((option) => option.customId === 'select-target:1');
            expect(chooseTargetOption).toBeDefined();
            const targetResolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '0',
                    payload: { defenderId: chooseTargetOption!.playerId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(targetResolveResult.success).toBe(true);
            const awaitingBonusConfirmState = targetResolveResult.state as MatchState<DiceThroneCore>;

            expect(awaitingBonusConfirmState.core.pendingAttack?.defenderId).toBe('1');
            expect(awaitingBonusConfirmState.core.pendingAttack?.deferredAttackModifierCardIds ?? []).toEqual([]);
            expect(awaitingBonusConfirmState.core.pendingBonusDiceSettlement).toMatchObject({
                sourceAbilityId: 'card-more-please',
                attackerId: '0',
                targetId: '1',
                displayOnly: true,
            });
            expect(awaitingBonusConfirmState.core.players['1'].statusEffects[STATUS_IDS.CONCUSSION] ?? 0).toBe(0);
            expect(getCurrentInteractionSummary(awaitingBonusConfirmState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: '0',
            });

            const bonusConfirmResult = executePipeline(
                pipelineConfig,
                awaitingBonusConfirmState,
                {
                    type: 'SKIP_BONUS_DICE_REROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(bonusConfirmResult.success).toBe(true);
            state = bonusConfirmResult.state as MatchState<DiceThroneCore>;

            expect(state.sys.phase).toBe('defensiveRoll');
            expect(state.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(state.core.players['1'].statusEffects[STATUS_IDS.CONCUSSION]).toBe(1);
            expect(state.core.players['3'].statusEffects[STATUS_IDS.CONCUSSION] ?? 0).toBe(0);
        });

        it('4 人模式 targetingRoll 掷出 6 时先打出荒野西部，不应卡死且应保留主目标选择交互', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1]);
            let state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'gunslinger',
                '1': 'monk',
                '2': 'samurai',
                '3': 'shadow_thief',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
                state.core.players[pid].discard = [];
                state.core.players[pid].statusEffects = {};
            }

            state.core.players['0'].hand = [getCardById('card-wild-west')];
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['0'].tokens[TOKEN_IDS.LOADED] = 1;
            state.core.activePlayerId = '0';
            state.core.turnPhase = 'targetingRoll';
            state.core.dice = [{ id: 0, value: 6, locked: true, ownerId: '0' }] as any;
            state.core.rollCount = 1;
            state.core.rollConfirmed = true;
            state.core.rollsRemaining = 0;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: undefined,
                targetingSelectionPending: false,
                targetingSelectionResolved: false,
                isDefendable: true,
                damage: 4,
                sourceAbilityId: 'revolver-3',
                defenseAbilityId: undefined,
                preDefenseResolved: false,
                bonusDamage: 0,
                attackModifierBonusDamage: 0,
                damageResolved: false,
                resolvedDamage: 0,
                offensiveRollEndTokenResolved: true,
                bonusDiceResolved: false,
            } as any;
            state.sys.phase = 'targetingRoll';
            state.sys.interaction.current = createDefenderChoiceInteraction({
                id: 'targeting-roll-test',
                playerId: '0',
                options: [
                    { playerId: '1', customId: 'select-target:1' },
                    { playerId: '3', customId: 'select-target:3' },
                ],
                allowedCommands: ['PLAY_CARD'],
            });

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-wild-west' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(playResult.success).toBe(true);
            state = playResult.state as MatchState<DiceThroneCore>;

            expect(state.core.players['0'].discard.some((card) => card.id === 'card-wild-west')).toBe(true);
            expect(state.core.pendingAttack?.loadedBonusDieBoost?.allowReroll).toBe(true);
            expect(state.core.pendingAttack?.deferredAttackModifierCardIds ?? []).toEqual([]);

            const interaction = state.sys.interaction.current as {
                data?: {
                    options?: Array<{ playerId: string; customId?: string }>;
                    resolveCustomActionId?: string;
                };
            } | undefined;
            expect(interaction).toBeDefined();
            expect(interaction?.data?.resolveCustomActionId).not.toBe('resolve-card-effects-on-selected-opponent');

            const chooseTargetOption = interaction?.data?.options?.find((option) => option.customId === 'select-target:1');
            expect(chooseTargetOption).toBeDefined();
            const targetResolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '0',
                    payload: { defenderId: chooseTargetOption!.playerId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(targetResolveResult.success).toBe(true);
            state = targetResolveResult.state as MatchState<DiceThroneCore>;

            expect(state.core.pendingAttack?.defenderId).toBe('1');
            expect(state.core.pendingAttack?.targetingSelectionResolved).toBe(true);
            expect(state.sys.phase === 'targetingRoll' || state.sys.phase === 'defensiveRoll').toBe(true);
        });

        it('4 人模式 targetingRoll 选目标交互意外丢失后，再次推进应重建交互而不是静默卡住', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 5]);
            let state = createNoResponseSetup()(playerIds, random);

            const setupCommands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of setupCommands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('targetingRoll');
            expect(state.sys.interaction.current?.playerId).toBe('3');

            const corruptedState = {
                ...state,
                sys: {
                    ...state.sys,
                    flowHalted: true,
                    interaction: {
                        ...state.sys.interaction,
                        current: undefined,
                    },
                },
                core: {
                    ...state.core,
                    pendingAttack: {
                        ...state.core.pendingAttack!,
                        targetingSelectionPending: false,
                        targetingSelectionResolved: false,
                        defenderId: undefined,
                    },
                },
            } as MatchState<DiceThroneCore>;

            const recoverResult = executePipeline(
                pipelineConfig,
                corruptedState,
                {
                    type: 'ADVANCE_PHASE',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds
            );

            expect(recoverResult.success).toBe(true);
            const recoveredState = recoverResult.state as MatchState<DiceThroneCore>;
            expect(recoveredState.sys.phase).toBe('targetingRoll');
            expect(recoveredState.sys.interaction.current?.playerId).toBe('3');
            expect(recoveredState.core.pendingAttack?.targetingSelectionPending).toBe(true);
            expect(recoveredState.core.pendingAttack?.targetingSelectionResolved).toBe(false);
        });

        it('targetingRoll 无可选目标时 emergency skip 会清理 pendingAttack 并推进到 main2', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = fixedRandom;
            let state = createNoResponseSetup()(playerIds, random);

            state = {
                ...state,
                sys: {
                    ...state.sys,
                    phase: 'targetingRoll',
                    flowHalted: true,
                    interaction: {
                        ...state.sys.interaction,
                        current: createDefenderChoiceInteraction({
                            id: 'targeting-roll-emergency',
                            playerId: '0',
                            titleKey: 'targeting-roll',
                            options: [],
                        }),
                    },
                },
                core: {
                    ...state.core,
                    rollCount: 1,
                    rollConfirmed: true,
                    pendingAttack: {
                        attackerId: '0',
                        isDefendable: true,
                        targetingSelectionPending: true,
                        targetingSelectionResolved: false,
                    },
                },
            };

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SYS_INTERACTION_CANCEL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds
            );

            expect(resolveResult.success).toBe(true);
            const nextState = resolveResult.state as MatchState<DiceThroneCore>;
            expect(nextState.sys.interaction.current).toBeUndefined();
            expect(nextState.core.pendingAttack).toBeNull();
            expect(nextState.sys.phase).toBe('main2');
        });

        it('offensiveRollEndToken 无可选项时 emergency skip 会标记 resolved 且不重复弹窗', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = fixedRandom;
            let state = createNoResponseSetup()(playerIds, random);

            const offensiveTokenDef = {
                id: 'test-offensive-token',
                name: 'tokens.test-offensive-token.name',
                colorTheme: 'bg-slate-500',
                description: ['test'],
                stackLimit: 99,
                category: 'consumable' as const,
                activeUse: {
                    timing: ['onOffensiveRollEnd'] as const,
                    consumeAmount: 1,
                    effect: { type: 'modifyDamageDealt' as const, value: 1 },
                },
            };

            state = {
                ...state,
                core: {
                    ...state.core,
                    tokenDefinitions: [...(state.core.tokenDefinitions ?? []), offensiveTokenDef],
                    players: {
                        ...state.core.players,
                        '0': {
                            ...state.core.players['0'],
                            tokens: {
                                ...state.core.players['0']?.tokens,
                                [offensiveTokenDef.id]: 1,
                            },
                        },
                    },
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        offensiveRollEndTokenResolved: false,
                    },
                },
                sys: {
                    ...state.sys,
                    phase: 'offensiveRoll',
                    flowHalted: true,
                    interaction: {
                        ...state.sys.interaction,
                        current: createSimpleChoice(
                            'offensive-roll-end-token-emergency',
                            '0',
                            'offensiveRollEndToken.title',
                            [],
                            'offensive-roll-end-token',
                        ),
                    },
                },
            };

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SYS_INTERACTION_RESPOND',
                    playerId: '0',
                    payload: { optionId: '__emergency_skip__' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds
            );

            expect(resolveResult.success).toBe(true);
            const afterSkip = resolveResult.state as MatchState<DiceThroneCore>;
            expect(afterSkip.sys.interaction.current).toBeUndefined();
            expect(afterSkip.core.pendingAttack?.offensiveRollEndTokenResolved).toBe(true);
        });

        it('忍术掷出 6 后选择不可防御分支时，不应先进入防御阶段', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([6]);
            const state = createHeroMatchup('ninja', 'treant')(['0', '1'], random);

            state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;
            state.core.players['0'].abilities = state.core.players['0'].abilities.map((ability) => (
                ability.id === 'shadow-fang' ? SHADOW_FANG_2 : ability
            ));
            state.core.players['0'].abilityLevels['shadow-fang'] = 2;
            state.core.players['0'].tokens[TOKEN_IDS.SMOKE_BOMB] = 0;
            state.core.players['1'].resources[RESOURCE_IDS.HP] = 30;
            state.core.activePlayerId = '0';
            state.core.rollConfirmed = true;
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'shadow-fang-2-main',
                isDefendable: true,
                damage: 0,
            };
            state.sys.phase = 'offensiveRoll';

            const advanceResult = executePipeline(
                pipelineConfig,
                state,
                cmd('ADVANCE_PHASE', '0') as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(advanceResult.success).toBe(true);
            if (!advanceResult.success) return;

            const tokenChoiceState = advanceResult.state as MatchState<DiceThroneCore>;
            expect(tokenChoiceState.sys.phase).toBe('offensiveRoll');
            const tokenPrompt = getSimpleChoicePrompt(tokenChoiceState, 'shadow-fang-2-main');
            const useOption = tokenPrompt.options.find((option) => option.value?.customId === 'use-ninjutsu');
            expect(useOption).toBeTruthy();

            const useResult = respondToPrompt(tokenChoiceState, useOption!.id, '0', random, playerIds);
            expect(useResult.success).toBe(true);
            if (!useResult.success) return;

            expect(useResult.state.core.pendingBonusDiceSettlement).toMatchObject({
                sourceAbilityId: 'shadow-fang-2-main',
                attackerId: '0',
                targetId: '1',
                displayOnly: true,
            });
            expect(getCurrentInteractionSummary(useResult.state)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: '0',
            });

            const confirmNinjutsuRollResult = executePipeline(
                pipelineConfig,
                useResult.state,
                {
                    type: 'SKIP_BONUS_DICE_REROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );
            expect(confirmNinjutsuRollResult.success).toBe(true);
            if (!confirmNinjutsuRollResult.success) return;

            const ninjutsuPrompt = getSimpleChoicePrompt(confirmNinjutsuRollResult.state, 'shadow-fang-2-main');
            const undefendableOption = ninjutsuPrompt.options.find((option) => option.value?.customId === 'ninja-ninjutsu-undefendable');
            expect(undefendableOption).toBeTruthy();

            const resolveResult = respondToPrompt(confirmNinjutsuRollResult.state, undefendableOption!.id, '0', createQueuedRandom([1]), playerIds);
            expect(resolveResult.success).toBe(true);
            if (!resolveResult.success) return;

            expect(resolveResult.state.core.pendingAttack?.isDefendable).toBe(false);
            expect(resolveResult.events.some((event) => event.type === 'ATTACK_MADE_UNDEFENDABLE')).toBe(true);
            expect(resolveResult.state.sys.phase).not.toBe('defensiveRoll');
        });

        it('4 人模式选定目标后应先弹出忍术选择，而不是直接进入防御阶段', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 6]);
            let state = createInitializedStateWithCharacters(playerIds, random, {
                '0': 'ninja',
                '1': 'treant',
                '2': 'monk',
                '3': 'paladin',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
                state.core.players[pid].discard = [];
                state.core.players[pid].statusEffects = {};
            }

            state.core.players['0'].tokens[TOKEN_IDS.NINJUTSU] = 1;

            const setupCommands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: 'slash-5' }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of setupCommands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            const defenderChoice = getDefenderChoicePrompt(state, 'slash-5').options as Array<{ playerId: string; customId?: string }>;
            const chooseTargetOption = defenderChoice.find((option) => option.customId === 'select-target:1');
            expect(chooseTargetOption).toBeDefined();

            const chooseTargetResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '0',
                    payload: { defenderId: chooseTargetOption!.playerId },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds,
            );

            expect(chooseTargetResult.success).toBe(true);
            if (!chooseTargetResult.success) return;

            const afterTargetState = chooseTargetResult.state as MatchState<DiceThroneCore>;
            expect(afterTargetState.core.pendingAttack?.defenderId).toBe('1');
            expect(afterTargetState.sys.phase).toBe('targetingRoll');
            const tokenPrompt = getSimpleChoicePrompt(afterTargetState, 'slash-5');
            expect(tokenPrompt.options.map((option) => option.value?.customId)).toContain('use-ninjutsu');
        });

        it('4 人模式 targetingRoll 不允许伪造队友为目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            const random = createQueuedRandom([1, 1, 1, 1, 1, 6]);
            let state = createNoResponseSetup()(playerIds, random);

            const setupCommands: CommandInput[] = [
                ...advanceTo('offensiveRoll', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                cmd('ADVANCE_PHASE', '0'),
                cmd('ROLL_DICE', '0'),
                cmd('CONFIRM_ROLL', '0'),
                cmd('ADVANCE_PHASE', '0'),
            ];

            for (const input of setupCommands) {
                const command = {
                    type: input.type,
                    playerId: input.playerId,
                    payload: input.payload,
                    timestamp: Date.now(),
                } as DiceThroneCommand;
                const result = executePipeline(pipelineConfig, state, command, random, playerIds);
                expect(result.success).toBe(true);
                state = result.state as MatchState<DiceThroneCore>;
            }

            expect(state.sys.phase).toBe('targetingRoll');
            expect(state.sys.interaction.current?.kind).toBe('dt:defender-choice');
            expect(state.sys.interaction.current?.playerId).toBe('0');

            const spoofResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'SELECT_DEFENDER_TARGET',
                    playerId: '0',
                    payload: { defenderId: '2' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                random,
                playerIds
            );

            expect(spoofResult.success).toBe(false);
            expect(spoofResult.error).toBe('invalid_defender_target');
            expect(spoofResult.state.core.pendingAttack?.defenderId).toBeUndefined();
            expect(spoofResult.state.core.pendingAttack?.targetingSelectionPending).toBe(true);
        });

        it('响应窗口：对手持有任意骰子卡（roll）时应打开 afterRollConfirmed', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: 'afterRollConfirmed 打开 - roll any',
                setup: createSetupWithHand(['card-surprise'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(result.finalState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);
        });

        it('响应窗口：对手持有任意骰子卡（instant）时应打开 afterRollConfirmed', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: 'afterRollConfirmed 打开 - instant any',
                setup: createSetupWithHand(['card-flick'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current?.windowType).toBe('afterRollConfirmed');
            expect(result.finalState.sys.responseWindow?.current?.responderQueue).toEqual(['1']);
        });

        it.each([
            { attackerId: '0' as PlayerId, responderId: '1' as PlayerId },
            { attackerId: '1' as PlayerId, responderId: '0' as PlayerId },
        ])('一掷千金奖励骰结算前不打开响应窗口，对手可直接改骰并由骰主确认', ({ attackerId, responderId }) => {
            const runner = createRunner(createQueuedRandom([6]));
            const attackerStartingCp = 5;
            const responderStartingCp = 10;
            const rolled = runner.run({
                name: '一掷千金奖励骰右侧骰盘直接介入',
                setup: createSetupWithHand(['card-one-throw-fortune'], {
                    playerId: attackerId,
                    cp: attackerStartingCp,
                    mutate: (core) => {
                        core.activePlayerId = attackerId;
                        core.players[attackerId].deck = [];
                        core.players[responderId].hand = [getCardById('card-surprise')];
                        core.players[responderId].deck = [];
                        core.players[responderId].discard = [];
                        core.players[responderId].resources[RESOURCE_IDS.CP] = responderStartingCp;
                        core.rollConfirmedSequence = 2;
                        core.afterRollResponseWindowSequence = 2;
                        core.afterRollResponseWindowSignature = 'normal-roll:previous';
                    },
                }),
                commands: [
                    cmd('PLAY_CARD', attackerId, { cardId: 'card-one-throw-fortune' }),
                ],
            });

            expect(rolled.assertionErrors).toEqual([]);
            expect(rolled.finalState.core.pendingBonusDiceSettlement).toMatchObject({
                sourceAbilityId: 'card-one-throw-fortune',
                attackerId,
                displayOnly: true,
                allowDiceModification: true,
            });
            expect(rolled.finalState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(6);
            expect(rolled.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(getCurrentInteractionSummary(rolled.finalState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: attackerId,
            });

            runner.setState(rolled.finalState);
            const playedModifier = runner.dispatch('PLAY_CARD', { playerId: responderId, cardId: 'card-surprise' });
            expect(playedModifier.success).toBe(true);
            expect(playedModifier.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(getCurrentInteractionSummary(playedModifier.finalState)).toMatchObject({
                kind: 'multistep-choice',
                playerId: responderId,
            });
            expect(playedModifier.finalState.sys.interaction.queue?.[0]).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: attackerId,
            });

            runner.setState(playedModifier.finalState);
            const modified = runner.dispatch('MODIFY_DIE', { playerId: responderId, dieId: 0, newValue: 4 });
            expect(modified.success).toBe(true);
            expect(modified.finalState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(4);
            expect(getCurrentInteractionSummary(modified.finalState)).toMatchObject({
                kind: 'multistep-choice',
                playerId: responderId,
            });

            runner.setState(modified.finalState);
            const confirmedCard = runner.dispatch('SYS_INTERACTION_CONFIRM', { playerId: responderId });
            expect(confirmedCard.success).toBe(true);
            expect(confirmedCard.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(confirmedCard.finalState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(4);
            expect(getCurrentInteractionSummary(confirmedCard.finalState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: attackerId,
            });
            expect(confirmedCard.finalState.core.players[responderId].discard.some(card => card.id === 'card-surprise')).toBe(true);
            expect(confirmedCard.finalState.core.players[attackerId].resources[RESOURCE_IDS.CP]).toBe(attackerStartingCp);

            runner.setState(confirmedCard.finalState);
            const confirmed = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: attackerId });
            expect(confirmed.success).toBe(true);
            expect(confirmed.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(getCurrentInteractionSummary(confirmed.finalState).id).toBeUndefined();
            expect(confirmed.finalState.core.players[attackerId].resources[RESOURCE_IDS.CP]).toBe(attackerStartingCp + 2);
        });

        it('奖励骰有可重投能力时不开放响应，能力重投后必须等待骰主普通确认', () => {
            const runner = createRunner(createQueuedRandom([3, 6]));
            const rolled = runner.run({
                name: '教皇税可重投奖励骰',
                setup: (playerIds, random) => {
                    const state = createInitializedStateWithCharacters(playerIds, random, {
                        '0': 'paladin',
                        '1': 'monk',
                    });
                    state.sys.phase = 'main1';
                    state.core.activePlayerId = '0';
                    state.core.players['0'].hand = [getCardById('card-one-throw-fortune')];
                    state.core.players['0'].deck = [];
                    state.core.players['0'].resources[RESOURCE_IDS.CP] = 5;
                    state.core.players['1'].hand = [];
                    state.core.players['1'].deck = [];
                    return state;
                },
                commands: [cmd('PLAY_CARD', '0', { cardId: 'card-one-throw-fortune' })],
            });

            expect(rolled.assertionErrors).toEqual([]);
            expect(rolled.finalState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(3);
            expect(rolled.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(getCurrentInteractionSummary(rolled.finalState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: '0',
            });

            runner.setState(rolled.finalState);
            const rerolled = runner.dispatch('USE_PASSIVE_ABILITY', {
                playerId: '0',
                passiveId: 'tithes',
                actionIndex: 0,
                targetDieId: 0,
            });
            expect(rerolled.success).toBe(true);
            expect(rerolled.finalState.core.pendingBonusDiceSettlement?.dice[0]?.value).toBe(6);
            expect(rerolled.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(getCurrentInteractionSummary(rerolled.finalState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: '0',
            });
            const cpBeforeConfirm = rerolled.finalState.core.players['0'].resources[RESOURCE_IDS.CP] ?? 0;

            runner.setState(rerolled.finalState);
            const confirmed = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
            expect(confirmed.success).toBe(true);
            expect(confirmed.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(getCurrentInteractionSummary(confirmed.finalState).id).toBeUndefined();
            expect(confirmed.finalState.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(cpBeforeConfirm + 3);
        });

        it.each([
            { attackerId: '0' as PlayerId, responderId: '1' as PlayerId },
            { attackerId: '1' as PlayerId, responderId: '0' as PlayerId },
        ])('一掷千金没有合法改骰响应时仍等待骰主普通确认，不自动结算', ({ attackerId, responderId }) => {
            const runner = createRunner(createQueuedRandom([3]));
            const attackerStartingCp = 5;
            const rolled = runner.run({
                name: '一掷千金无响应等待普通确认',
                setup: createSetupWithHand(['card-one-throw-fortune'], {
                    playerId: attackerId,
                    cp: attackerStartingCp,
                    mutate: (core) => {
                        core.activePlayerId = attackerId;
                        core.players[attackerId].deck = [];
                        core.players[responderId].hand = [];
                        core.players[responderId].deck = [];
                        core.players[responderId].discard = [];
                        core.rollConfirmedSequence = 2;
                        core.afterRollResponseWindowSequence = 2;
                        core.afterRollResponseWindowSignature = 'normal-roll:previous';
                    },
                }),
                commands: [
                    cmd('PLAY_CARD', attackerId, { cardId: 'card-one-throw-fortune' }),
                ],
            });

            expect(rolled.assertionErrors).toEqual([]);
            expect(rolled.finalState.core.pendingBonusDiceSettlement?.sourceAbilityId).toBe('card-one-throw-fortune');
            expect(rolled.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(getCurrentInteractionSummary(rolled.finalState)).toMatchObject({
                kind: 'dt:bonus-dice',
                playerId: attackerId,
            });
            expect(rolled.finalState.core.players[attackerId].resources[RESOURCE_IDS.CP]).toBe(attackerStartingCp);

            runner.setState(rolled.finalState);
            const confirmed = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: attackerId });
            expect(confirmed.success).toBe(true);
            expect(confirmed.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(getCurrentInteractionSummary(confirmed.finalState).id).toBeUndefined();
            expect(confirmed.finalState.core.currentRollContext?.kind).toBe('bonus');
            expect(confirmed.finalState.core.currentRollContext?.display.replayOnly).toBe(true);
            expect(confirmed.finalState.core.players[attackerId].resources[RESOURCE_IDS.CP]).toBe(attackerStartingCp + 2);

            runner.setState(confirmed.finalState);
            const advanced = runner.dispatch('ADVANCE_PHASE', { playerId: attackerId });
            expect(advanced.success).toBe(true);
            expect(advanced.finalState.sys.phase).toBe('offensiveRoll');

            runner.setState(advanced.finalState);
            const offensiveRoll = runner.dispatch('ROLL_DICE', { playerId: attackerId });
            expect(offensiveRoll.success).toBe(true);
            expect(offensiveRoll.finalState.core.currentRollContext).toMatchObject({
                kind: 'offensive',
                ownerPlayerId: attackerId,
            });
            expect(offensiveRoll.finalState.core.currentRollContext?.dice).toHaveLength(5);
        });

        it('响应窗口：对手仅持有真正只能改自己骰子的卡时不应打开 afterRollConfirmed', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: 'afterRollConfirmed 不打开 - self only',
                setup: createSetupWithHand(['card-play-six'], {
                    playerId: '1',
                    cp: 10,
                    mutate: (core) => {
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        });

        it('源头级去重：同一 rollConfirmed 序号已处理时，不应再次发出 afterRollConfirmed OPENED', () => {
            const state = createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                },
            })(['0', '1'], fixedRandom);

            state.sys.phase = 'offensiveRoll';
            state.core.rollCount = 1;
            state.core.rollLimit = 3;
            state.core.rollConfirmed = false;
            state.core.rollConfirmedSequence = 2;
            state.core.afterRollResponseWindowSequence = 3;

            const events = executeDomainCommand(
                { core: state.core, sys: { phase: 'offensiveRoll' } },
                {
                    type: 'CONFIRM_ROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: 123,
                } as DiceThroneCommand,
                fixedRandom,
            );

            expect(events.map((event) => event.type)).toEqual(['ROLL_CONFIRMED']);
        });

        it('源头级去重：骰面签名已处理时，不应重复打开 afterRollConfirmed', () => {
            const state = createSetupWithHand(['card-flick'], {
                playerId: '1',
                cp: 10,
                mutate: (core) => {
                    core.players['0'].hand = [];
                    core.players['0'].deck = [];
                },
            })(['0', '1'], fixedRandom);

            state.sys.phase = 'offensiveRoll';
            state.core.rollCount = 1;
            state.core.rollLimit = 3;
            state.core.rollConfirmed = false;
            state.core.rollConfirmedSequence = 2;
            state.core.afterRollResponseWindowSequence = 0;
            state.core.afterRollResponseWindowSignature = buildAfterRollConfirmedSignature(state.core);

            const events = executeDomainCommand(
                { core: state.core, sys: { phase: 'offensiveRoll' } },
                {
                    type: 'CONFIRM_ROLL',
                    playerId: '0',
                    payload: {},
                    timestamp: 124,
                } as DiceThroneCommand,
                fixedRandom,
            );

            expect(events.map((event) => event.type)).toEqual(['ROLL_CONFIRMED']);
        });

        it('掌击后对手仅持有弹一手时不应打开通用打牌响应窗口', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '普通出牌后不打开通用响应 - dice instant only',
                setup: createSetupWithHand(['card-palm-strike'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-flick')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].deck = [];
                        core.players['1'].deck = [];
                    },
                }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-palm-strike' }),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        });

        it('掌击后对手仅持有超级加倍时不应打开通用打牌响应窗口', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '普通出牌后不打开通用响应 - self draw instant',
                setup: createSetupWithHand(['card-palm-strike'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-super-double')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].deck = [];
                        core.players['1'].deck = [];
                    },
                }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-palm-strike' }),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
        });

        it('击倒：可花费 2CP 主动移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒花费2CP移除',
                setup: createSetupWithHand([], {
                    cp: 4,
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    },
                }),
                commands: [
                    cmd(DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: 2, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.steps.filter(step => !step.success)).toEqual([]);
            expect(result.assertionErrors).toEqual([]);
        });

        it('火法师防御阶段掷骰数量为5', () => {
            const result = runner.run({
                name: '火法师防御阶段掷骰数量为5',
                setup: (playerIds, random) => createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'pyromancer',
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: fistAttackAbilityId }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    roll: { count: 0, limit: 1, diceCount: 5, confirmed: false },
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId: fistAttackAbilityId,
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingAttack?.defenseAbilityId).toBe('magma-armor');
        });

        it('掷骰阶段使用当前玩家骰子定义（玩家0）', () => {
            const result = runner.run({
                name: '掷骰阶段骰子定义-玩家0',
                setup: (playerIds, random) => createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'pyromancer',
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            const diceDefs = new Set(result.finalState.core.dice.map(die => die.definitionId));
            expect(diceDefs.size).toBe(1);
            expect(diceDefs.has('monk-dice')).toBe(true);
        });

        it('掷骰阶段使用当前玩家骰子定义（玩家1）', () => {
            const result = runner.run({
                name: '掷骰阶段骰子定义-玩家1',
                setup: (playerIds, random) => createInitializedStateWithCharacters(playerIds, random, {
                    '0': 'monk',
                    '1': 'pyromancer',
                }),
                commands: [
                    ...advanceTo('discard'),
                    cmd('ADVANCE_PHASE', '0'), // discard -> upkeep (player1，自动推进到 main1)
                    ...advanceTo('offensiveRoll', '1'),
                ],
            });
            expect(result.assertionErrors).toEqual([]);
            const diceDefs = new Set(result.finalState.core.dice.map(die => die.definitionId));
            expect(diceDefs.size).toBe(1);
            expect(diceDefs.has('pyromancer-dice')).toBe(true);
        });

        it('击倒：CP 不足时无法移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒CP不足无法移除',
                setup: createSetupWithHand([], {
                    cp: 1,
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    },
                }),
                commands: [
                    cmd(DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, '0'),
                ],
                expect: {
                    expectError: { command: DICETHRONE_COMMANDS.PAY_TO_REMOVE_KNOCKDOWN, error: 'not_enough_cp' },
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: 1, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 1 } },
                    },
                },
            });
            expect(result.steps.filter(step => !step.success)).toEqual([]);
            expect(result.assertionErrors).toEqual([]);
        });

        it('击倒：未移除时跳过攻击阶段并移除', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '击倒跳过攻击阶段',
                setup: createSetupWithHand([], {
                    cp: 2,
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'), // main1 -> offensiveRoll (should skip to main2)
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { cp: 2, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('净化：移除击倒并消耗净化', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '净化移除击倒',
                setup: createSetupWithHand([], {
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 1;
                        core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
                    },
                }),
                commands: [
                    cmd('USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.PURIFY]: 0 }, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('净化：可以移除以 token 形式存储的负面状态', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '净化移除赏金 token',
                setup: createSetupWithHand([], {
                    mutate: (core) => {
                        core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
                        core.players['0'].tokens[TOKEN_IDS.BOUNTY] = 1;
                    },
                }),
                commands: [
                    cmd('USE_PURIFY', '0', { statusId: TOKEN_IDS.BOUNTY }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.PURIFY]: 0, [TOKEN_IDS.BOUNTY]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('净化：无负面状态不可使用 - no_status', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '净化无负面状态 - no_status',
                setup: createSetupWithHand([], {
                    mutate: (core) => {
                        core.players['0'].statusEffects[STATUS_IDS.KNOCKDOWN] = 0;
                        core.players['0'].tokens[TOKEN_IDS.PURIFY] = 1;
                    },
                }),
                commands: [
                    cmd('USE_PURIFY', '0', { statusId: STATUS_IDS.KNOCKDOWN }),
                ],
                expect: {
                    expectError: { command: 'USE_PURIFY', error: 'no_status' },
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { [TOKEN_IDS.PURIFY]: 1 }, statusEffects: { [STATUS_IDS.KNOCKDOWN]: 0 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('技能触发', () => {
        // 骰面映射: 1,2=fist, 3=palm, 4,5=taiji, 6=lotus
        it('小顺可用"和谐"', () => {
            // 小顺: 需要4个连续不同的面。骰子值1,3,4,6 → fist,palm,taiji,lotus
            const runner = createRunner(createQueuedRandom([1, 3, 4, 6, 2]));
            const result = runner.run({
                name: '小顺可用和谐',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['harmony'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('大顺可用"定水神拳"', () => {
            // 大顺: 需要5个连续点数 [1,2,3,4,5] 或 [2,3,4,5,6]
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            const result = runner.run({
                name: '大顺可用定水神拳',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['calm-water'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个拳头可用"拳法"', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 3, 4]));
            const result = runner.run({
                name: '3个拳头可用拳法',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['fist-technique-3'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('4个莲花可用"花开见佛"（不可防御）', () => {
            const runner = createRunner(createQueuedRandom([6, 6, 6, 6, 1]));
            const result = runner.run({
                name: '4个莲花可用花开见佛',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['lotus-palm'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个太极可用"禅忘"', () => {
            const runner = createRunner(createQueuedRandom([4, 4, 4, 1, 3]));
            const result = runner.run({
                name: '3个太极可用禅忘',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['zen-forget'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个拳+1个掌可用"太极连环拳"', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 3, 4]));
            const result = runner.run({
                name: '3拳+1掌可用太极连环拳',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['taiji-combo'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('3个掌可用"雷霆一击"', () => {
            const runner = createRunner(createQueuedRandom([3, 3, 3, 1, 4]));
            const result = runner.run({
                name: '3个掌可用雷霆一击',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    availableAbilityIdsIncludes: ['thunder-strike'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('状态效果', () => {
        // 骰面映射: 1,2=fist, 3=palm, 4,5=taiji, 6=lotus
        it('和谐命中后获得太极', () => {
            const diceValues = [1, 3, 4, 6, 2, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '和谐命中后获得太极',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'harmony' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { taiji: 2 } },
                        '1': { hp: 45 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('定水神拳命中后获得太极+闪避', () => {
            const diceValues = [1, 2, 3, 4, 5, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '定水神拳命中后获得太极+闪避',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'calm-water' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { taiji: 2, evasive: 1 } },
                        '1': { hp: 43 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('花开见佛命中后太极满值', () => {
            const random = createQueuedRandom([6, 6, 6, 6, 1, 1, 1, 1, 1]);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds, setupRandom) => {
                    const state = createMonkMirrorNoResponseSetup()(playerIds, setupRandom);
                    state.core.players['0'].tokens[TOKEN_IDS.TAIJI] = 5;
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: '花开见佛命中后太极满值',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'lotus-palm' }),
                    cmd('ADVANCE_PHASE', '0'), // 固定不可防御，跳过 defensiveRoll 并进入太极加伤响应
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过加伤响应后结算伤害与 postDamage 太极效果
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { tokens: { taiji: 6 } },
                        '1': { hp: 45 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卡牌效果', () => {
        it('打出升级卡时 EventStream 应包含 ABILITY_REPLACED 事件', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'ABILITY_REPLACED 事件应包含升级卡信息',
                setup: createSetupWithHand(['card-meditation-2'], {
                    cp: 2,
                }),
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    players: {
                        '0': { abilityLevels: { meditation: 2 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);

            // 验证 EventStream 包含 ABILITY_REPLACED 事件
            const entries = result.finalState.sys.eventStream?.entries ?? [];
            const abilityReplacedEntry = entries.find(
                (e: { event: { type: string } }) => e.event.type === 'ABILITY_REPLACED'
            );
            expect(abilityReplacedEntry).toBeDefined();
            const payload = abilityReplacedEntry!.event.payload as { cardId: string; playerId: string };
            expect(payload.cardId).toBe('card-meditation-2');
            expect(payload.playerId).toBe('0');
        });

        it('打出内心平静获得2太极', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '内心平静获得2太极',
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-inner-peace' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': { tokens: { taiji: 2 }, discardSize: 1 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('打出佛光普照获得多种状态并给对手倒地', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '佛光普照多状态',
                setup: createSetupWithHand(['card-buddha-light', 'card-enlightenment'], { cp: 2 }),
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-buddha-light' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 0,
                            tokens: { taiji: 1, evasive: 1, purify: 1 },
                        },
                        '1': {
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('深思获得5太极', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '深思获得5太极',
                setup: createSetupWithHand(['card-deep-thought', 'card-enlightenment'], { cp: 2 }),
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-enlightenment' }),
                    cmd('PLAY_CARD', '0', { cardId: 'card-deep-thought' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 0,
                            tokens: { taiji: 5 },
                            handSize: 0,
                            discardSize: 2,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('掌击给对手倒地', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '掌击给对手倒地',
                setup: createSetupWithHand(['card-palm-strike']),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-palm-strike' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '1': { statusEffects: { knockdown: 1 } },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('4 人模式主阶段打出掌击时会先要求在两名对手中选目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'monk',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }
            state.core.players['0'].hand = [getCardById('card-palm-strike')];

            const events = executeCardCommand(
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-palm-strike' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                state.sys.phase as TurnPhase,
                Date.now(),
            );

            expect(events.some((event) => event.type === 'STATUS_APPLIED')).toBe(false);
            const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as
                | Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }>
                | undefined;
            expect(interactionEvent).toBeDefined();
            expect(interactionEvent?.payload.interaction.type).toBe('selectPlayer');
            expect(interactionEvent?.payload.interaction.targetPlayerIds).toEqual(['1', '3']);
            expect(interactionEvent?.payload.interaction.resolveCustomActionId).toBe('resolve-card-effects-on-selected-opponent');
        });

        it('4 人模式主阶段打出月影突袭时会先要求在两名对手中选目标', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'moon_elf',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'samurai',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }
            state.core.players['0'].hand = [getCardById('moon-shadow-strike')];

            const events = executeCardCommand(
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'moon-shadow-strike' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                state.sys.phase as TurnPhase,
                Date.now(),
            );

            const interactionEvent = events.find((event) => event.type === 'INTERACTION_REQUESTED') as
                | Extract<DiceThroneEvent, { type: 'INTERACTION_REQUESTED' }>
                | undefined;
            expect(interactionEvent).toBeDefined();
            expect(interactionEvent?.payload.interaction.type).toBe('selectPlayer');
            expect(interactionEvent?.payload.interaction.targetPlayerIds).toEqual(['1', '3']);
            expect(interactionEvent?.payload.interaction.resolveCustomActionId).toBe('resolve-card-effects-on-selected-opponent');
        });

        it('4 人模式主阶段选定目标后会把混合卡牌效果结算到所选敌方', () => {
            const playerIds: PlayerId[] = ['0', '1', '2', '3'];
            const pipelineConfig = {
                domain: DiceThroneDomain,
                systems: testSystems,
            };
            let state = createInitializedStateWithCharacters(playerIds, fixedRandom, {
                '0': 'monk',
                '1': 'barbarian',
                '2': 'monk',
                '3': 'monk',
            });

            for (const pid of playerIds) {
                state.core.players[pid].hand = [];
                state.core.players[pid].deck = [];
            }
            state.core.players['0'].resources[RESOURCE_IDS.CP] = 10;
            state.core.players['0'].hand = [getCardById('card-buddha-light')];

            const playResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'PLAY_CARD',
                    playerId: '0',
                    payload: { cardId: 'card-buddha-light' },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(playResult.success).toBe(true);
            state = playResult.state as MatchState<DiceThroneCore>;

            expect(getCardInteractionPrompt(state)).toMatchObject({ targetPlayerIds: ['1', '3'] });

            const resolveResult = executePipeline(
                pipelineConfig,
                state,
                {
                    type: 'RESOLVE_INTERACTION',
                    playerId: '0',
                    payload: { selectedPlayerIds: ['3'] },
                    timestamp: Date.now(),
                } as DiceThroneCommand,
                fixedRandom,
                playerIds,
            );
            expect(resolveResult.success).toBe(true);
            state = resolveResult.state as MatchState<DiceThroneCore>;

            expect(state.core.players['0'].tokens[TOKEN_IDS.TAIJI] ?? 0).toBe(1);
            expect(state.core.players['0'].tokens[TOKEN_IDS.EVASIVE] ?? 0).toBe(1);
            expect(state.core.players['0'].tokens[TOKEN_IDS.PURIFY] ?? 0).toBe(1);
            expect(state.core.players['1'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(0);
            expect(state.core.players['3'].statusEffects[STATUS_IDS.KNOCKDOWN] ?? 0).toBe(1);
        });
    });

    describe('音效 sfxKey', () => {
        it('AbilityEffect.sfxKey 应传递到事件', () => {
            const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
            const ctx: EffectContext = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-sfx',
                state: core,
                damageDealt: 0,
            };
            const effects: AbilityEffect[] = [
                {
                    description: '测试 sfxKey 传递',
                    sfxKey: 'test_sfx',
                    timing: 'immediate',
                    action: { type: 'grantToken', target: 'self', tokenId: TOKEN_IDS.TAIJI, value: 1 },
                },
            ];

            const events = resolveEffectsToEvents(effects, 'immediate', ctx, { random: fixedRandom });
            const tokenEvent = events.find(e => e.type === 'TOKEN_GRANTED');
            expect(tokenEvent?.sfxKey).toBe('test_sfx');
        });
    });

    describe('自选移除状态交互', () => {
        it('remove-status-self 应生成仅限自身的状态选择交互', () => {
            const core = DiceThroneDomain.setup(['0', '1'], fixedRandom);
            const ctx: EffectContext = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'test-remove-status-self',
                state: core,
                damageDealt: 0,
            };
            const effects: AbilityEffect[] = [
                {
                    description: '移除自身状态',
                    timing: 'immediate',
                    action: { type: 'custom', target: 'self', customActionId: 'remove-status-self' },
                },
            ];

            const events = resolveEffectsToEvents(effects, 'immediate', ctx, { random: fixedRandom });
            const event = events.find(e => e.type === 'INTERACTION_REQUESTED') as any;
            expect(event).toBeDefined();
            // 原始实现直接创建 PendingInteraction
            expect(event.payload?.interaction).toBeDefined();
            expect(event.payload?.interaction?.type).toBe('selectStatus');
            // 验证交互配置正确（仅限自身）
            expect(event.payload?.interaction?.targetPlayerIds).toEqual(['0']);
        });
    });

    describe('技能升级', () => {
        it('升级清修到 II 级', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级清修 II',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 2,
                            abilityLevels: { meditation: 2 },
                            discardSize: 0,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.players['0'].upgradeCardByAbilityId.meditation).toEqual({
                cardId: 'card-meditation-2',
                cpCost: 2,
            });
        });

        it('升级拳法到 II 级', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级拳法 II',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-thrust-punch-2', targetAbilityId: 'fist-technique' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 2,
                            abilityLevels: { 'fist-technique': 2 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级和谐之力到 II 级', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级和谐 II',
                commands: [
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('DRAW_CARD', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-mahayana-2', targetAbilityId: 'harmony' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: INITIAL_CP - 1,
                            abilityLevels: { harmony: 2 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级后拳法 II 级伤害提升', () => {
            const diceValues = [1, 1, 2, 3, 4, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorSetupWithHand(['card-thrust-punch-2'], {
                    cp: 2,
                    mutate: (core) => {
                        const defender = core.players['1'];
                        if (!defender) return;
                        const handRespondable = defender.hand.filter((card) => card.timing === 'instant' || card.timing === 'roll');
                        const handNonRespondable = defender.hand.filter((card) => card.timing !== 'instant' && card.timing !== 'roll');
                        const deckRespondable = defender.deck.filter((card) => card.timing === 'instant' || card.timing === 'roll');
                        const deckNonRespondable = defender.deck.filter((card) => card.timing !== 'instant' && card.timing !== 'roll');
                        defender.deck = [...deckNonRespondable, ...handRespondable, ...deckRespondable];
                        defender.hand = handNonRespondable;
                        while (defender.hand.length < 4 && defender.deck.length > 0) {
                            const card = defender.deck.shift();
                            if (card) defender.hand.push(card);
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '升级后拳法 II 级伤害提升',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-thrust-punch-2', targetAbilityId: 'fist-technique' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-2-3' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': { abilityLevels: { 'fist-technique': 2 } },
                        '1': { hp: 43 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级后和谐 II 级伤害提升', () => {
            const diceValues = [1, 3, 4, 6, 2, 1, 1, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorSetupWithHand(['card-mahayana-2'], {
                    cp: 1,
                    mutate: (core) => {
                        const defender = core.players['1'];
                        if (!defender) return;
                        const handRespondable = defender.hand.filter((card) => card.timing === 'instant' || card.timing === 'roll');
                        const handNonRespondable = defender.hand.filter((card) => card.timing !== 'instant' && card.timing !== 'roll');
                        const deckRespondable = defender.deck.filter((card) => card.timing === 'instant' || card.timing === 'roll');
                        const deckNonRespondable = defender.deck.filter((card) => card.timing !== 'instant' && card.timing !== 'roll');
                        defender.deck = [...deckNonRespondable, ...handRespondable, ...deckRespondable];
                        defender.hand = handNonRespondable;
                        while (defender.hand.length < 4 && defender.deck.length > 0) {
                            const card = defender.deck.shift();
                            if (card) defender.hand.push(card);
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '升级后和谐 II 级伤害提升',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-mahayana-2', targetAbilityId: 'harmony' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'harmony' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '0': {
                            abilityLevels: { harmony: 2 },
                            tokens: { taiji: 3 },
                        },
                        '1': { hp: 44 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('防御阶段', () => {
        it('清修技能在防御阶段可用', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '清修在防御阶段可用',
                setup: createMonkMirrorInitializedState,
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    availableAbilityIdsIncludes: ['meditation'],
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('清修：防御结算=获得太极(按太极骰面数)+造成伤害(按拳骰面数)', () => {
            const random = createQueuedRandom([
                1, 1, 1, 1, 1, // 进攻方掷骰(5) - 5 个拳头
                4, 4, 1, 1,    // 防御方掷骰(4) - 2太极 + 2拳
            ]);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: '清修防御结算获得太极并造成伤害',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SYS_INTERACTION_RESPOND', '0', { optionId: 'skip' }), // 跳过进攻方的骰子修改交互
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }), // 选择清修防御技能
                    cmd('SYS_INTERACTION_RESPOND', '1', { optionId: 'skip' }), // 跳过骰子修改交互
                    cmd('ADVANCE_PHASE', '1'), // 防御方结束防御阶段
                    cmd('SKIP_TOKEN_RESPONSE', '1'), // 跳过防御方的 Token 响应（使用太极减免进攻方伤害）
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 跳过攻击方的 Token 响应
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': { tokens: { taiji: 2 } },
                        '0': { hp: 48 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
        });

        it('闪避投掷成功后应自动收口到 main2，而不是卡在 defensiveRoll', () => {
            const random = createQueuedRandom([
                1, 2, 3, 4, 5,
                1, 2, 3, 4, 5,
                2,
            ]);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createHeroMatchup('shadow_thief', 'moon_elf', (core) => {
                    core.players['1'].tokens[TOKEN_IDS.EVASIVE] = 1;
                }),
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: '闪避投掷成功后自动收口',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'kidney-shot' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'elusive-step' }),
                    cmd('ADVANCE_PHASE', '1'),
                    cmd('USE_TOKEN', '1', { tokenId: TOKEN_IDS.EVASIVE, amount: 1 }),
                    cmd('SKIP_TOKEN_RESPONSE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    players: {
                        '1': {
                            hp: INITIAL_HEALTH,
                            tokens: { [TOKEN_IDS.EVASIVE]: 0 },
                        },
                    },
                    pendingDamage: null,
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.responseWindow?.current).toBeUndefined();
            expect(result.finalState.sys.interaction?.current).toBeUndefined();
            expect(result.finalState.core.pendingDamage).toBeUndefined();
        });

        it('防御投掷确认后响应窗口排除防御方（不排除攻击方）', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([1, 1, 1, 1, 1, 1, 1, 1, 1]),
                setup: createMonkMirrorNoResponseSetup(),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '防御投掷确认后响应窗口排除防御方',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // offensiveRoll -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // defensiveRoll -> main2
                ],
                expect: {
                    turnPhase: 'main2',
                    activePlayerId: '0',
                    players: {
                        '0': { hp: 46 },
                        '1': { hp: 42 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('防御阶段掉骰上限为1', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            const result = runner.run({
                name: '防御阶段掉骰上限1',
                setup: createMonkMirrorInitializedState,
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('ROLL_DICE', '1'), // 第二次应失败
                ],
                expect: {
                    expectError: { command: 'ROLL_DICE', error: 'roll_limit_reached' },
                    turnPhase: 'defensiveRoll',
                    roll: { count: 1, limit: 1 },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卖牌与弃牌', () => {
        it('卖牌获得1CP', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '卖牌获得1CP',
                commands: [
                    cmd('SELL_CARD', '0', { cardId: 'card-inner-peace' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: Math.min(INITIAL_CP + 1, CP_MAX),
                            handSize: expectedHandSize - 1,
                            discardSize: 1,
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卡牌打出错误提示', () => {
        it('主要阶段卡在投掷阶段无法使用 - wrongPhaseForMain', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '主要阶段卡在投掷阶段无法使用',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-enlightenment' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'wrongPhaseForMain' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('CP不足时无法打出卡牌 - notEnoughCp', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: 'CP不足时无法打出卡牌',
                setup: createSetupWithHand(['card-buddha-light'], { cp: INITIAL_CP }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-buddha-light' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'notEnoughCp' },
                    turnPhase: 'main1',
                    players: {
                        '0': { cp: INITIAL_CP },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级卡在投掷阶段无法使用 - wrongPhaseForUpgrade', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级卡在投掷阶段无法使用',
                setup: createSetupWithHand(['card-meditation-2']),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-2', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_UPGRADE_CARD', error: 'wrongPhaseForUpgrade' },
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('升级卡允许直接从 I 升到 III', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '升级卡直接升到 III',
                setup: createSetupWithHand(['card-meditation-3'], { cp: 3 }),
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-meditation-3', targetAbilityId: 'meditation' }),
                ],
                expect: {
                    turnPhase: 'main1',
                    players: {
                        '0': {
                            cp: 0,
                            abilityLevels: { meditation: 3 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('投掷阶段卡在主要阶段无法使用 - wrongPhaseForRoll', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '投掷阶段卡在主要阶段无法使用',
                setup: createSetupWithHand(['card-play-six']),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-play-six' }),
                ],
                expect: {
                    expectError: { command: 'PLAY_CARD', error: 'wrongPhaseForRoll' },
                    turnPhase: 'main1',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('雷霆万钧 奖励骰重掷', () => {
        const createThunderStrikeSetup = (options: { taiji?: number } = {}) => {
            return createMonkMirrorSetupWithHand([], {
                playerId: '0',
                mutate: (core) => {
                    if (options.taiji !== undefined) {
                        core.players['0'].tokens[TOKEN_IDS.TAIJI] = options.taiji;
                    }
                },
            });
        };

        it('有太极时触发重掷交互流程', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '有太极时触发重掷交互',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算
                ],
                expect: {
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                        targetId: '1',
                        rerollCount: 0,
                        diceValues: [2, 3, 4],
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('重掷奖励骰并结算（消耗2太极）', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '重掷奖励骰并结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 0 } },
                        '1': { hp: 37 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('无太极时仍等待确认，并在确认后按最终骰面结算伤害', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 0 }),
                assertFn: assertState,
                silent: true,
            });
            const commands = [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 展示奖励骰，等待攻击方确认
                ];

            for (const command of commands) {
                const result = runner.dispatch(command.type, { playerId: command.playerId, ...command.payload as object });
                expect(result.success).toBe(true);
            }

            const awaitingConfirmation = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '1' });
            expect(awaitingConfirmation.success).toBe(false);
            expect(awaitingConfirmation.error).toBe('player_mismatch');
            expect(awaitingConfirmation.finalState.core.pendingBonusDiceSettlement).toMatchObject({
                sourceAbilityId: 'thunder-strike',
                attackerId: '0',
                displayOnly: true,
            });
            expect(awaitingConfirmation.finalState.core.pendingBonusDiceSettlement?.dice.map((die) => die.value)).toEqual([2, 3, 4]);
            expect(awaitingConfirmation.finalState.core.players['1'].resources.hp).toBe(50);
            expect(awaitingConfirmation.finalState.sys.phase).toBe('defensiveRoll');

            const settled = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
            expect(settled.success).toBe(true);
            expect(settled.finalState.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(settled.finalState.core.players['1'].resources.hp).toBe(41);
            expect(settled.finalState.sys.phase).toBe('main2');
        });

        it('非 displayOnly 结算仍只允许攻击方确认', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '非 displayOnly 由防御方确认应失败',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入可重掷交互（非 displayOnly）
                    cmd('SKIP_BONUS_DICE_REROLL', '1'),
                ],
                expect: {
                    expectError: { command: 'SKIP_BONUS_DICE_REROLL', error: 'player_mismatch' },
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('太极不足(1)时直接结算伤害', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 1 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '太极不足(1)时直接结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算攻击，displayOnly 奖励骰展示暂停
                    cmd('SKIP_BONUS_DICE_REROLL', '0'), // 确认骰子结果
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 攻击方跳过太极加伤 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 1 } },
                        '1': { hp: 41 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('跳过重掷不消耗太极并使用原骰结算', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '跳过重掷直接结算',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('SKIP_BONUS_DICE_REROLL', '0'), // 确认骰子结果
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 攻击方跳过太极加伤 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 2 } },
                        '1': { hp: 41 },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('超过重掷次数限制', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 4 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '超过重掷次数限制',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 1 }),
                ],
                expect: {
                    expectError: { command: 'REROLL_BONUS_DIE', error: 'bonus_reroll_limit_reached' },
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('雷霆一击 II 奖励骰重掷', () => {
        const createThunderStrikeSetup = (options: { taiji?: number } = {}) => {
            return createMonkMirrorSetupWithHand(['card-storm-assault-2'], {
                playerId: '0',
                mutate: (core) => {
                    if (options.taiji !== undefined) {
                        core.players['0'].tokens[TOKEN_IDS.TAIJI] = options.taiji;
                    }
                },
            });
        };

        it('有太极时触发重掷交互流程', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createThunderStrikeSetup({ taiji: 2 }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '有太极时触发重掷交互',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算
                ],
                expect: {
                    pendingBonusDiceSettlement: {
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                        targetId: '1',
                        threshold: 12,
                        rerollCount: 0,
                        diceValues: [2, 3, 4],
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('重掷奖励骰并结算', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => { core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2; },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '重掷奖励骰并结算',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'), // 确认骰子结果
                    cmd('SKIP_TOKEN_RESPONSE', '0'), // 攻击方跳过太极加伤 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 1 } },
                        '1': {
                            hp: 37,
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('无太极时直接结算伤害', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 3, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => {
                        const opponent = core.players['1'];
                        if (opponent) {
                            const nonResponseCards = opponent.hand.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
                            const responseCards = opponent.hand.filter(c => c.timing === 'instant' || c.timing === 'roll');
                            opponent.deck = [...opponent.deck, ...responseCards];
                            opponent.hand = nonResponseCards;
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '无太极时直接结算',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算攻击，displayOnly 奖励骰展示暂停
                    cmd('SKIP_BONUS_DICE_REROLL', '0'), // 确认骰子结果 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '1': {
                            hp: 41,
                            statusEffects: { knockdown: 0 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('总和 >= 12 触发倒地', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 4, 4, 4, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => {
                        const opponent = core.players['1'];
                        if (opponent) {
                            const nonResponseCards = opponent.hand.filter(c => c.timing !== 'instant' && c.timing !== 'roll');
                            const responseCards = opponent.hand.filter(c => c.timing === 'instant' || c.timing === 'roll');
                            opponent.deck = [...opponent.deck, ...responseCards];
                            opponent.hand = nonResponseCards;
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '总和 >= 12 触发倒地',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算攻击，displayOnly 奖励骰展示暂停
                    cmd('SKIP_BONUS_DICE_REROLL', '0'), // 确认骰子结果 → main2
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '1': {
                            hp: 38,
                            statusEffects: { knockdown: 1 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('二级技能第二次重掷被拒绝后仍可结算', () => {
            const diceValues = [3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 6, 1, 1];
            const random = createQueuedRandom(diceValues);

            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createMonkMirrorSetupWithHand(['card-storm-assault-2'], {
                    playerId: '0',
                    mutate: (core) => { core.players['0'].tokens[TOKEN_IDS.TAIJI] = 2; },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: '多次重掷并结算',
                commands: [
                    cmd('PLAY_UPGRADE_CARD', '0', { cardId: 'card-storm-assault-2', targetAbilityId: 'thunder-strike' }),
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'thunder-strike' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'meditation' }),
                    cmd('ADVANCE_PHASE', '1'), // -> 结算，进入重掷交互
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }),
                    cmd('REROLL_BONUS_DIE', '0', { dieIndex: 1 }),
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                    cmd('SKIP_TOKEN_RESPONSE', '0'),
                ],
                expect: {
                    expectError: { command: 'REROLL_BONUS_DIE', error: 'bonus_reroll_limit_reached' },
                    turnPhase: 'main2',
                    pendingBonusDiceSettlement: null,
                    players: {
                        '0': { tokens: { taiji: 1 } },
                        '1': {
                            hp: 42,
                            statusEffects: { knockdown: 0 },
                        },
                    },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });
    });

    describe('卡牌交互（全覆盖）', () => {
        // GameTestRunner 用 stepNum（命令索引+1）作为 timestamp
        // interactionId = `${cardId}-${playCardStep}`

        it('玩得六啊：set 模式修改 1 颗骰子至 6', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            // ADVANCE_PHASE=1, ROLL_DICE=2, PLAY_CARD=3
            const result = runner.run({
                name: '玩得六啊 set',
                setup: createSetupWithHand(['card-play-six'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-play-six' }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 6 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [6, 2, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('俺也一样：copy 模式修改骰子为另一颗值', () => {
            // 骰子值: [2, 5, 1, 3, 4]
            // copy 模式：选 die0(值=2) 为源，选 die1(值=5) 为目标 → die1 变为 2
            // diceModifyToCommands 会生成 2 条命令：源骰子保持原值 + 目标骰子复制源值
            const runner = createRunner(createQueuedRandom([2, 5, 1, 3, 4]));
            const result = runner.run({
                name: '俺也一样 copy',
                setup: createSetupWithHand(['card-me-too'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-me-too' }),
                    // copy 模式需要 2 条 MODIFY_DIE：源骰子(保持原值) + 目标骰子(复制源值)
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 2 }),
                    cmd('MODIFY_DIE', '0', { dieId: 1, newValue: 2 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [2, 2, 1, 3, 4],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('惊不惊喜：any 模式修改任意 1 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            const result = runner.run({
                name: '惊不惊喜 any-1',
                setup: createSetupWithHand(['card-surprise'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-surprise' }),
                    cmd('MODIFY_DIE', '0', { dieId: 2, newValue: 6 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [1, 2, 6, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('意不意外：any 模式修改任意 2 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5]));
            const result = runner.run({
                name: '意不意外 any-2',
                setup: createSetupWithHand(['card-unexpected'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-unexpected' }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 6 }),
                    cmd('MODIFY_DIE', '0', { dieId: 1, newValue: 6 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [6, 6, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('弹一手：adjust 模式增减 1 点', () => {
            const runner = createRunner(createQueuedRandom([2, 2, 2, 2, 2]));
            const result = runner.run({
                name: '弹一手 adjust',
                setup: createSetupWithHand(['card-flick'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-flick' }),
                    cmd('MODIFY_DIE', '0', { dieId: 0, newValue: 3 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [3, 2, 2, 2, 2],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('不愧是我：重掷至多 2 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5, 6, 6]));
            const result = runner.run({
                name: '不愧是我 reroll-2',
                setup: createSetupWithHand(['card-worthy-of-me'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-worthy-of-me' }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('REROLL_DIE', '0', { dieId: 1 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [6, 6, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.steps.filter(step => !step.success)).toEqual([]);
            expect(result.assertionErrors).toEqual([]);
        });

        it('不愧是我：允许同一颗骰子重掷 2 次', () => {
            const runner = createRunner(createQueuedRandom([1, 2, 3, 4, 5, 6, 5]));
            const result = runner.run({
                name: '不愧是我 reroll-2 same die twice',
                setup: createSetupWithHand(['card-worthy-of-me'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-worthy-of-me' }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [5, 2, 3, 4, 5],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.steps.filter(step => !step.success)).toEqual([]);
            expect(result.assertionErrors).toEqual([]);
        });

        it('不愧是我：已提交一次重掷后取消不应返还 CP 和卡牌', () => {
            const random = createQueuedRandom([1, 2, 3, 4, 5, 6]);
            const runner = createRunner(random);
            runner.setState(createSetupWithHand(['card-worthy-of-me'], { cp: 10 })(['0', '1'], random));

            const openingCommands = [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('PLAY_CARD', '0', { cardId: 'card-worthy-of-me' }),
            ];

            for (const command of openingCommands) {
                const result = runner.dispatch(command.type, { playerId: command.playerId, ...command.payload });
                expect(result.success).toBe(true);
            }

            const afterPlay = runner.getState();
            expect(afterPlay.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(9);
            expect(afterPlay.core.players['0'].hand.some(card => card.id === 'card-worthy-of-me')).toBe(false);
            expect(afterPlay.core.players['0'].discard.some(card => card.id === 'card-worthy-of-me')).toBe(true);

            expect(runner.dispatch('REROLL_DIE', { playerId: '0', dieId: 0 }).success).toBe(true);

            const afterFirstReroll = runner.getState();
            expect(afterFirstReroll.core.dice.map(die => die.value)).toEqual([6, 2, 3, 4, 5]);
            const rerollPrompt = getMultistepChoicePrompt(afterFirstReroll);
            expect(rerollPrompt.completedSteps).toBe(1);

            const cancelCommand = cancelPromptCommand(afterFirstReroll, '0');
            const cancelled = runner.dispatch(cancelCommand.type, { playerId: cancelCommand.playerId, ...cancelCommand.payload });
            expect(cancelled.success).toBe(true);

            const finalState = runner.getState();
            expect(getCurrentInteractionSummary(finalState).kind).toBeUndefined();
            expect(finalState.core.dice.map(die => die.value)).toEqual([6, 2, 3, 4, 5]);
            expect(finalState.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(9);
            expect(finalState.core.players['0'].hand.some(card => card.id === 'card-worthy-of-me')).toBe(false);
            expect(finalState.core.players['0'].discard.some(card => card.id === 'card-worthy-of-me')).toBe(true);
        });

        it('不愧是我：未提交任何重掷时取消仍返还 CP 和卡牌', () => {
            const random = createQueuedRandom([1, 2, 3, 4, 5]);
            const runner = createRunner(random);
            runner.setState(createSetupWithHand(['card-worthy-of-me'], { cp: 10 })(['0', '1'], random));

            const openingCommands = [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('PLAY_CARD', '0', { cardId: 'card-worthy-of-me' }),
            ];

            for (const command of openingCommands) {
                const result = runner.dispatch(command.type, { playerId: command.playerId, ...command.payload });
                expect(result.success).toBe(true);
            }

            const afterPlay = runner.getState();
            expect(afterPlay.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(9);
            expect(afterPlay.core.players['0'].hand.some(card => card.id === 'card-worthy-of-me')).toBe(false);
            expect(afterPlay.core.players['0'].discard.some(card => card.id === 'card-worthy-of-me')).toBe(true);
            expect(afterPlay.sys.interaction.current?.kind).toBe('multistep-choice');

            const cancelled = runner.dispatch('SYS_INTERACTION_CANCEL', { playerId: '0' });
            expect(cancelled.success).toBe(true);

            const finalState = runner.getState();
            expect(finalState.sys.interaction.current).toBeUndefined();
            expect(finalState.core.dice.map(die => die.value)).toEqual([1, 2, 3, 4, 5]);
            expect(finalState.core.players['0'].resources[RESOURCE_IDS.CP]).toBe(10);
            expect(finalState.core.players['0'].hand.some(card => card.id === 'card-worthy-of-me')).toBe(true);
            expect(finalState.core.players['0'].discard.some(card => card.id === 'card-worthy-of-me')).toBe(false);
        });

        it('我又行了：重掷至多 5 颗骰子', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 2, 3, 4, 5, 6]));
            const result = runner.run({
                name: '我又行了 reroll-5',
                setup: createSetupWithHand(['card-i-can-again'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-i-can-again' }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('REROLL_DIE', '0', { dieId: 1 }),
                    cmd('REROLL_DIE', '0', { dieId: 2 }),
                    cmd('REROLL_DIE', '0', { dieId: 3 }),
                    cmd('REROLL_DIE', '0', { dieId: 4 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [2, 3, 4, 5, 6],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('我又行了：分两批各重掷 2 颗时确认本批次不关闭整段交互', () => {
            const random = createQueuedRandom([1, 1, 1, 1, 1, 2, 3, 4, 5]);
            const runner = createRunner(random);
            runner.setState(createSetupWithHand(['card-i-can-again'], { cp: 10 })(['0', '1'], random));

            const openingCommands = [
                ...advanceTo('offensiveRoll'),
                cmd('ROLL_DICE', '0'),
                cmd('PLAY_CARD', '0', { cardId: 'card-i-can-again' }),
            ];

            for (const command of openingCommands) {
                const result = runner.dispatch(command.type, { playerId: command.playerId, ...command.payload });
                expect(result.success).toBe(true);
            }

            expect(runner.dispatch('REROLL_DIE', { playerId: '0', dieId: 0 }).success).toBe(true);
            expect(runner.dispatch('REROLL_DIE', { playerId: '0', dieId: 1 }).success).toBe(true);

            const afterFirstBatch = runner.getState();
            expect(afterFirstBatch.core.dice.map(die => die.value)).toEqual([2, 3, 1, 1, 1]);
            const firstBatchPrompt = getMultistepChoicePrompt(afterFirstBatch);
            expect(firstBatchPrompt.completedSteps).toBe(2);
            expect(firstBatchPrompt.completedDieIds).toEqual([0, 1]);

            expect(runner.dispatch('REROLL_DIE', { playerId: '0', dieId: 2 }).success).toBe(true);
            expect(runner.dispatch('REROLL_DIE', { playerId: '0', dieId: 3 }).success).toBe(true);

            const afterSecondBatch = runner.getState();
            expect(afterSecondBatch.core.dice.map(die => die.value)).toEqual([2, 3, 4, 5, 1]);
            const secondBatchPrompt = getMultistepChoicePrompt(afterSecondBatch);
            expect(secondBatchPrompt.completedSteps).toBe(4);
            expect(secondBatchPrompt.completedDieIds).toEqual([0, 1, 2, 3]);

            const finished = runner.dispatch('SYS_INTERACTION_CONFIRM', { playerId: '0' });
            expect(finished.success).toBe(true);
            expect(getCurrentInteractionSummary(finished.finalState).kind).toBeUndefined();
            expect(finished.finalState.core.players['0'].discard).toHaveLength(1);
            expect(finished.finalState.core.players['0'].discard[0]?.id).toBe('card-i-can-again');
        });

        it('我又行了：至多 5 颗允许已重掷 1 颗后空确认提前结束', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 6]));
            const result = runner.run({
                name: '我又行了 reroll-5 少选',
                setup: createSetupWithHand(['card-i-can-again'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-i-can-again' }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [6, 1, 1, 1, 1],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });

            expect(result.assertionErrors).toEqual([]);
        });

        it('我又行了：未声明可重复时不允许同一颗骰子重复重掷', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 6, 5]));
            const result = runner.run({
                name: '我又行了 reroll-5 默认同骰不可重复',
                setup: createSetupWithHand(['card-i-can-again'], { cp: 10 }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-i-can-again' }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    diceValues: [6, 1, 1, 1, 1],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                    expectError: { command: 'REROLL_DIE', error: 'die_already_completed' },
                },
            });

            expect(result.assertionErrors).toEqual([]);
        });

        it('抬一手：强制对手重掷 1 颗骰子（防御阶段，进攻方响应）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 2, 2, 2, 2, 6]));
            // PLAY_CARD is step 10: ADVANCE+ROLL+CONFIRM+PASS*2+SELECT+ADVANCE+ROLL+CONFIRM+PLAY_CARD
            const result = runner.run({
                name: '抬一手 reroll-opponent (防御阶段)',
                setup: createSetupWithHand(['card-give-hand'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [];
                        core.players['1'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('ADVANCE_PHASE', '0'), // -> defensiveRoll
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-give-hand' }),
                    cmd('REROLL_DIE', '0', { dieId: 0 }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    turnPhase: 'defensiveRoll',
                    diceValues: [6, 2, 2, 2, 1],
                    pendingInteraction: null,
                    players: { '0': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('抬一手：强制对手重掷 1 颗骰子（进攻阶段，防御方响应）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1, 6]));
            // PLAY_CARD is step 4: ADVANCE+ROLL+CONFIRM+PLAY_CARD
            const result = runner.run({
                name: '抬一手 reroll-opponent (进攻阶段)',
                setup: createSetupWithHand([], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [getCardById('card-give-hand')];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('PLAY_CARD', '1', { cardId: 'card-give-hand' }),
                    cmd('REROLL_DIE', '1', { dieId: 0 }),
                    cmd('SYS_INTERACTION_CONFIRM', '1'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [6, 1, 1, 1, 1],
                    pendingInteraction: null,
                    players: { '1': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('惊不惊喜：在响应窗口中使用（进攻阶段，防御方响应）', () => {
            const runner = createRunner(createQueuedRandom([1, 1, 1, 1, 1]));
            // PLAY_CARD is step 4: ADVANCE+ROLL+CONFIRM+PLAY_CARD
            const result = runner.run({
                name: '惊不惊喜 response-window',
                setup: createSetupWithHand([], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].hand = [{
                            id: 'card-surprise',
                            name: '惊不惊喜？！',
                            type: 'action',
                            cpCost: 2,
                            timing: 'roll',
                            description: '',
                            previewRef: { type: 'atlas', atlasId: DICETHRONE_CARD_ATLAS_IDS.MONK, index: 18 },
                            playCondition: {
                                requireDiceExists: true,
                                requireHasRolled: true,
                            },
                            effects: [{
                                description: '改变任意1颗骰子的数值',
                                action: { type: 'custom', target: 'select', customActionId: 'modify-die-any-1' },
                                timing: 'immediate',
                            }],
                        }];
                        core.players['1'].resources.cp = 10;
                        core.players['0'].hand = [];
                        core.players['0'].deck = [];
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'fist-technique-5' }),
                    cmd('PLAY_CARD', '1', { cardId: 'card-surprise' }),
                    cmd('MODIFY_DIE', '1', { dieId: 0, newValue: 6 }),
                    cmd('SYS_INTERACTION_CONFIRM', '1'),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                    diceValues: [6, 1, 1, 1, 1],
                    pendingInteraction: null,
                    players: { '1': { discardSize: 1 } },
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('拜拜了您内：移除 1 个状态效果', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '拜拜了您内 remove-status',
                setup: createSetupWithHand(['card-bye-bye'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].statusEffects.knockdown = 1;
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-bye-bye' }),
                    // dt:card-interaction 模式：玩家在 InteractionOverlay 中选择状态后确认
                    // Board.tsx 的 handleStatusInteractionConfirm 会 dispatch REMOVE_STATUS
                    cmd('REMOVE_STATUS', '0', { targetPlayerId: '1', statusId: 'knockdown' }),
                ],
                expect: {
                    players: {
                        '1': { statusEffects: { knockdown: 0 } },
                        '0': { discardSize: 1 },
                    },
                    // REMOVE_STATUS 会生成 INTERACTION_COMPLETED 事件清理交互
                    'sys.interaction.current': null,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('拜拜了您内：可以移除以 token 形式存储的赏金', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '拜拜了您内 remove bounty token',
                setup: createSetupWithHand(['card-bye-bye'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].tokens[TOKEN_IDS.BOUNTY] = 1;
                    },
                }),
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-bye-bye' }),
                    cmd('REMOVE_STATUS', '0', { targetPlayerId: '1', statusId: TOKEN_IDS.BOUNTY }),
                ],
                expect: {
                    players: {
                        '1': { tokens: { [TOKEN_IDS.BOUNTY]: 0 } },
                        '0': { discardSize: 1 },
                    },
                    'sys.interaction.current': null,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('起开：选择僧侣气这类多层标记时，只移除 1 层而不是整类清空', () => {
            const runner = createRunner(fixedRandom);
            const result = runner.run({
                name: '起开 remove one taiji token',
                setup: createSetupWithHand(['card-get-away'], {
                    cp: 10,
                    mutate: (core) => {
                        core.players['1'].tokens[TOKEN_IDS.TAIJI] = 5;
                    },
                }),
                commands: [
                    cmd('PLAY_CARD', '0', { cardId: 'card-get-away' }),
                    cmd('REMOVE_STATUS', '0', { targetPlayerId: '1', statusId: TOKEN_IDS.TAIJI }),
                    cmd('SYS_INTERACTION_CONFIRM', '0'),
                ],
                expect: {
                    players: {
                        '1': { tokens: { [TOKEN_IDS.TAIJI]: 4 } },
                        '0': { discardSize: 1 },
                    },
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(getCurrentInteractionSummary(result.finalState).id).toBeUndefined();
        });
    });

    describe('阶段推进防护（状态驱动回归测试）', () => {
        it('loaded 旧奖励骰脏状态在 defensiveRoll 执行 ADVANCE_PHASE 时会先归一化，不再因 dice.map 崩溃', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1]);
            const state = createInitializedState(playerIds, random);

            state.sys.phase = 'defensiveRoll';
            state.core.activePlayerId = '0';
            state.core.rollCount = 1;
            state.core.rollDiceCount = 5;
            state.core.rollConfirmed = true;
            state.core.activatingAbilityId = 'stand-tall';
            state.core.selectedCharacters['0'] = 'ninja' as any;
            state.core.selectedCharacters['1'] = 'samurai' as any;
            state.core.dice = [
                { id: 0, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
                { id: 1, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
                { id: 2, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
                { id: 3, definitionId: 'samurai-dice', value: 1, symbol: 'katana', symbols: ['katana'], isKept: false },
                { id: 4, definitionId: 'samurai-dice', value: 1, symbol: 'katana', symbols: ['katana'], isKept: false },
            ];
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'slash-2-4',
                defenseAbilityId: 'stand-tall',
                isDefendable: true,
                damage: 6,
                preDefenseResolved: true,
                defenseResolved: false,
                damageResolved: false,
                attackDiceValues: [3, 2, 2, 6, 1],
                attackDiceFaceCounts: {
                    ninja_katana: 4,
                    shuriken: 0,
                    mask: 1,
                },
            } as any;
            state.core.pendingBonusDiceSettlement = {
                id: 'legacy-loaded-bonus-settlement',
                sourceAbilityId: 'slash-2-4',
                attackerId: '0',
                targetId: '1',
                dice: { legacy: true } as any,
                rerollCostTokenId: TOKEN_IDS.NINJUTSU,
                rerollCostAmount: 0,
                rerollCount: 0,
                maxRerollCount: 1,
                readyToSettle: false,
            } as any;

            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...cmd('ADVANCE_PHASE', '1'), timestamp: Date.now() } as any,
                random,
                playerIds,
            );

            expect(result.success).toBe(true);
            if (!result.success) {
                expect(result.error?.message).not.toContain('dice.map');
                return;
            }
            expect(result.state.sys.phase).toBe('main2');
            expect(result.state.core.pendingAttack).toBeNull();
        });

        it('authoritative 旧奖励骰脏状态应在 beforeCommand 之前先归一化，避免服务端命令链因 dice.map 崩溃', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1]);
            const state = createInitializedState(playerIds, random);
            const probeShapes: string[] = [];

            state.core.pendingBonusDiceSettlement = {
                id: 'legacy-authoritative-settlement',
                sourceAbilityId: 'slash-2-4',
                attackerId: '0',
                targetId: '1',
                dice: {
                    legacy: true,
                    value: 1,
                    effectKey: 'bonusDie.effect.ninjaNinjutsu',
                } as any,
                displayOnly: true,
                rerollCount: 0,
                readyToSettle: false,
            } as any;
            injectSimpleChoicePrompt(state, {
                id: 'legacy-authoritative-choice',
                playerId: '0',
                title: '测试服务端 authoritative 旧奖励骰 shape',
                options: [
                    {
                        id: 'option-0',
                        label: '继续',
                        value: { continue: true },
                    },
                ],
                sourceId: 'slash-2-4',
            });

            const probeSystem: EngineSystem<any> = {
                id: 'legacy-bonus-dice-before-command-probe',
                name: 'legacy-bonus-dice-before-command-probe',
                priority: -1000,
                beforeCommand: (ctx) => {
                    const dice = (ctx.state.core as any).pendingBonusDiceSettlement?.dice as Array<{ value?: number }>;
                    probeShapes.push(Array.isArray(dice) ? 'array' : 'not-array');
                    dice.map((die) => die?.value ?? 0);
                    return undefined;
                },
            };

            const result = respondToPromptWithSystems(
                state,
                'option-0',
                [probeSystem, ...testSystems],
                '0',
                random,
                playerIds,
            );

            expect(probeShapes).toEqual(['array']);
            expect(result.success).toBe(true);
            if (!result.success) {
                expect(result.error?.message).not.toContain('dice.map');
                return;
            }
            expect(assertState(result.state, { pendingInteraction: null } as DiceThroneExpectation)).toEqual([]);
        });

        it('slash-2-4 在 stand-tall 防御后的 ADVANCE_PHASE 不应抛出 dice.map 异常', () => {
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random: createQueuedRandom([2, 2, 2, 3, 6, 6, 6, 1, 1]),
                setup: createHeroMatchup('ninja', 'samurai', (core) => {
                    core.players['0'].resources[RESOURCE_IDS.CP] = 0;
                    core.players['1'].resources[RESOURCE_IDS.CP] = 0;
                }) as (playerIds: PlayerId[], random: RandomFn) => any,
                assertFn: assertState,
                silent: true,
            });

            const result = runner.run({
                name: 'ninja slash-2-4 vs samurai stand-tall defensive advance regression',
                commands: [
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('ROLL_DICE', '0'),
                    cmd('CONFIRM_ROLL', '0'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '0', { abilityId: 'slash-2-4' }),
                    cmd('ADVANCE_PHASE', '0'),
                    cmd('SELECT_TARGET_OPPONENT_DIE', '0', { dieId: 4 }),
                    cmd('ROLL_DICE', '1'),
                    cmd('CONFIRM_ROLL', '1'),
                    cmd('RESPONSE_PASS', '0'),
                    cmd('RESPONSE_PASS', '1'),
                    cmd('SELECT_ABILITY', '1', { abilityId: 'stand-tall' }),
                    cmd('ADVANCE_PHASE', '1'),
                ],
                expect: {
                    turnPhase: 'main2',
                    pendingInteraction: null,
                },
            });

            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.sys.phase).toBe('main2');
            expect(result.finalState.core.pendingAttack).toBeNull();
        });

        it('最小 defensiveRoll 夹具执行 ADVANCE_PHASE 时不应抛出 dice.map 异常', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1]);
            const state = createInitializedState(playerIds, random);

            state.sys.phase = 'defensiveRoll';
            state.core.activePlayerId = '0';
            state.core.rollCount = 1;
            state.core.rollDiceCount = 3;
            state.core.rollConfirmed = true;
            state.core.activatingAbilityId = 'stand-tall';
            state.core.selectedCharacters['0'] = 'ninja' as any;
            state.core.selectedCharacters['1'] = 'samurai' as any;
            state.core.dice = [
                { id: 0, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
                { id: 1, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
                { id: 2, definitionId: 'samurai-dice', value: 6, symbol: 'rising_sun', symbols: ['rising_sun'], isKept: false },
                { id: 3, definitionId: 'samurai-dice', value: 1, symbol: 'katana', symbols: ['katana'], isKept: false },
                { id: 4, definitionId: 'samurai-dice', value: 1, symbol: 'katana', symbols: ['katana'], isKept: false },
            ];
            state.core.pendingAttack = {
                attackerId: '0',
                defenderId: '1',
                sourceAbilityId: 'slash-2-4',
                defenseAbilityId: 'stand-tall',
                isDefendable: true,
                damage: 6,
                preDefenseResolved: true,
                defenseResolved: false,
                damageResolved: false,
                attackDiceValues: [3, 2, 2, 6, 1],
                attackDiceFaceCounts: {
                    ninja_katana: 4,
                    shuriken: 0,
                    mask: 1,
                },
            } as any;

            const result = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...cmd('ADVANCE_PHASE', '1'), timestamp: Date.now() } as any,
                random,
                playerIds,
            );

            expect(result.success).toBe(true);
            if (!result.success) {
                expect(result.error?.message).not.toContain('dice.map');
                return;
            }
            expect(result.state.sys.phase).toBe('main2');
        });

        it('旧 pendingBonusDiceSettlement 脏 dice shape 下跳过奖励骰结算不应因 reduce/map 崩溃', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1]);
            const state = createInitializedState(playerIds, random);

            state.core.pendingBonusDiceSettlement = {
                id: 'legacy-settlement',
                sourceAbilityId: 'ninja-going-forward-2',
                attackerId: '0',
                targetId: '1',
                dice: { legacy: true } as any,
                rerollCostTokenId: TOKEN_IDS.NINJUTSU,
                rerollCostAmount: 0,
                rerollCount: 0,
                maxRerollCount: 1,
                readyToSettle: false,
            } as any;

            const skipResult = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...cmd('SKIP_BONUS_DICE_REROLL', '0'), timestamp: Date.now() } as any,
                random,
                playerIds,
            );

            expect(skipResult.success).toBe(true);

            const rerollResult = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                state,
                { ...cmd('REROLL_BONUS_DIE', '0', { dieIndex: 0 }), timestamp: Date.now() } as any,
                random,
                playerIds,
            );

            expect(rerollResult.success).toBe(false);
            if (!rerollResult.success) {
                expect(rerollResult.error).toBe('no_pending_bonus_dice');
            }
        });

        it('slash-2-4 在 still-wet-behind-ears 防御后的忍术选择收口不应因 auto-continue 抛出 dice.map 异常', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1]);
            const state = createHeroMatchup('cursed_pirate', 'ninja')(
                playerIds,
                random,
            ) as ReturnType<ReturnType<typeof createHeroMatchup>>;

            state.sys.phase = 'defensiveRoll';
            state.sys.flowHalted = true;
            state.core.activePlayerId = '1';
            state.core.rollCount = 1;
            state.core.rollDiceCount = 5;
            state.core.rollConfirmed = true;
            state.core.activatingAbilityId = 'still-wet-behind-ears';
            state.core.currentChoiceSourceAbilityId = 'slash-2-4';
            state.core.dice = [
                { id: 0, definitionId: 'cursed-pirate-dice', value: 1, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
                { id: 1, definitionId: 'cursed-pirate-dice', value: 2, symbol: 'loot', symbols: ['loot'], isKept: false },
                { id: 2, definitionId: 'cursed-pirate-dice', value: 3, symbol: 'skull', symbols: ['skull'], isKept: false },
                { id: 3, definitionId: 'cursed-pirate-dice', value: 1, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
                { id: 4, definitionId: 'cursed-pirate-dice', value: 3, symbol: 'skull', symbols: ['skull'], isKept: false },
            ] as any;
            state.core.pendingAttack = {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'slash-2-4',
                defenseAbilityId: 'still-wet-behind-ears',
                isDefendable: true,
                damage: 6,
                preDefenseResolved: true,
                defenseResolved: true,
                damageResolved: true,
                resolvedDamage: 7,
                bonusDamage: 1,
                extraRoll: { value: 6, resolved: true },
                attackDiceValues: [1, 4, 1, 1, 3],
                attackDiceFaceCounts: {
                    ninja_katana: 3,
                    shuriken: 1,
                    mask: 1,
                },
            } as any;
            state.core.pendingBonusDiceSettlement = {
                id: 'slash-2-4-display-only-bonus',
                sourceAbilityId: 'slash-2-4',
                attackerId: '1',
                targetId: '1',
                dice: [{
                    index: 0,
                    value: 1,
                    face: 'ninja_katana',
                    effectKey: 'bonusDie.effect.ninjaNinjutsu',
                    effectParams: { value: 1, bonusDamage: 1 },
                }],
                displayOnly: true,
                rerollCount: 0,
                readyToSettle: false,
            } as any;
            injectSimpleChoicePrompt(state, {
                id: 'choice-slash-2-4-1780306943689',
                playerId: '1',
                title: 'choices.ninjaNinjutsu.title',
                options: [
                    {
                        id: 'option-0',
                        label: 'choices.ninjaNinjutsu.poison',
                        value: { value: 1, customId: 'ninja-ninjutsu-poison', labelKey: 'choices.ninjaNinjutsu.poison' },
                    },
                    {
                        id: 'option-1',
                        label: 'choices.ninjaNinjutsu.undefendable',
                        value: { value: 1, customId: 'ninja-ninjutsu-undefendable', labelKey: 'choices.ninjaNinjutsu.undefendable' },
                    },
                ],
                sourceId: 'slash-2-4',
            });

            const result = respondToPrompt(state, 'option-0', '1', random, playerIds);

            expect(result.success).toBe(true);
            if (!result.success) {
                expect(result.error?.message).not.toContain('dice.map');
                return;
            }
            expect(result.state.sys.phase).toBe('defensiveRoll');
            expect(result.state.core.pendingAttack).not.toBeNull();
            const settled = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                result.state,
                { ...cmd('SKIP_BONUS_DICE_REROLL', '1'), timestamp: Date.now() } as any,
                random,
                playerIds,
            );
            expect(settled.success).toBe(true);
            if (settled.success) {
                expect(settled.state.sys.phase).toBe('main2');
                expect(settled.state.core.pendingAttack).toBeNull();
                expect(settled.state.core.pendingBonusDiceSettlement).toBeUndefined();
            }
        });

        it('线上反馈 6a1d5440：defensiveRoll 下 SYS_INTERACTION_RESPOND 处理忍术选择时不应再抛出 dice.map 异常', () => {
            const playerIds: PlayerId[] = ['0', '1'];
            const random = createQueuedRandom([1]);
            const state = createHeroMatchup('cursed_pirate', 'ninja')(
                playerIds,
                random,
            ) as ReturnType<ReturnType<typeof createHeroMatchup>>;

            state.sys.phase = 'defensiveRoll';
            state.sys.turnNumber = 0;
            state.sys.flowHalted = true;
            state.core.activePlayerId = '1';
            state.core.turnNumber = 2;
            state.core.rollCount = 1;
            state.core.rollLimit = 1;
            state.core.rollDiceCount = 5;
            state.core.rollConfirmed = true;
            state.core.activatingAbilityId = 'still-wet-behind-ears';
            state.core.currentChoiceSourceAbilityId = 'slash-2-4';
            state.core.dice = [
                { id: 0, definitionId: 'cursed_pirate-dice', value: 2, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
                { id: 1, definitionId: 'cursed_pirate-dice', value: 5, symbol: 'loot', symbols: ['loot'], isKept: false },
                { id: 2, definitionId: 'cursed_pirate-dice', value: 2, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
                { id: 3, definitionId: 'cursed_pirate-dice', value: 5, symbol: 'loot', symbols: ['loot'], isKept: false },
                { id: 4, definitionId: 'cursed_pirate-dice', value: 2, symbol: 'cutlass', symbols: ['cutlass'], isKept: false },
            ] as any;
            state.core.pendingAttack = {
                attackerId: '1',
                defenderId: '0',
                sourceAbilityId: 'slash-2-4',
                defenseAbilityId: 'still-wet-behind-ears',
                isDefendable: true,
                damageResolved: true,
                resolvedDamage: 7,
                bonusDamage: 1,
                attackModifierBonusDamage: 1,
                preDefenseResolved: true,
                defenseResolved: true,
                extraRoll: { value: 6, resolved: true },
                attackDiceValues: [1, 4, 1, 1, 3],
                attackDiceFaceCounts: {
                    fist: 0,
                    palm: 0,
                    taiji: 0,
                    lotus: 0,
                    sword: 0,
                    heart: 0,
                    strength: 0,
                    branch: 0,
                    leaf: 0,
                    spirit: 0,
                    ninja_katana: 4,
                    shuriken: 1,
                    mask: 0,
                },
            } as any;
            state.core.pendingBonusDiceSettlement = {
                id: 'slash-2-4-display-1780306943159',
                sourceAbilityId: 'slash-2-4',
                attackerId: '1',
                targetId: '0',
                dice: [{
                    index: 0,
                    value: 1,
                    face: 'ninja_katana',
                    effectKey: 'bonusDie.effect.ninjaNinjutsu',
                    effectParams: { value: 1, bonusDamage: 1 },
                }],
                rerollCostTokenId: '',
                rerollCostAmount: 0,
                rerollCount: 0,
                maxRerollCount: 0,
                readyToSettle: false,
                displayOnly: true,
                summaryEffectKey: 'bonusDie.effect.ninjaNinjutsuResult',
                summaryEffectParams: { value: 1, bonusDamage: 1 },
            } as any;
            injectSimpleChoicePrompt(state, {
                id: 'choice-slash-2-4-1780306943689',
                playerId: '1',
                title: 'choices.ninjaNinjutsu.title',
                options: [
                    {
                        id: 'option-0',
                        label: 'choices.ninjaNinjutsu.poison',
                        value: { value: 1, customId: 'ninja-ninjutsu-poison', labelKey: 'choices.ninjaNinjutsu.poison' },
                    },
                    {
                        id: 'option-1',
                        label: 'choices.ninjaNinjutsu.undefendable',
                        value: { value: 1, customId: 'ninja-ninjutsu-undefendable', labelKey: 'choices.ninjaNinjutsu.undefendable' },
                    },
                ],
                sourceId: 'slash-2-4',
            });

            const result = respondToPrompt(state, 'option-0', '1', random, playerIds);

            expect(result.success).toBe(true);
            if (!result.success) {
                expect(result.error?.message).not.toContain('dice.map');
                return;
            }
            expect(result.state.sys.phase).toBe('defensiveRoll');
            expect(result.state.core.pendingAttack).not.toBeNull();
            const settled = executePipeline(
                { domain: DiceThroneDomain, systems: testSystems },
                result.state,
                { ...cmd('SKIP_BONUS_DICE_REROLL', '1'), timestamp: Date.now() } as any,
                random,
                playerIds,
            );
            expect(settled.success).toBe(true);
            if (settled.success) {
                expect(settled.state.sys.phase).toBe('main2');
                expect(settled.state.core.pendingAttack).toBeNull();
                expect(settled.state.core.pendingBonusDiceSettlement).toBeUndefined();
            }
        });

        it('main1 阶段 BONUS_DICE_SETTLED 不触发阶段推进', () => {
            // 模拟卡牌效果在 main1 触发奖励骰重掷交互，结算后阶段应停留在 main1
            const random = createQueuedRandom([1, 1, 1, 1, 1]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedState(playerIds, r);
                    // 注入 pendingBonusDiceSettlement（模拟卡牌效果产生的奖励骰）
                    state.core.pendingBonusDiceSettlement = {
                        id: 'test-bonus-dice-main1',
                        sourceAbilityId: 'test-card-effect',
                        attackerId: '0',
                        targetId: '1',
                        dice: [{ index: 0, value: 3, face: 'fist' }],
                        rerollCostTokenId: TOKEN_IDS.TAIJI,
                        rerollCostAmount: 2,
                        rerollCount: 0,
                        readyToSettle: false,
                    };
                    // 注入 dt:bonus-dice 交互（模拟 DiceThrone event system 创建的交互）
                    state.sys.interaction = {
                        ...state.sys.interaction,
                        current: {
                            id: 'dt-bonus-dice-test-bonus-dice-main1',
                            kind: 'dt:bonus-dice',
                            playerId: '0',
                            data: state.core.pendingBonusDiceSettlement,
                        },
                    };
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'main1 奖励骰结算不推进阶段',
                commands: [
                    cmd('SKIP_BONUS_DICE_REROLL', '0'),
                ],
                expect: {
                    turnPhase: 'main1',
                    pendingBonusDiceSettlement: null,
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('main2 阶段 CHOICE_RESOLVED 不触发阶段推进', () => {
            // 模拟卡牌效果在 main2 触发选择交互，选择解决后阶段应停留在 main2
            const random = fixedRandom;
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand(['card-buddha-light'], {
                    cp: 10,
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'main2 阶段打出卡牌后不自动推进',
                commands: [
                    ...advanceTo('main2'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-buddha-light' }),
                ],
                expect: {
                    turnPhase: 'main2',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('offensiveRoll 阶段打出大吉大利（instant 卡）不触发阶段推进', () => {
            // 场景：玩家在 offensiveRoll 阶段打出"大吉大利"（card-lucky），
            // 卡牌效果只产生治疗与奖励骰事件，不再创建 displayOnly settlement，
            // 阶段应停留在 offensiveRoll，不应自动推进
            const random = createQueuedRandom([
                // card-lucky 的 handleLuckyRollHeal 需要 3 次 d(6)
                3, 3, 3,
                1, 1, 1, 1, 1, // 额外随机数缓冲
            ]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: createSetupWithHand([], {
                    cp: 0,
                    mutate: (core) => {
                        // 手动注入野蛮人的"大吉大利"卡牌到玩家0手牌
                        const luckyCard = BARBARIAN_CARDS.find(c => c.id === 'card-lucky');
                        if (luckyCard) {
                            core.players['0'].hand.push(JSON.parse(JSON.stringify(luckyCard)));
                        }
                    },
                }),
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'offensiveRoll 打出大吉大利不推进阶段',
                commands: [
                    ...advanceTo('offensiveRoll'),
                    cmd('PLAY_CARD', '0', { cardId: 'card-lucky' }),
                ],
                expect: {
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
        });

        it('flowHalted=true 状态下打出大吉大利会挂起父奖励骰并在普通确认后恢复', () => {
            // 场景：攻击结算产生 BONUS_DICE_REROLL_REQUESTED → halt → flowHalted=true
            // 此时玩家打出"大吉大利"（instant 卡），新的奖励骰必须显式挂起当前攻击奖励骰，
            // 阶段应停留在 offensiveRoll；大吉大利确认后恢复父奖励骰，不能丢失原攻击收口。
            const random = createQueuedRandom([
                // card-lucky 的 handleLuckyRollHeal 需要 3 次 d(6)
                3, 3, 3,
                1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 额外随机数缓冲
            ]);
            const runner = new GameTestRunner({
                domain: DiceThroneDomain,
                systems: testSystems,
                playerIds: ['0', '1'],
                random,
                setup: (playerIds: PlayerId[], r: RandomFn) => {
                    const state = createInitializedState(playerIds, r);
                    // 模拟攻击结算 halt 后的状态：
                    // 0. 阶段设为 offensiveRoll
                    state.sys.phase = 'offensiveRoll';
                    // 1. flowHalted=true（攻击结算 halt 设置）
                    state.sys.flowHalted = true;
                    // 2. 攻击的 bonus dice interaction 在 current
                    state.sys.interaction = {
                        ...state.sys.interaction,
                        current: {
                            id: 'dt-bonus-dice-attack-thunder',
                            kind: 'dt:bonus-dice',
                            playerId: '0',
                            data: null,
                        },
                    };
                    // 3. 注入攻击的 pendingBonusDiceSettlement
                    state.core.pendingBonusDiceSettlement = {
                        id: 'attack-thunder-bonus',
                        sourceAbilityId: 'thunder-strike',
                        attackerId: '0',
                        targetId: '1',
                        dice: [{ index: 0, value: 5, face: 'fist' }, { index: 1, value: 3, face: 'heart' }],
                        rerollCostTokenId: TOKEN_IDS.TAIJI,
                        rerollCostAmount: 1,
                        rerollCount: 0,
                        readyToSettle: false,
                    };
                    // 4. 注入"大吉大利"卡牌到手牌
                    const luckyCard = BARBARIAN_CARDS.find(c => c.id === 'card-lucky');
                    if (luckyCard) {
                        state.core.players['0'].hand.push(JSON.parse(JSON.stringify(luckyCard)));
                    }
                    return state;
                },
                assertFn: assertState,
                silent: true,
            });
            const result = runner.run({
                name: 'flowHalted + 大吉大利不误推进',
                commands: [
                    // 打出"大吉大利"（instant 卡，不被 dt:bonus-dice interaction 阻塞）
                    cmd('PLAY_CARD', '0', { cardId: 'card-lucky' }),
                ],
                expect: {
                    // 阶段应停留在 offensiveRoll（攻击的 bonus dice 还未处理）
                    turnPhase: 'offensiveRoll',
                },
            });
            expect(result.assertionErrors).toEqual([]);
            expect(result.finalState.core.pendingBonusDiceSettlement?.sourceAbilityId).toBe('card-lucky');
            expect(result.finalState.core.pendingBonusDiceSettlement?.suspendedParentSettlement?.id).toBe('attack-thunder-bonus');
            expect(result.finalState.sys.phase).toBe('offensiveRoll');

            runner.setState(result.finalState);
            const luckyConfirmed = runner.dispatch('SKIP_BONUS_DICE_REROLL', { playerId: '0' });
            expect(luckyConfirmed.success).toBe(true);
            expect(luckyConfirmed.finalState.core.pendingBonusDiceSettlement?.id).toBe('attack-thunder-bonus');
            expect(luckyConfirmed.finalState.core.pendingBonusDiceSettlement?.suspendedParentSettlement).toBeUndefined();
            expect(luckyConfirmed.finalState.sys.phase).toBe('offensiveRoll');
        });
    });
});
