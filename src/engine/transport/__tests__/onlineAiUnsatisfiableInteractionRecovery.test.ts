import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { GameTransportServer } from '../server';
import type { GameEngineConfig } from '../engineConfig';
import type { ChoiceRequest } from '../../ChoiceRequest';
import { createInteractionSystem, createSimpleChoice, INTERACTION_COMMANDS } from '../../systems/InteractionSystem';
import { createSimpleChoiceFromChoiceRequest } from '../../systems/ChoiceRequestSimpleChoiceAdapter';
import { createSimpleChoiceSystem } from '../../systems/SimpleChoiceSystem';
import {
    InMemoryStorage,
    MockIO,
    createEngineConfigWithId,
    createInteractiveEngineConfig,
    createOnlineAiRecoveryMetadata,
} from './helpers/serverTestHarness';

describe('online AI unsatisfiable interaction recovery', () => {
    it('AI 走无解交互 emergency skip 时，服务端应立即自动反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const interaction = createSimpleChoice(
            'unsat-choice',
            '1',
            '测试无解交互',
            [{
                id: 'only-disabled',
                label: '唯一但不可选',
                value: { targetId: 'm-1' },
                disabled: true,
                disabledReason: '目标已失效',
            }],
            { sourceId: 'test-unsat-choice' },
        );

        await storage.createMatch('match-unsat-auto-feedback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: interaction,
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
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createInteractiveEngineConfig()],
            onlineAiFeedbackReporter: feedbackReporter,
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

        const match = await serverInternal.loadMatch('match-unsat-auto-feedback');
        const success = await serverInternal.executeCommandInternal(
            match,
            '1',
            INTERACTION_COMMANDS.RESPOND,
            { optionId: '__emergency_skip__' },
        );

        expect(success).toBe(true);
        expect(feedbackReporter).toHaveBeenCalledTimes(1);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-unsat-auto-feedback',
            playerId: '1',
            incidentKind: 'unsatisfiable-interaction-auto-skipped',
            status: 'open',
            reason: 'all-options-disabled',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.interaction?.seatSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 1,
            disabledOptions: 1,
            selectionState: 'recoverable-option-available',
        });
        expect(snapshot.interaction?.sharedSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 1,
            disabledOptions: 1,
            selectionState: 'recoverable-option-available',
        });
        expect(snapshot.seatControllerType).toBe('local-ai');
        expect(snapshot.legalActions).toMatchObject({
            total: 0,
            truncated: false,
        });
        expect(snapshot.aiDecisionPreview).toBeNull();
        expect(snapshot.recentActionLogTail).toEqual([]);
        expect(snapshot.recentEventStreamTail).toEqual([]);
        expect(snapshot.blockerFingerprint).toBe('main2:all-options-disabled:interaction:simple-choice:test-unsat-choice');
        expect(snapshot.interaction?.shared?.sourceId).toBe('test-unsat-choice');
        expect(snapshot.interaction?.seatUnsatisfiableReason).toBe('all-options-disabled');
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: '__emergency_skip__',
        }));
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'only-disabled',
            disabledReason: '目标已失效',
        }));

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog).toMatchObject({
            kind: 'online-ai-feedback-diagnostic',
            commandType: INTERACTION_COMMANDS.CANCEL,
            reason: 'all-options-disabled',
            blockerFingerprint: 'main2:all-options-disabled:interaction:simple-choice:test-unsat-choice',
        });
        expect(actionLog.interaction).toMatchObject({
            shared: {
                id: 'unsat-choice',
                kind: 'simple-choice',
                sourceId: 'test-unsat-choice',
            },
            seat: {
                id: 'unsat-choice',
                kind: 'simple-choice',
                sourceId: 'test-unsat-choice',
            },
        });
        expect(actionLog.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'only-disabled',
            disabledReason: '目标已失效',
        }));
    });
    it('Choice Request 无解交互的线上恢复反馈应携带请求诊断，且不推断业务目标', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const request: ChoiceRequest<{ targetId: string }> = {
            requestId: 'choice-request-unsat',
            gameId: 'test-game',
            playerId: '1',
            ownerFrameId: 'choice-frame',
            kind: 'select-object',
            sourceId: 'choice-request-source',
            selection: { min: 1, max: 1 },
            skipPolicy: 'forbidden',
            resolution: { type: 'interaction-response', interactionId: 'choice-request-unsat' },
            ai: { status: 'shared-policy' },
            candidates: [{
                id: 'target-1',
                label: '目标 1',
                value: { targetId: 'monster-1' },
                disabled: true,
                disabledReason: '目标已失效',
            }],
        };
        const interaction = createSimpleChoiceFromChoiceRequest(request, {
            title: '选择目标',
            targetType: 'minion',
        });

        await storage.createMatch('match-choice-request-unsat-auto-feedback', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                    },
                    sys: {
                        phase: 'main2',
                        turnNumber: 4,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: interaction,
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
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createInteractiveEngineConfig()],
            onlineAiFeedbackReporter: feedbackReporter,
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

        const match = await serverInternal.loadMatch('match-choice-request-unsat-auto-feedback');
        const success = await serverInternal.executeCommandInternal(
            match,
            '1',
            INTERACTION_COMMANDS.RESPOND,
            { interactionId: 'choice-request-unsat', optionId: '__emergency_skip__' },
        );

        expect(success).toBe(true);
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-choice-request-unsat-auto-feedback',
            playerId: '1',
            incidentKind: 'unsatisfiable-interaction-auto-skipped',
            reason: 'all-options-disabled',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            stateSnapshot?: string;
            actionLog?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.interaction?.seat?.choiceRequest).toMatchObject({
            requestId: 'choice-request-unsat',
            choiceKind: 'select-object',
            sourceId: 'choice-request-source',
            aiDiagnosticStatus: 'invalid-request',
            diagnostics: [expect.objectContaining({ code: 'mandatory-choice-unsatisfied' })],
            candidateSummary: {
                total: 1,
                enabledCandidateIds: [],
                disabledCandidateIds: ['target-1'],
            },
            projectedLegalActionCount: 0,
        });
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: '__emergency_skip__',
        }));
        expect(snapshot.interaction?.seat?.options).toContainEqual(expect.objectContaining({
            id: 'target-1',
            disabledReason: '目标已失效',
        }));

        const actionLog = JSON.parse(payload?.actionLog ?? '{}');
        expect(actionLog).toMatchObject({
            commandType: INTERACTION_COMMANDS.CANCEL,
            reason: 'all-options-disabled',
        });
        expect(actionLog.commandPayload).toBeUndefined();
        expect(JSON.stringify(actionLog)).not.toContain('"optionId":"target-1"');
    });
    it('AI seat-view 只剩 emergency skip、但 authoritative interaction 仍保留旧选项时，应翻译成 CANCEL 收口', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const interaction = createSimpleChoice(
            'haunted-house-live-drift',
            '1',
            '鬼屋：选择要弃掉的卡牌',
            [
                { id: 'card-0', label: '卡牌 0', value: { cardUid: 'c94', defId: 'vikings_cast_the_runes' } },
                { id: 'card-1', label: '卡牌 1', value: { cardUid: 'c114', defId: 'ghost_ghostly_arrival_pod' } },
            ],
            {
                sourceId: 'base_haunted_house_al9000',
                targetType: 'hand',
                responseValidationMode: 'live',
            },
        );
        interaction.data.optionsGenerator = (state: any) => {
            const hand = state?.core?.players?.['1']?.hand ?? [];
            return hand.map((card: any, index: number) => ({
                id: `card-${index}`,
                label: card.defId,
                value: { cardUid: card.uid, defId: card.defId },
                displayMode: 'card' as const,
            }));
        };

        const engine = createInteractiveEngineConfig();
        const customEngine: GameEngineConfig = {
            ...engine,
            systems: [
                ...engine.systems,
                {
                    id: 'force-emergency-seat-view',
                    name: 'force-emergency-seat-view',
                    priority: 999,
                    playerView: (state: any, playerId: string) => {
                        if (playerId !== '1') {
                            return {};
                        }

                        const current = state.sys?.interaction?.current;
                        if (!current) {
                            return {};
                        }

                        return {
                            interaction: {
                                ...state.sys?.interaction,
                                current: {
                                    ...current,
                                    data: {
                                        ...current.data,
                                        options: [{
                                            id: '__emergency_skip__',
                                            label: '跳过（当前无可执行选项）',
                                            value: {
                                                __emergency_skip__: true,
                                                __emergency_skip_reason__: 'empty-options',
                                            },
                                            displayMode: 'button',
                                        }],
                                    },
                                },
                            },
                        };
                    },
                },
            ],
        };

        await storage.createMatch('match-ai-emergency-skip-authoritative-drift', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hand: [], deck: [], discard: [] },
                            '1': {
                                hand: [
                                    { uid: 'c94', defId: 'vikings_cast_the_runes', type: 'action', owner: '1' },
                                    { uid: 'c114', defId: 'ghost_ghostly_arrival_pod', type: 'action', owner: '1' },
                                ],
                                deck: [],
                                discard: [],
                            },
                        },
                    },
                    sys: {
                        phase: 'playCards',
                        turnNumber: 0,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: interaction,
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
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [customEngine],
            onlineAiFeedbackReporter: feedbackReporter,
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

        const match = await serverInternal.loadMatch('match-ai-emergency-skip-authoritative-drift');
        const success = await serverInternal.executeCommandInternal(
            match,
            '1',
            INTERACTION_COMMANDS.RESPOND,
            { interactionId: 'haunted-house-live-drift', optionId: '__emergency_skip__' },
        );

        expect(success).toBe(true);
        expect(match.state.sys.interaction.current).toBeUndefined();
        expect(feedbackReporter).toHaveBeenCalledWith(expect.objectContaining({
            matchId: 'match-ai-emergency-skip-authoritative-drift',
            playerId: '1',
            incidentKind: 'unsatisfiable-interaction-auto-skipped',
            status: 'open',
            reason: 'empty-options',
        }));

        const payload = feedbackReporter.mock.calls[0]?.[0] as {
            stateSnapshot?: string;
        } | undefined;
        const snapshot = JSON.parse(payload?.stateSnapshot ?? '{}');
        expect(snapshot.interaction?.sharedSelectability).toMatchObject({
            totalOptions: 2,
            enabledOptions: 2,
            selectionState: 'manual-selection-required',
        });
        expect(snapshot.interaction?.seatSelectability).toMatchObject({
            totalOptions: 1,
            enabledOptions: 1,
            selectionState: 'recoverable-option-available',
        });
    });
    it('authoritative interaction 本身已退化成单一 emergency skip 时，不应再持久化系统反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        const interaction = createSimpleChoice(
            'already-recoverable-choice',
            '1',
            '当前无可执行选项',
            [{
                id: '__emergency_skip__',
                label: '跳过（当前无可执行选项）',
                value: {
                    __emergency_skip__: true,
                    __emergency_skip_reason__: 'empty-options',
                },
                displayMode: 'button',
            }],
            {
                sourceId: 'already-recoverable-choice',
                responseValidationMode: 'live',
            },
        );

        await storage.createMatch('match-unsat-already-recoverable', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '1',
                        currentPlayerIndex: 1,
                        turnOrder: ['0', '1'],
                        players: {
                            '0': { hand: [], deck: [], discard: [] },
                            '1': { hand: [], deck: [], discard: [] },
                        },
                    },
                    sys: {
                        phase: 'playCards',
                        turnNumber: 0,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: interaction,
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
            metadata: createOnlineAiRecoveryMetadata(),
        });

        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [createInteractiveEngineConfig()],
            onlineAiFeedbackReporter: feedbackReporter,
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

        const match = await serverInternal.loadMatch('match-unsat-already-recoverable');
        const success = await serverInternal.executeCommandInternal(
            match,
            '1',
            INTERACTION_COMMANDS.RESPOND,
            { interactionId: 'already-recoverable-choice', optionId: '__emergency_skip__' },
        );

        expect(success).toBe(true);
        expect(match.state.sys.interaction.current).toBeUndefined();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
    it('dt:defender-choice 已经是 0 个目标的恢复态时，不应再持久化系统反馈', async () => {
        const io = new MockIO();
        const storage = new InMemoryStorage();
        const feedbackReporter = vi.fn(async () => undefined);

        await storage.createMatch('match-dt-defender-choice-empty-options', {
            initialState: {
                G: {
                    core: {
                        activePlayerId: '3',
                        currentPlayerIndex: 3,
                        turnOrder: ['0', '1', '2', '3'],
                        players: {
                            '0': { hand: [], deck: [], discard: [] },
                            '1': { hand: [], deck: [], discard: [] },
                            '2': { hand: [], deck: [], discard: [] },
                            '3': { hand: [], deck: [], discard: [] },
                        },
                    },
                    sys: {
                        phase: 'targetingRoll',
                        turnNumber: 0,
                        eventStream: { nextId: 1 },
                        interaction: {
                            current: {
                                id: 'dt-defender-choice-empty',
                                kind: 'dt:defender-choice',
                                playerId: '3',
                                data: {
                                    attackerId: '3',
                                    chooserPlayerId: '3',
                                    sourceAbilityId: 'katana-slice-4',
                                    sourceId: 'katana-slice-4',
                                    titleKey: '选择本次攻击目标',
                                    targetRollValue: 6,
                                    options: [],
                                },
                            },
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
                gameName: 'dicethrone',
                seatControllers: {
                    '0': { type: 'human' },
                    '1': { type: 'human' },
                    '2': { type: 'human' },
                    '3': { type: 'local-ai', policyId: 'baseline' },
                },
            }),
        });

        const dtEngine = createEngineConfigWithId('dicethrone');
        const server = new GameTransportServer({
            io: io as unknown as any,
            storage,
            games: [{
                ...dtEngine,
                systems: [
                    createInteractionSystem(),
                    createSimpleChoiceSystem(),
                ],
            }],
            onlineAiFeedbackReporter: feedbackReporter,
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

        const match = await serverInternal.loadMatch('match-dt-defender-choice-empty-options');
        const success = await serverInternal.executeCommandInternal(
            match,
            '3',
            INTERACTION_COMMANDS.CANCEL,
            { interactionId: 'dt-defender-choice-empty', reason: 'empty-options' },
        );

        expect(success).toBe(true);
        expect(match.state.sys.interaction.current).toBeUndefined();
        expect(feedbackReporter).not.toHaveBeenCalled();
    });
});
