import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import {
    buildAiProgressMarker,
    resolveCurrentPlayerId,
    resolveForceEndTurnForStalledAi,
    resolveOnlineAiCurrentPlayerId,
} from '../onlineAiRecovery';
import { createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import * as aiModule from '../../ai';
import diceThroneEngineConfig from '../../../games/dicethrone/game';
import { createHeroMatchup, createQueuedRandom } from '../../../games/dicethrone/__tests__/test-utils';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfig,
    createEngineConfigWithId,
    createOnlineAiRecoveryMetadata,
    createOnlineAiRecoveryState,
    nextTick,
} from './helpers/serverTestHarness';

describe('online AI watchdog DiceThrone recovery', () => {
    it('dicethrone: defensiveRoll 存在 displayOnly pendingBonusDiceSettlement 时，watchdog 仍应按防御合法动作推进，而不是误打 bonus-die 命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';

        await storage.createMatch('match-watchdog-dicethrone-displayonly-bonus-settlement', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'monk',
                            '1': 'shadow_thief',
                        },
                        rollCount: 0,
                        rollLimit: 1,
                        rollDiceCount: 0,
                        dice: [],
                        rollConfirmed: false,
                        pendingAttack: {
                            attackerId: '0',
                            defenderId: '1',
                            isDefendable: true,
                            sourceAbilityId: 'fist-technique-5',
                            defenseAbilityId: 'shadow-defense',
                        },
                        pendingBonusDiceSettlement: {
                            id: 'display-only-bonus-1',
                            attackerId: '1',
                            displayOnly: true,
                            dice: [{ index: 0, value: 4, originalValue: 4, rerolled: false }],
                        },
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-bonus-settlement-step-1',
                    source: 'local-ai',
                    action: {
                        actionId: 'roll:dice',
                        kind: 'roll-dice',
                        label: '掷骰',
                        commands: [{ type: 'ROLL_DICE', payload: {} }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-bonus-settlement-step-2',
                    source: 'local-ai',
                    action: {
                        actionId: 'roll:confirm',
                        kind: 'confirm-roll',
                        label: '确认骰面',
                        commands: [{ type: 'CONFIRM_ROLL', payload: {} }],
                        metadata: { rollConfirmScope: 'main-roll' },
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-bonus-settlement-step-3',
                    source: 'local-ai',
                    action: {
                        actionId: 'phase:advance',
                        kind: 'advance-phase',
                        label: '结束防御阶段',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle' as const,
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-displayonly-bonus-settlement');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'ROLL_DICE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollCount: 1,
                        rollDiceCount: 4,
                        dice: [
                            { id: 0, value: 1 },
                            { id: 1, value: 2 },
                            { id: 2, value: 3 },
                            { id: 3, value: 4 },
                        ],
                        rollConfirmed: false,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 2 },
                    },
                };
                return true;
            }

            if (commandType === 'CONFIRM_ROLL') {
                activeMatch.state = {
                    ...activeMatch.state,
                    core: {
                        ...activeMatch.state.core,
                        rollConfirmed: true,
                    },
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                    },
                };
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        phase: 'main2',
                        eventStream: { nextId: 4 },
                    },
                };
                return true;
            }

            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            const executed = executeSpy.mock.calls.map(([, , commandType]) => commandType);
            expect(executed).toContain('ADVANCE_PHASE');
            expect(executed).not.toContain('REROLL_BONUS_DIE');
            expect(executed).not.toContain('SKIP_BONUS_DICE_REROLL');
            expect(match.state.sys.phase).toBe('main2');
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('dicethrone: displayOnly pendingBonusDiceSettlement 遇到响应窗口 + 交互链时，watchdog 应持续收口且不误打 bonus-die 命令', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';

        await storage.createMatch('match-watchdog-dicethrone-displayonly-response-chain', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 50, maxHp: 50, combatPoints: 0, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'monk',
                            '1': 'shadow_thief',
                        },
                        pendingAttack: {
                            attackerId: '0',
                            defenderId: '1',
                            isDefendable: true,
                            sourceAbilityId: 'fist-technique-5',
                            defenseAbilityId: 'shadow-defense',
                        },
                        pendingBonusDiceSettlement: {
                            id: 'display-only-bonus-chain-1',
                            attackerId: '1',
                            displayOnly: true,
                            dice: [{ index: 0, value: 4, originalValue: 4, rerolled: false }],
                        },
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: createSimpleChoice(
                                'dt-response-choice-1',
                                '1',
                                '处理展示态后的响应',
                                [{
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                }],
                                {
                                    sourceId: 'dt_displayonly_chain',
                                    targetType: 'button',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: {
                                id: 'dt-response-window-1',
                                windowType: 'afterRollConfirmed',
                                sourceId: 'card-give-hand',
                                responderQueue: ['0', '1'],
                                currentResponderIndex: 1,
                                passedPlayers: [],
                            },
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-response-chain-step-1',
                    source: 'local-ai',
                    action: {
                        actionId: 'interaction:dt-response-choice-1:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'dt-response-choice-1', optionId: 'pass' },
                        }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-response-chain-step-2',
                    source: 'local-ai',
                    action: {
                        actionId: 'interaction:dt-card:select-player',
                        kind: 'interaction-select-player',
                        label: '选择目标',
                        commands: [{
                            type: 'RESOLVE_INTERACTION',
                            payload: { selectedPlayerIds: ['0'] },
                        }],
                    },
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'dt-displayonly-response-chain-step-3',
                    source: 'local-ai',
                    action: {
                        actionId: 'interaction:dt-response-choice-2:pass',
                        kind: 'interaction-choice',
                        label: 'Pass again',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'dt-response-choice-2', optionId: 'pass' },
                        }],
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle' as const,
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-displayonly-response-chain');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'SYS_INTERACTION_RESPOND') {
                const currentInteractionId = (activeMatch.state.sys?.interaction?.current as { id?: string } | undefined)?.id;
                if (currentInteractionId === 'dt-response-choice-1') {
                    expect(payload).toEqual({ interactionId: 'dt-response-choice-1', optionId: 'pass' });
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            eventStream: { nextId: 2 },
                            interaction: {
                                current: {
                                    id: 'dt-card-interaction-1',
                                    playerId: '1',
                                    sourceCardId: 'card-give-hand',
                                    type: 'selectPlayer',
                                    titleKey: 'interaction.selectPlayer',
                                    selectCount: 1,
                                    selected: [],
                                    targetPlayerIds: ['0'],
                                },
                                queue: [],
                                isBlocked: false,
                            },
                        },
                    };
                    return true;
                }

                if (currentInteractionId === 'dt-response-choice-2') {
                    expect(payload).toEqual({ interactionId: 'dt-response-choice-2', optionId: 'pass' });
                    activeMatch.state = {
                        ...activeMatch.state,
                        sys: {
                            ...activeMatch.state.sys,
                            phase: 'main2',
                            eventStream: { nextId: 4 },
                            interaction: {
                                current: undefined,
                                queue: [],
                                isBlocked: false,
                            },
                            responseWindow: {
                                current: undefined,
                            },
                        },
                    };
                    return true;
                }
            }

            if (commandType === 'RESOLVE_INTERACTION') {
                expect(payload).toEqual({ selectedPlayerIds: ['0'] });
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        eventStream: { nextId: 3 },
                        interaction: {
                            current: createSimpleChoice(
                                'dt-response-choice-2',
                                '1',
                                '交互后续响应',
                                [{
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                }],
                                {
                                    sourceId: 'dt_displayonly_chain_followup',
                                    targetType: 'button',
                                },
                            ),
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: {
                                id: 'dt-response-window-2',
                                windowType: 'afterCardPlayed',
                                sourceId: 'card-give-hand',
                                responderQueue: ['1'],
                                currentResponderIndex: 0,
                                passedPlayers: [],
                            },
                        },
                    },
                };
                return true;
            }

            throw new Error(`Unexpected command: ${String(commandType)}`);
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            for (let i = 0; i < 10; i++) { await nextTick(); }

            const executed = executeSpy.mock.calls.map(([, , commandType]) => commandType);
            expect(executed).toEqual([
                'SYS_INTERACTION_RESPOND',
                'RESOLVE_INTERACTION',
                'SYS_INTERACTION_RESPOND',
            ]);
            expect(executed).not.toContain('REROLL_BONUS_DIE');
            expect(executed).not.toContain('SKIP_BONUS_DICE_REROLL');
            expect(match.state.sys.phase).toBe('main2');
            expect(match.state.sys.responseWindow?.current).toBeUndefined();
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(match.state.core.pendingBonusDiceSettlement).toMatchObject({
                id: 'display-only-bonus-chain-1',
                displayOnly: true,
            });
            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('dicethrone: defensiveRoll 当前奖励骰属于真人攻击方时，watchdog 不应对 AI 防御方强推阶段', () => {
        const state = {
            core: {
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                players: {
                    '0': { characterId: 'shadow_thief' },
                    '1': { characterId: 'samurai' },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'pickpocket-2',
                    defenseAbilityId: 'stand-tall',
                },
                pendingBonusDiceSettlement: {
                    id: 'shadow-thief-sneak-attack-display-test',
                    sourceAbilityId: 'shadow-thief-sneak-attack',
                    attackerId: '0',
                    targetId: '1',
                    dice: [{ index: 0, value: 3, face: 'bag' }],
                    displayOnly: true,
                    continuation: { kind: 'complete' },
                    customResolutionId: 'shadow-thief-sneak-attack',
                },
                currentRollContext: {
                    id: 'bonus:shadow-thief-sneak-attack-display-test',
                    kind: 'bonus',
                    ownerPlayerId: '0',
                    targetPlayerId: '1',
                    dice: [{ id: 0, value: 3, ownerId: '0', displayOnly: true }],
                    status: 'open',
                    policy: { blocksPhaseFlow: true },
                    display: { replayOnly: false },
                    suspendedParent: {
                        id: 'roll:defensive:1:1',
                        kind: 'defensive',
                        ownerPlayerId: '1',
                        phase: 'defensiveRoll',
                        status: 'settling',
                        policy: { blocksPhaseFlow: true },
                        display: { replayOnly: false },
                    },
                },
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 4,
                eventStream: { nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        } as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: state,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: createEngineConfigWithId('dicethrone'),
            gameId: 'dicethrone',
        });

        expect(resolveOnlineAiCurrentPlayerId(state, {
            engineConfig: createEngineConfigWithId('dicethrone'),
            gameId: 'dicethrone',
        })).toBe('0');
        expect(candidate).toBeNull();
    });
    it('dicethrone: defensiveRoll 当前 displayOnly 奖励骰属于 AI 时，watchdog 应先替骰主确认收口', () => {
        const state = {
            core: {
                activePlayerId: '0',
                currentPlayerIndex: 0,
                turnOrder: ['0', '1'],
                players: {
                    '0': { characterId: 'shadow_thief' },
                    '1': { characterId: 'samurai' },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'pickpocket-2',
                    defenseAbilityId: 'stand-tall',
                },
                pendingBonusDiceSettlement: {
                    id: 'samurai-display-bonus-test',
                    attackerId: '1',
                    targetId: '0',
                    dice: [{ index: 0, value: 4, face: 'katana' }],
                    displayOnly: true,
                },
                currentRollContext: {
                    id: 'bonus:samurai-display-bonus-test',
                    kind: 'bonus',
                    ownerPlayerId: '1',
                    dice: [{ id: 0, value: 4, ownerId: '1', displayOnly: true }],
                    status: 'open',
                    policy: { blocksPhaseFlow: true },
                    display: { replayOnly: false },
                },
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 4,
                eventStream: { nextId: 1 },
                interaction: { current: undefined, queue: [], isBlocked: false },
                responseWindow: { current: undefined },
            },
        } as any;

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: state,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: createEngineConfigWithId('dicethrone'),
            gameId: 'dicethrone',
        });

        expect(candidate?.reason).toBe('seat-legal-only');
        expect(candidate?.playerId).toBe('1');
        expect(candidate?.resolution.action.commands).toEqual([{ type: 'CONFIRM_ROLL', payload: {} }]);
    });
    it('dicethrone: human main1 遗留 AI displayOnly pendingBonusDiceSettlement 时，watchdog 应直接替 AI 确认收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';
        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'idle',
            idleReason: 'no-action',
        });

        await storage.createMatch('match-watchdog-dicethrone-orphan-displayonly-main1', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hp: 28, maxHp: 50, combatPoints: 3, statusEffects: {}, tokens: {}, hand: [], deck: [], discardPile: [] },
                            '1': { hp: 29, maxHp: 50, combatPoints: 2, statusEffects: {}, tokens: { loaded: 1 }, hand: [], deck: [], discardPile: [] },
                        },
                        selectedCharacters: {
                            '0': 'shadow_thief',
                            '1': 'gunslinger',
                        },
                        pendingAttack: undefined,
                        pendingBonusDiceSettlement: {
                            id: 'bounty-hunter-display-1777712668078',
                            sourceAbilityId: 'bounty-hunter',
                            attackerId: '1',
                            targetId: '0',
                            dice: [{
                                index: 0,
                                value: 6,
                                face: 'bullseye',
                                effectKey: 'bonusDie.effect.gunslingerLoadedDie',
                                effectParams: {
                                    value: 6,
                                    index: 0,
                                    bonusDamage: 3,
                                },
                            }],
                            rerollCostTokenId: '',
                            rerollCostAmount: 0,
                            rerollCount: 0,
                            maxRerollCount: 0,
                            readyToSettle: false,
                            displayOnly: true,
                        },
                    },
                    sys: {
                        phase: 'main1',
                        turnNumber: 9,
                        eventStream: { nextId: 18 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-orphan-displayonly-main1');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('CONFIRM_ROLL');

            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    pendingBonusDiceSettlement: undefined,
                },
                sys: {
                    ...activeMatch.state.sys,
                    eventStream: { nextId: 19 },
                },
            };
            return true;
        });

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(([, , commandType]) => commandType)).toEqual([
                'CONFIRM_ROLL',
            ]);
            expect(match.state.core.pendingBonusDiceSettlement).toBeUndefined();
            expect(match.state.sys.phase).toBe('main1');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-dicethrone-orphan-displayonly-main1',
                gameId,
                playerId: '1',
                status: 'resolved',
            }));
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('dicethrone: human active main2 时 watchdog 不应触发 seat-legal-only 代打推进', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'dicethrone';
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                source: 'local-ai',
                action: {
                    actionId: 'ai-main2-advance',
                    kind: 'advance-phase',
                    label: 'AI 主阶段推进',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        } as any);

        await storage.createMatch('match-watchdog-dicethrone-human-main2-no-legal-only', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 5,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-dicethrone-human-main2-no-legal-only');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolveDispatchSpy).not.toHaveBeenCalled();
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolveDispatchSpy.mockRestore();
        }
    });
    it('通用: human active 且非 defensiveRoll 阶段时，watchdog 不应尝试 seat-legal-only 代打', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'smashup';
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                source: 'local-ai',
                action: {
                    actionId: 'ai-playcards-advance',
                    kind: 'advance-phase',
                    label: 'AI 推进阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        } as any);

        await storage.createMatch('match-watchdog-generic-human-active-no-legal-only', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'playCards',
                        turnNumber: 5,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-generic-human-active-no-legal-only');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolveDispatchSpy).not.toHaveBeenCalled();
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolveDispatchSpy.mockRestore();
        }
    });
    it('cardia: human active play 阶段时，watchdog 不应触发 seat-legal-only 代打', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'cardia';
        const resolveDispatchSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch').mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                source: 'local-ai',
                action: {
                    actionId: 'ai-play-advance',
                    kind: 'advance-phase',
                    label: 'AI 推进阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        } as any);

        await storage.createMatch('match-watchdog-cardia-human-active-play-no-legal-only', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '0',
                        currentPlayerIndex: 0,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'play',
                        turnNumber: 1,
                        eventStream: { nextId: 21 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: gameId,
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-cardia-human-active-play-no-legal-only');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        try {
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(resolveDispatchSpy).not.toHaveBeenCalled();
            expect(executeSpy).not.toHaveBeenCalled();
            expect(feedbackReporter).not.toHaveBeenCalled();
        } finally {
            resolveDispatchSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 defensiveRoll 实际由 human 防御方行动时，不应误对 AI 攻击方执行 force-end-turn', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-defensive-human-actor', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        rollCount: 0,
                        rollLimit: 2,
                        rollConfirmed: false,
                        pendingAttack: {
                            attackerId: '1',
                            defenderId: '0',
                            isDefendable: true,
                            sourceAbilityId: 'test-attack',
                        },
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 3,
                        eventStream: { nextId: 69 },
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                },
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('dicethrone')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        await serverInternal.loadMatch('match-watchdog-defensive-human-actor');
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

        await serverInternal.runOnlineAiRecoveryTick();
        await serverInternal.runOnlineAiRecoveryTick();
        await nextTick();

        expect(executeSpy).not.toHaveBeenCalled();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE，避免把真人/AI 防御方误拒成 not_active_player', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const random = createQueuedRandom([2, 2, 2, 3, 6, 6, 6, 1, 1]);
        const state = createHeroMatchup('ninja', 'samurai')(['0', '1'], random);

        state.sys.phase = 'defensiveRoll';
        state.core.activePlayerId = '0';
        state.core.currentPlayerIndex = 0;
        state.core.rollCount = 1;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 3;
        state.core.rollConfirmed = true;
        state.core.activatingAbilityId = 'stand-tall';
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

        await storage.createMatch('match-dicethrone-defensive-advance-server', {
            initialState: {
                G: state,
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                },
            }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [diceThroneEngineConfig],
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-dicethrone-defensive-advance-server');
        const success = await serverInternal.executeCommandInternal(match, '1', 'ADVANCE_PHASE', {});

        expect(success).toBe(true);
        expect(match.lastCommandFailureReason).toBeNull();
        expect(match.state.sys.phase).toBe('main2');
        expect(match.state.core.pendingAttack).toBeNull();
    });
    it('Dice Throne watchdog 在 defensiveRoll 实际操作者是 AI 防御方时，legal-only fallback 的 ADVANCE_PHASE 不应再被通用 current player guard 误拦', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const random = createQueuedRandom([2, 2, 2, 3, 6, 6, 6, 1, 1]);
        const state = createHeroMatchup('ninja', 'samurai')(['0', '1'], random);

        state.sys.phase = 'defensiveRoll';
        state.core.activePlayerId = '0';
        state.core.currentPlayerIndex = 0;
        state.core.rollCount = 1;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 3;
        state.core.rollConfirmed = true;
        state.core.activatingAbilityId = 'stand-tall';
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

        await storage.createMatch('match-watchdog-dicethrone-defensive-advance-fallback', {
            initialState: {
                G: state,
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'dicethrone' }),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [diceThroneEngineConfig],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoverySequence: (
                match: any,
                tracker: any,
                candidate: any,
                progressMarkerBeforeRecovery: string,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<void>;
            tryRecoverOnlineAiWithLegalAction: (
                match: any,
                candidate: any,
                tracker: any,
                seatControllers: any,
            ) => Promise<{
                applied: boolean;
                resolved: boolean;
                blockedReason: 'missing-visible-state' | 'missing-private-overlay' | 'stale-private-overlay' | null;
                executedCommandTypes: string[];
                outcome: 'applied' | 'blocked' | 'no-legal-action' | 'legal-action-command-failed';
            }>;
            resolveOnlineAiRecoveryCandidate: (
                match: any,
                seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai' }>,
            ) => Promise<any>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
            ) => Promise<boolean>;
        };

        const match = await serverInternal.loadMatch('match-watchdog-dicethrone-defensive-advance-fallback');
        expect(resolveCurrentPlayerId(match.state)).toBe('0');

        const candidate = {
            playerId: '1',
            reason: 'active-turn',
            legalActionOnly: true,
            allowForceCommandAfterLegalActionExhausted: true,
            fingerprintHint: 'active-turn-legal-only:1:defensiveRoll:advance-phase',
            resolution: {
                playerId: '1',
                attemptKey: 'force-end-turn:1:active-turn-legal-only:1:defensiveRoll:advance-phase',
                source: 'local-ai',
                action: {
                    actionId: 'force-end-turn:active-turn-legal-only:1:defensiveRoll:advance-phase',
                    kind: 'force-end-turn',
                    label: '服务端代 AI 推进防御阶段',
                    commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                },
            },
        };
        const tracker = {
            key: `1:active-turn:${(server as any).buildOnlineAiRecoveryFingerprint(
                match,
                candidate,
                buildAiProgressMarker(match.state),
            )}`,
            firstSeenAt: Date.now(),
            autoSubmittedAt: Date.now(),
            lastReportedFailureReason: null,
            failureCount: 0,
        };
        (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);

        const tryRecoverSpy = vi.spyOn(serverInternal, 'tryRecoverOnlineAiWithLegalAction').mockResolvedValueOnce({
            applied: false,
            resolved: false,
            blockedReason: null,
            executedCommandTypes: [],
            outcome: 'no-legal-action',
        });
        vi.spyOn(serverInternal, 'resolveOnlineAiRecoveryCandidate').mockResolvedValueOnce(null);
        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (activeMatch, playerID, commandType, payload) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('ADVANCE_PHASE');
            expect(payload).toEqual({});
            activeMatch.state = {
                ...activeMatch.state,
                core: {
                    ...activeMatch.state.core,
                    pendingAttack: null,
                },
                sys: {
                    ...activeMatch.state.sys,
                    phase: 'main2',
                    eventStream: {
                        ...(activeMatch.state.sys?.eventStream ?? {}),
                        nextId: (activeMatch.state.sys?.eventStream?.nextId ?? 1) + 1,
                    },
                },
            };
            return true;
        });

        await serverInternal.runOnlineAiRecoverySequence(
            match,
            tracker,
            candidate,
            buildAiProgressMarker(match.state),
            {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
        );

        expect(tryRecoverSpy).toHaveBeenCalledTimes(1);
        expect(executeSpy).toHaveBeenCalledTimes(1);
        expect(match.state.sys.phase).toBe('main2');
        expect(match.state.core.pendingAttack).toBeNull();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-dicethrone-defensive-advance-fallback',
            playerId: '1',
            incidentKind: 'force-end-turn-success',
            status: 'resolved',
            reason: 'active-turn:follow-up-advance:steps=1',
        }));
        expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-watchdog-dicethrone-defensive-advance-fallback',
            incidentKind: 'force-end-turn-failed',
            reason: expect.stringContaining('advance_guard_blocked'),
        }));
    });
    it('Dice Throne watchdog 在 AI active 的 offensiveRoll 只剩推进阶段时，不应误报 blocker_persisted', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const random = createQueuedRandom([2, 2, 2, 3, 6, 6, 6, 1, 1]);
        const state = createHeroMatchup('paladin', 'barbarian')(['0', '1'], random);

        state.sys.phase = 'offensiveRoll';
        state.sys.turnNumber = 0;
        state.core.activePlayerId = '1';
        state.core.currentPlayerIndex = 1;
        state.core.rollCount = 1;
        state.core.rollLimit = 1;
        state.core.rollDiceCount = 5;
        state.core.rollConfirmed = true;
        state.core.pendingAttack = null;
        state.core.activatingAbilityId = undefined;
        state.core.players['1'].hand = [];

        await storage.createMatch('match-watchdog-dicethrone-offensive-advance-legal-only', {
            initialState: {
                G: state,
                _stateID: 0,
                randomSeed: 'seed',
                randomCursor: 0,
            },
            metadata: createOnlineAiRecoveryMetadata({
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    attemptKey: 'watchdog-dicethrone-offensive-advance-phase',
                    source: 'local-ai',
                    action: {
                        actionId: 'phase:advance:offensiveRoll:main2',
                        kind: 'advance-phase',
                        label: '推进到 main2',
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });

        try {
            const server = new GameTransportServer({
                io: io as unknown as any,
                storage,
                games: [diceThroneEngineConfig],
                onlineAiRecoveryTickMs: 0,
                onlineAiRecoveryTimeoutMs: 0,
                onlineAiRecoveryFailureReportThreshold: 1,
                onlineAiFeedbackReporter: feedbackReporter,
            });

            const serverInternal = server as unknown as {
                loadMatch: (matchID: string) => Promise<any>;
                runOnlineAiRecoverySequence: (
                    match: any,
                    tracker: any,
                    candidate: any,
                    progressMarkerBeforeRecovery: string,
                    seatControllers: Record<string, { type: 'human' | 'local-ai' | 'remote-ai'; policyId?: string }>,
                ) => Promise<void>;
                executeCommandInternal: (
                    match: any,
                    playerID: string,
                    commandType: string,
                    payload: unknown,
                ) => Promise<boolean>;
            };

            const match = await serverInternal.loadMatch('match-watchdog-dicethrone-offensive-advance-legal-only');
            const candidate = {
                playerId: '1',
                reason: 'active-turn-legal-only',
                legalActionOnly: true,
                fingerprintHint: 'active-turn-legal-only:1:offensiveRoll',
                resolution: {
                    playerId: '1',
                    attemptKey: 'force-end-turn:1:active-turn-legal-only:1:offensiveRoll',
                    source: 'local-ai',
                    action: {
                        actionId: 'force-end-turn:active-turn-legal-only:1:offensiveRoll',
                        kind: 'force-end-turn',
                        label: '服务端代 AI 执行合法动作',
                        commands: [],
                    },
                },
            };
            const progressMarker = buildAiProgressMarker(match.state, {
                engineConfig: diceThroneEngineConfig,
                gameId: 'dicethrone',
            });
            const tracker = {
                key: `1:active-turn-legal-only:${(server as any).buildOnlineAiRecoveryFingerprint(
                    match,
                    candidate,
                    progressMarker,
                )}`,
                firstSeenAt: Date.now(),
                autoSubmittedAt: Date.now(),
                lastReportedFailureReason: null,
                failureCount: 0,
            };
            (server as any).onlineAiRecoveryLedger.setTracker(match.matchID, tracker);
            const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal');

            await serverInternal.runOnlineAiRecoverySequence(
                match,
                tracker,
                candidate,
                progressMarker,
                {
                    '0': { type: 'human' },
                    '1': { type: 'local-ai', policyId: 'baseline' },
                },
            );

            expect(executeSpy.mock.calls[0]?.[1]).toBe('1');
            expect(executeSpy.mock.calls[0]?.[2]).toBe('ADVANCE_PHASE');
            expect(match.state.sys.phase).not.toBe('offensiveRoll');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-dicethrone-offensive-advance-legal-only',
                playerId: '1',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
            }));
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-dicethrone-offensive-advance-legal-only',
                incidentKind: 'force-end-turn-failed',
                reason: expect.stringContaining('blocker_persisted'),
            }));
        } finally {
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 遇到同一 AI 的链式可见交互时，应在单次恢复序列内持续消费直到收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-interaction-chain', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'pass',
                                label: 'Pass',
                                value: { kind: 'pass' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:reaction-choice-1:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'reaction-choice-1', optionId: 'pass' },
                        }],
                    },
                    attemptKey: 'watchdog-chain-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:reaction-choice-2:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'reaction-choice-2', optionId: 'pass' },
                        }],
                    },
                    attemptKey: 'watchdog-chain-step-2',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle' as const,
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfig()],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');
            expect(commandType).toBe('SYS_INTERACTION_RESPOND');

            const currentInteractionId = (activeMatch.state.sys?.interaction?.current as { id?: string } | undefined)?.id;
            if (currentInteractionId === 'reaction-choice-1') {
                expect(payload).toEqual({ interactionId: 'reaction-choice-1', optionId: 'pass' });
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '1',
                    phase: 'scoreBases',
                    interaction: {
                        current: createSimpleChoice(
                            'reaction-choice-2',
                            '1',
                            '第二段反应动作',
                            [
                                {
                                    id: 'pass',
                                    label: 'Pass',
                                    value: { kind: 'pass' },
                                },
                            ],
                            {
                                sourceId: 'smashup_reaction_choose',
                                targetType: 'button',
                            },
                        ),
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: {
                            id: 'reaction-window',
                            windowType: 'meFirst',
                            responderQueue: ['0', '1'],
                            currentResponderIndex: 1,
                            passedPlayers: [],
                        },
                    },
                }).G as any;
                return true;
            }

            if (currentInteractionId === 'reaction-choice-2') {
                expect(payload).toEqual({ interactionId: 'reaction-choice-2', optionId: 'pass' });
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '0',
                    phase: 'draw',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                }).G as any;
                return true;
            }

            throw new Error(`Unexpected interaction id: ${String(currentInteractionId)}`);
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-visible-interaction-chain');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(resolutionSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(buildAiProgressMarker(match.state)).toBe('4|draw|1|0|||||||0|');
            expect(match.state.sys.interaction?.current).toBeUndefined();
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-interaction-chain',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                trackerKey?: string;
                blockerFingerprint?: string | null;
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(snapshot.blockerFingerprint).toContain('scoreBases');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(actionLog.blockerFingerprint).toContain('scoreBases');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在 shared visible prompt 后若切到 owner-only hidden prompt 且 marker 不变，也应在同一恢复序列内继续收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-watchdog-visible-to-hidden-chain', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'visible-choice-1',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'continue-visible',
                                label: '继续',
                                value: { kind: 'continue' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: 'smashup' }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:visible-choice-1:continue-visible',
                        kind: 'interaction-choice',
                        label: '继续',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'visible-choice-1', optionId: 'continue-visible' },
                        }],
                    },
                    attemptKey: 'watchdog-visible-hidden-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:hidden-choice-1:confirm-hidden',
                        kind: 'interaction-choice',
                        label: '确认秘密目标',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'hidden-choice-1', optionId: 'confirm-hidden' },
                        }],
                    },
                    attemptKey: 'watchdog-visible-hidden-step-2',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId('smashup')],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiRecoveryFailureReportThreshold: 1,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        let hiddenPromptActive = false;
        const originalApplyPlayerView = (server as any).stateSynchronizer.applyPlayerView.bind(
            (server as any).stateSynchronizer,
        );
        vi.spyOn((server as any).stateSynchronizer, 'applyPlayerView').mockImplementation((activeMatch: any, playerID: string) => {
            if (playerID !== '1' || !hiddenPromptActive) {
                return originalApplyPlayerView(activeMatch, playerID);
            }
            return {
                ...activeMatch.state,
                sys: {
                    ...activeMatch.state.sys,
                    interaction: {
                        current: createSimpleChoice(
                            'hidden-choice-1',
                            '1',
                            '选择要弃掉的手牌',
                            [
                                {
                                    id: 'confirm-hidden',
                                    label: '确认弃掉',
                                    value: { targetId: 'secret-target' },
                                },
                            ],
                            {
                                sourceId: 'super_spies_secret_agent_discard',
                                targetType: 'hand',
                            },
                        ),
                        queue: [],
                        isBlocked: false,
                    },
                },
            } as MatchState<unknown>;
        });

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === INTERACTION_COMMANDS.RESPOND && (payload as any)?.interactionId === 'visible-choice-1') {
                hiddenPromptActive = true;
                activeMatch.state = {
                    ...activeMatch.state,
                    sys: {
                        ...activeMatch.state.sys,
                        interaction: {
                            current: undefined,
                            queue: [],
                            isBlocked: false,
                        },
                    },
                };
                return true;
            }

            if (commandType === INTERACTION_COMMANDS.RESPOND && (payload as any)?.interactionId === 'hidden-choice-1') {
                hiddenPromptActive = false;
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '0',
                    phase: 'playCards',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                }).G as any;
                return true;
            }

            return false;
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-visible-to-hidden-chain');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            for (let i = 0; i < 10; i++) { await nextTick(); }

            expect(executeSpy.mock.calls.map((call) => call[2])).toEqual([
                INTERACTION_COMMANDS.RESPOND,
                INTERACTION_COMMANDS.RESPOND,
            ]);
            expect(executeSpy.mock.calls.map((call) => (call[3] as any)?.interactionId)).toEqual([
                'visible-choice-1',
                'hidden-choice-1',
            ]);
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).not.toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-to-hidden-chain',
                incidentKind: 'force-end-turn-failed',
            }));
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-visible-to-hidden-chain',
                playerId: '1',
                incidentKind: 'legal-action-recovered',
                status: 'resolved',
            }));
            const payload = feedbackReporter.mock.calls[0]?.[0] as {
                trackerKey?: string;
                blockerFingerprint?: string | null;
                stateSnapshot?: string;
                actionLog?: string;
            } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(snapshot.blockerFingerprint).toContain('scoreBases');
            expect(snapshot.trackerKey).toBe(payload?.trackerKey);

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(actionLog.blockerFingerprint).toContain('scoreBases');
            expect(actionLog.trackerKey).toBe(payload?.trackerKey);
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
    it('online AI watchdog 在交互恢复后若同一 AI 只剩自然过阶段，应补最后一步 ADVANCE_PHASE 而不是把 legal-only 当失败', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);
        const gameId = 'smashup';

        await storage.createMatch('match-watchdog-interaction-followup-advance', {
            initialState: createOnlineAiRecoveryState({
                activePlayerId: '1',
                phase: 'scoreBases',
                interaction: {
                    current: createSimpleChoice(
                        'reaction-choice-followup',
                        '1',
                        '选择一个反应动作',
                        [{
                            id: 'pass',
                            label: 'Pass',
                            value: { kind: 'pass' },
                        }],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window-followup',
                        windowType: 'meFirst',
                        responderQueue: ['0', '1'],
                        currentResponderIndex: 1,
                        passedPlayers: [],
                    },
                },
            }),
            metadata: createOnlineAiRecoveryMetadata({ gameName: gameId }),
        });

        const resolutionSpy = vi.spyOn(aiModule, 'resolveNextAiDispatch');
        resolutionSpy
            .mockResolvedValueOnce({
                kind: 'action',
                resolution: {
                    playerId: '1',
                    action: {
                        actionId: 'interaction:reaction-choice-followup:pass',
                        kind: 'interaction-choice',
                        label: 'Pass',
                        commands: [{
                            type: INTERACTION_COMMANDS.RESPOND,
                            payload: { interactionId: 'reaction-choice-followup', optionId: 'pass' },
                        }],
                    },
                    attemptKey: 'watchdog-followup-step-1',
                    source: 'local-ai',
                },
            })
            .mockResolvedValue({
                kind: 'idle',
                idleReason: 'no-action',
            });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createEngineConfigWithId(gameId)],
            onlineAiRecoveryTickMs: 0,
            onlineAiRecoveryTimeoutMs: 0,
            onlineAiFeedbackReporter: feedbackReporter,
        });

        const serverInternal = server as unknown as {
            loadMatch: (matchID: string) => Promise<any>;
            runOnlineAiRecoveryTick: () => Promise<void>;
            executeCommandInternal: (
                match: any,
                playerID: string,
                commandType: string,
                payload: unknown,
                options?: { suppressBroadcast?: boolean },
            ) => Promise<boolean>;
        };

        const executeSpy = vi.spyOn(serverInternal, 'executeCommandInternal').mockImplementation(async (
            activeMatch,
            playerID,
            commandType,
            payload,
        ) => {
            expect(playerID).toBe('1');

            if (commandType === 'SYS_INTERACTION_RESPOND') {
                expect(payload).toEqual({ interactionId: 'reaction-choice-followup', optionId: 'pass' });
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '1',
                    phase: 'scoreBases',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    eventStreamNextId: 2,
                }).G as any;
                return true;
            }

            if (commandType === 'ADVANCE_PHASE') {
                activeMatch.state = createOnlineAiRecoveryState({
                    activePlayerId: '0',
                    phase: 'draw',
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    eventStreamNextId: 3,
                }).G as any;
                return true;
            }

            throw new Error(`Unexpected command: ${commandType}`);
        });

        try {
            const match = await serverInternal.loadMatch('match-watchdog-interaction-followup-advance');
            await serverInternal.runOnlineAiRecoveryTick();
            await serverInternal.runOnlineAiRecoveryTick();
            await nextTick();
            await nextTick();

            expect(executeSpy.mock.calls.map(call => call[2])).toEqual(['SYS_INTERACTION_RESPOND', 'ADVANCE_PHASE']);
            expect(match.state.sys.phase).toBe('draw');
            expect(match.state.core.activePlayerId).toBe('0');
            expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
                matchId: 'match-watchdog-interaction-followup-advance',
                playerId: '1',
                incidentKind: 'force-end-turn-success',
                status: 'resolved',
            }));

            const payload = feedbackReporter.mock.calls[0]?.[0] as { stateSnapshot?: string; actionLog?: string } | undefined;
            const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
            expect(snapshot.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(snapshot.blockerFingerprint).toContain('scoreBases');
            expect(snapshot.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose');

            const actionLog = JSON.parse(payload?.actionLog ?? '{}');
            expect(actionLog.blockerFingerprint).toContain('smashup_reaction_choose');
            expect(actionLog.blockerFingerprint).toContain('scoreBases');
            expect(actionLog.trackerKey).toContain('visible-interaction:interaction:1:scoreBases:simple-choice:smashup_reaction_choose');
        } finally {
            executeSpy.mockRestore();
            resolutionSpy.mockRestore();
        }
    });
});
