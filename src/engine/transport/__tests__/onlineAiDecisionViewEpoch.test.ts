import { describe, expect, it } from 'vitest';
import { createSimpleChoice } from '../../systems/InteractionSystem';
import { resolveOnlineAiDecisionView } from '../../ai/onlineDecisionView';
import { smashUpAiRuntime } from '../../../games/smashup/ai';
import { splendorAiRuntime } from '../../../games/splendor/ai';

describe('online decision view（epoch 硬约束）', () => {
    it('private-required 场景下 eventStream.nextId 不一致时必须判定 stale-private-overlay', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'playCards',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: { nextId: 9 },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
        expect(result.diagnostics.sharedEventStreamNextId).toBe(10);
        expect(result.diagnostics.privateEventStreamNextId).toBe(9);
    });

    it('private-required 场景下 private overlay 缺失 eventStream.nextId 时必须判定 stale-private-overlay', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'playCards',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: {},
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
        expect(result.diagnostics.sharedEventStreamNextId).toBe(10);
        expect(result.diagnostics.privateEventStreamNextId).toBeNull();
    });

    it('SmashUp 可见的 mandatory 结算顺序选择应允许直接走 shared 视图，避免 stale overlay 卡住 AI', () => {
        const sharedState = {
            core: {
                activePlayerId: '1',
            },
            sys: {
                phase: 'scoreBases',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: createSimpleChoice(
                        'mandatory-reaction-order-choice',
                        '1',
                        '选择一个反应动作',
                        [
                            {
                                id: 'trigger-base-arena',
                                label: '竞技场',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:base_arena:1:0' },
                            },
                            {
                                id: 'trigger-wizard-archmage',
                                label: '大法师',
                                value: { kind: 'trigger', triggerId: 'trigger:onMinionPlayed:wizard_archmage:1:0' },
                            },
                        ],
                        {
                            sourceId: 'smashup_reaction_choose',
                            targetType: 'button',
                        },
                    ),
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: { nextId: 9 },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            runtime: smashUpAiRuntime,
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('shared');
        expect(result.canDecide).toBe(true);
        expect(result.blockedReason).toBeNull();
        expect(result.visibleState).toBe(sharedState);
    });

    it('Splendor 主动回合在无 interaction / responseWindow 时应允许走 shared 视图，避免 stale overlay 卡住 watchdog', () => {
        const sharedState = {
            core: {
                hostStarted: true,
                currentPlayer: '1',
                pendingResolution: undefined,
                players: {
                    '0': {
                        reservedCardIds: ['t1-white-1'],
                    },
                    '1': {
                        reservedCardIds: ['t1-blue-1'],
                    },
                },
                decks: {
                    1: ['t1-green-1', 't1-red-1'],
                    2: ['t2-blue-1'],
                    3: ['t3-black-1'],
                },
            },
            sys: {
                phase: 'main1',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            core: {
                ...sharedState.core,
                players: {
                    ...sharedState.core.players,
                    '0': {
                        reservedCardIds: ['hidden-reserved-0-0'],
                    },
                },
                decks: {
                    1: ['hidden-deck-1-0', 'hidden-deck-1-1'],
                    2: ['hidden-deck-2-0'],
                    3: ['hidden-deck-3-0'],
                },
            },
            sys: {
                ...sharedState.sys,
                eventStream: { nextId: 9 },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            runtime: splendorAiRuntime,
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('shared');
        expect(result.canDecide).toBe(true);
        expect(result.blockedReason).toBeNull();
        expect(result.visibleState).toBe(sharedState);
    });

    it('Splendor 若存在 responseWindow 仍应维持 private-required，不得绕过 stale overlay 门禁', () => {
        const sharedState = {
            core: {
                hostStarted: true,
                currentPlayer: '1',
            },
            sys: {
                phase: 'main1',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'splendor-response-window',
                        windowType: 'afterPlay',
                        sourceId: 'splendor:test',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                eventStream: { nextId: 9 },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            runtime: splendorAiRuntime,
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
    });

    it('shared hidden interaction blocker 存在时，seat view 若没有该 AI 的私有交互则必须判定 stale-private-overlay', () => {
        const sharedState = {
            core: {
                activePlayerId: '0',
            },
            sys: {
                phase: 'main1',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: true,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
        expect(result.diagnostics.sharedEventStreamNextId).toBe(10);
        expect(result.diagnostics.privateEventStreamNextId).toBe(10);
    });

    it('private-required responseWindow 同 epoch 但 currentResponder 镜像不一致时，必须判定 stale-private-overlay', () => {
        const sharedState = {
            core: {
                activePlayerId: '0',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 4,
                eventStream: { nextId: 10 },
                interaction: {
                    current: undefined,
                    isBlocked: false,
                },
                responseWindow: {
                    current: {
                        id: 'rw-mirror-drift-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1', '0'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as any;

        const privateOverlay = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                responseWindow: {
                    current: {
                        id: 'rw-mirror-drift-1',
                        windowType: 'afterRollConfirmed',
                        sourceId: 'attack-1',
                        responderQueue: ['1', '0'],
                        currentResponderIndex: 1,
                    },
                },
            },
        } as any;

        const result = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay,
            playerId: '1',
        });

        expect(result.visibility).toBe('private-required');
        expect(result.canDecide).toBe(false);
        expect(result.blockedReason).toBe('stale-private-overlay');
        expect(result.diagnostics.sharedEventStreamNextId).toBe(10);
        expect(result.diagnostics.privateEventStreamNextId).toBe(10);
    });
});
