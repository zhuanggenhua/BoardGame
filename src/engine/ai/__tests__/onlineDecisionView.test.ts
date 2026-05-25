import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { registerGameAiRuntime, resolveNextAiDispatch } from '../index';
import type { ResolvedOnlineAiDecisionView } from '../onlineDecisionView';
import { resolveOnlineAiDecisionView } from '../onlineDecisionView';

function buildCompareRollSharedState(): MatchState<unknown> {
    return {
        core: {
            currentPlayerId: '1',
        },
        sys: {
            phase: 'defensiveRoll',
            turnNumber: 3,
            eventStream: {
                nextId: 42,
                entries: [],
            },
            interaction: {
                current: {
                    id: 'compare-roll-1',
                    kind: 'compare-roll-choice',
                    playerId: '0',
                    data: {
                        title: 'compareRoll.gunslingerDuel.title',
                        contestants: [
                            { playerId: '0', roll: 5, labelKey: 'compareRoll.gunslingerDuel.attacker' },
                            { playerId: '1', roll: 3, labelKey: 'compareRoll.gunslingerDuel.defender' },
                        ],
                        options: [
                            { id: 'accept', label: '确认' },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {},
        },
    } as MatchState<unknown>;
}

function buildCompareRollSeatState(): MatchState<unknown> {
    return {
        core: {
            currentPlayerId: '1',
        },
        sys: {
            phase: 'defensiveRoll',
            turnNumber: 3,
            eventStream: {
                nextId: 42,
                entries: [],
            },
            interaction: {
                current: {
                    id: 'compare-roll-1',
                    kind: 'compare-roll-choice',
                    playerId: '0',
                    data: {
                        title: 'compareRoll.gunslingerDuel.title',
                        contestants: [
                            { playerId: '0', roll: 5, labelKey: 'compareRoll.gunslingerDuel.attacker' },
                            { playerId: '1', roll: 3, labelKey: 'compareRoll.gunslingerDuel.defender' },
                        ],
                        options: [
                            { id: 'accept', label: '确认' },
                        ],
                    },
                },
                queue: [],
                isBlocked: true,
            },
            responseWindow: {},
        },
    } as MatchState<unknown>;
}

function buildSharedReactionOrderingState(): MatchState<unknown> {
    return {
        core: {
            currentPlayerId: '1',
        },
        sys: {
            phase: 'playCards',
            turnNumber: 5,
            eventStream: {
                nextId: 57,
                entries: [],
            },
            interaction: {
                current: {
                    id: 'reaction-order-1',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        title: '选择反应顺序',
                        sourceId: 'smashup_reaction_choose',
                        options: [
                            { id: 'trigger-a', label: '触发 A', value: { kind: 'trigger', triggerId: 'a' } },
                            { id: 'pass', label: '跳过', value: { kind: 'pass' } },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {},
        },
    } as MatchState<unknown>;
}

function buildSharedReactionOrderingSeatState(): MatchState<unknown> {
    const state = buildSharedReactionOrderingState();
    return {
        ...state,
        sys: {
            ...state.sys,
            interaction: {
                ...state.sys?.interaction,
                isBlocked: true,
            },
        },
    } as MatchState<unknown>;
}

function buildPrivateRequiredInteractionState(): MatchState<unknown> {
    return {
        core: {
            activePlayerId: '1',
        },
        sys: {
            phase: 'playCards',
            turnNumber: 4,
            eventStream: {
                nextId: 17,
                entries: [],
            },
            interaction: {
                current: {
                    id: 'owner-prompt-1',
                    kind: 'simple-choice',
                    playerId: '1',
                    data: {
                        title: '选择一张要弃掉的手牌',
                        sourceId: 'super_spies_secret_agent_discard',
                        options: [
                            { id: 'hand-a', label: '候选 A' },
                        ],
                    },
                },
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: undefined,
            },
        },
    } as MatchState<unknown>;
}

function buildPrivateRequiredResponseWindowState(responderId: string): MatchState<unknown> {
    return {
        core: {
            activePlayerId: responderId,
        },
        sys: {
            phase: 'defensiveRoll',
            turnNumber: 4,
            eventStream: {
                nextId: 21,
                entries: [],
            },
            interaction: {
                current: undefined,
                queue: [],
                isBlocked: false,
            },
            responseWindow: {
                current: {
                    id: 'rw-owner-only-1',
                    windowType: 'afterRollConfirmed',
                    sourceId: 'attack-1',
                    responderQueue: [responderId],
                    currentResponderIndex: 0,
                },
            },
        },
    } as MatchState<unknown>;
}

function buildBlockedDecisionView(overrides?: {
    diagnostics?: Partial<ResolvedOnlineAiDecisionView['diagnostics']>;
}): ResolvedOnlineAiDecisionView {
    const sharedState = buildPrivateRequiredInteractionState();
    return {
        kind: 'online-ai-decision-view',
        visibility: 'private-required',
        sharedState,
        privateOverlay: sharedState,
        visibleState: sharedState,
        canDecide: false,
        blockedReason: 'stale-private-overlay',
        diagnostics: {
            sharedPhase: 'playCards',
            privatePhase: 'playCards',
            sharedTurnNumber: 4,
            privateTurnNumber: 4,
            sharedCurrentPlayerId: '1',
            privateCurrentPlayerId: '1',
            sharedEventStreamNextId: 17,
            privateEventStreamNextId: 17,
            sharedInteractionId: 'owner-prompt-1',
            privateInteractionId: 'owner-prompt-1',
            sharedInteractionKind: 'simple-choice',
            privateInteractionKind: 'simple-choice',
            sharedInteractionSourceId: 'super_spies_secret_agent_discard',
            privateInteractionSourceId: 'super_spies_secret_agent_discard',
            sharedInteractionTitle: '选择一张要弃掉的手牌',
            privateInteractionTitle: '选择一张要弃掉的手牌',
            sharedInteractionOptionSignature: 'hand-a:0:null',
            privateInteractionOptionSignature: 'hand-a:0:null',
            sharedResponseWindowId: null,
            privateResponseWindowId: null,
            sharedResponseWindowType: null,
            privateResponseWindowType: null,
            sharedResponseWindowSourceId: null,
            privateResponseWindowSourceId: null,
            sharedResponseWindowResponderId: null,
            privateResponseWindowResponderId: null,
            sharedResponseWindowQueueSignature: null,
            privateResponseWindowQueueSignature: null,
            ...overrides?.diagnostics,
        },
    };
}

describe('resolveOnlineAiDecisionView', () => {
    it('compare-roll 公开可见但仍 blocked 的 contestant，应优先使用新鲜 seat snapshot 作为 visibleState', () => {
        const sharedState = buildCompareRollSharedState();
        const seatState = buildCompareRollSeatState();

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: seatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.blockedReason).toBeNull();
        expect(resolved.visibleState).toBe(seatState);
        expect(resolved.visibleState.sys?.interaction?.current?.id).toBe('compare-roll-1');
        expect(resolved.visibleState.sys?.interaction?.isBlocked).toBe(true);
    });

    it('compare-roll seat snapshot 过期时，不应继续复用 seat snapshot 冒充当前视图', () => {
        const sharedState = buildCompareRollSharedState();
        const staleSeatState = {
            ...buildCompareRollSeatState(),
            sys: {
                ...buildCompareRollSeatState().sys,
                eventStream: {
                    nextId: 41,
                    entries: [],
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: staleSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.isBlocked).toBe(false);
    });

    it('compare-roll seat snapshot 即使 id 相同，kind 漂移时也不应继续冒充当前视图', () => {
        const sharedState = buildCompareRollSharedState();
        const driftedSeatState = {
            ...buildCompareRollSeatState(),
            sys: {
                ...buildCompareRollSeatState().sys,
                interaction: {
                    ...buildCompareRollSeatState().sys?.interaction,
                    current: {
                        ...buildCompareRollSeatState().sys?.interaction?.current,
                        kind: 'simple-choice',
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.current?.kind).toBe('compare-roll-choice');
    });

    it('compare-roll seat snapshot 即使 id 和 kind 相同，只要 sourceId 漂移也不应继续冒充当前视图', () => {
        const sharedState = buildCompareRollSharedState();
        const driftedSeatState = {
            ...buildCompareRollSeatState(),
            sys: {
                ...buildCompareRollSeatState().sys,
                interaction: {
                    ...buildCompareRollSeatState().sys?.interaction,
                    current: {
                        ...buildCompareRollSeatState().sys?.interaction?.current,
                        data: {
                            ...buildCompareRollSeatState().sys?.interaction?.current?.data,
                            sourceId: 'compare-roll-other-source',
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.current?.data?.sourceId).toBeUndefined();
    });

    it('compare-roll seat snapshot 即使 id/kind/source 相同，只要 title 漂移也不应继续冒充当前视图', () => {
        const sharedState = buildCompareRollSharedState();
        const driftedSeatState = {
            ...buildCompareRollSeatState(),
            sys: {
                ...buildCompareRollSeatState().sys,
                interaction: {
                    ...buildCompareRollSeatState().sys?.interaction,
                    current: {
                        ...buildCompareRollSeatState().sys?.interaction?.current,
                        data: {
                            ...buildCompareRollSeatState().sys?.interaction?.current?.data,
                            title: 'compareRoll.other.title',
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.current?.data?.title).toBe('compareRoll.gunslingerDuel.title');
    });

    it('compare-roll seat snapshot 即使 id/kind/source/title 相同，只要 option signature 漂移也不应继续冒充当前视图', () => {
        const sharedState = buildCompareRollSharedState();
        const driftedSeatState = {
            ...buildCompareRollSeatState(),
            sys: {
                ...buildCompareRollSeatState().sys,
                interaction: {
                    ...buildCompareRollSeatState().sys?.interaction,
                    current: {
                        ...buildCompareRollSeatState().sys?.interaction?.current,
                        data: {
                            ...buildCompareRollSeatState().sys?.interaction?.current?.data,
                            options: [
                                { id: 'reject', label: '取消' },
                            ],
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.current?.data?.options?.[0]?.id).toBe('accept');
    });

    it('compare-roll seat snapshot 即使 id/kind/source/title/options 相同，只要 confirmValue 漂移也不应继续冒充当前视图', () => {
        const sharedState = {
            ...buildCompareRollSharedState(),
            sys: {
                ...buildCompareRollSharedState().sys,
                interaction: {
                    ...buildCompareRollSharedState().sys?.interaction,
                    current: {
                        ...buildCompareRollSharedState().sys?.interaction?.current,
                        data: {
                            ...buildCompareRollSharedState().sys?.interaction?.current?.data,
                            confirmValue: { customId: 'showdown-win', value: 2 },
                        },
                    },
                },
            },
        } as MatchState<unknown>;
        const driftedSeatState = {
            ...buildCompareRollSeatState(),
            sys: {
                ...buildCompareRollSeatState().sys,
                interaction: {
                    ...buildCompareRollSeatState().sys?.interaction,
                    current: {
                        ...buildCompareRollSeatState().sys?.interaction?.current,
                        data: {
                            ...buildCompareRollSeatState().sys?.interaction?.current?.data,
                            confirmValue: { customId: 'showdown-lose', value: 0 },
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.current?.data?.confirmValue).toEqual({ customId: 'showdown-win', value: 2 });
    });

    it('compare-roll contestant 不应因为丢失 blocked seat snapshot 而被误当成可直接推进普通动作', async () => {
        const gameId = '__test_online_ai_compare_roll_contestant_shared_snapshot__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const currentPlayerId = (state.core as { currentPlayerId?: string } | undefined)?.currentPlayerId;
                const isBlocked = (state.sys as { interaction?: { isBlocked?: boolean } } | undefined)?.interaction?.isBlocked === true;
                if (currentPlayerId === playerId && !isBlocked) {
                    return [{
                        actionId: `advance-${playerId}`,
                        kind: 'advance-phase',
                        label: `advance-${playerId}`,
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    }];
                }
                return [];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: (context) => (
                        context.legalActions[0]
                            ? { actionId: context.legalActions[0].actionId }
                            : null
                    ),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const sharedState = buildCompareRollSharedState();
        const seatState = buildCompareRollSeatState();
        const dispatch = await resolveNextAiDispatch({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-compare-roll-shared-seat-snapshot',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay: seatState,
                playerId,
            }),
        });

        expect(dispatch.kind).toBe('idle');
        if (dispatch.kind !== 'idle') {
            return;
        }
        expect(dispatch.idleReason).toBe('no-action');
    });

    it('非 compare-roll 的 shared prompt 新鲜时，也应允许复用 blocked seat snapshot', () => {
        const sharedState = buildSharedReactionOrderingState();
        const seatState = buildSharedReactionOrderingSeatState();

        const resolved = resolveOnlineAiDecisionView({
            runtime: {
                gameId: '__test_shared_reaction_ordering__',
                buildLegalActions: () => [],
                resolveOnlineDecisionVisibility: () => 'shared',
            },
            sharedState,
            privateOverlay: seatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(seatState);
        expect(resolved.visibleState.sys?.interaction?.isBlocked).toBe(true);
    });

    it('非 compare-roll 的 shared prompt 即使 id/kind/source/title 相同，只要 option value 漂移也不应继续冒充当前视图', () => {
        const sharedState = buildSharedReactionOrderingState();
        const seatState = buildSharedReactionOrderingSeatState();
        const driftedSeatState = {
            ...seatState,
            sys: {
                ...seatState.sys,
                interaction: {
                    ...seatState.sys?.interaction,
                    current: {
                        ...seatState.sys?.interaction?.current,
                        data: {
                            ...seatState.sys?.interaction?.current?.data,
                            options: [
                                { id: 'trigger-a', label: '触发 A', value: { kind: 'trigger', triggerId: 'b' } },
                                { id: 'pass', label: '跳过', value: { kind: 'pass' } },
                            ],
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            runtime: {
                gameId: '__test_shared_reaction_ordering__',
                buildLegalActions: () => [],
                resolveOnlineDecisionVisibility: () => 'shared',
            },
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('shared');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.visibleState.sys?.interaction?.current?.data?.options?.[0]?.value).toEqual({
            kind: 'trigger',
            triggerId: 'a',
        });
    });

    it('private-required prompt 即使 interaction id 相同，只要 kind 漂移也必须判定 stale-private-overlay', () => {
        const sharedState = buildPrivateRequiredInteractionState();
        const driftedSeatState = {
            ...buildPrivateRequiredInteractionState(),
            sys: {
                ...buildPrivateRequiredInteractionState().sys,
                interaction: {
                    ...buildPrivateRequiredInteractionState().sys?.interaction,
                    current: {
                        ...buildPrivateRequiredInteractionState().sys?.interaction?.current,
                        kind: 'compare-roll-choice',
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.visibleState).toBe(sharedState);
    });

    it('private-required prompt 即使 interaction id 和 kind 相同，只要 sourceId 漂移也必须判定 stale-private-overlay', () => {
        const sharedState = buildPrivateRequiredInteractionState();
        const driftedSeatState = {
            ...buildPrivateRequiredInteractionState(),
            sys: {
                ...buildPrivateRequiredInteractionState().sys,
                interaction: {
                    ...buildPrivateRequiredInteractionState().sys?.interaction,
                    current: {
                        ...buildPrivateRequiredInteractionState().sys?.interaction?.current,
                        data: {
                            ...buildPrivateRequiredInteractionState().sys?.interaction?.current?.data,
                            sourceId: 'super_spies_other_prompt',
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.visibleState).toBe(sharedState);
    });

    it('private-required prompt 即使 interaction id/kind/source 相同，只要 option signature 漂移也必须判定 stale-private-overlay', () => {
        const sharedState = buildPrivateRequiredInteractionState();
        const driftedSeatState = {
            ...buildPrivateRequiredInteractionState(),
            sys: {
                ...buildPrivateRequiredInteractionState().sys,
                interaction: {
                    ...buildPrivateRequiredInteractionState().sys?.interaction,
                    current: {
                        ...buildPrivateRequiredInteractionState().sys?.interaction?.current,
                        data: {
                            ...buildPrivateRequiredInteractionState().sys?.interaction?.current?.data,
                            options: [
                                { id: 'hand-b', label: '候选 B' },
                            ],
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.diagnostics.sharedInteractionOptionSignature).toBe('hand-a:0:null');
        expect(resolved.diagnostics.privateInteractionOptionSignature).toBe('hand-b:0:null');
    });

    it('private-required prompt 即使 interaction id/kind/source/options 相同，只要 title 漂移也必须判定 stale-private-overlay', () => {
        const sharedState = buildPrivateRequiredInteractionState();
        const driftedSeatState = {
            ...buildPrivateRequiredInteractionState(),
            sys: {
                ...buildPrivateRequiredInteractionState().sys,
                interaction: {
                    ...buildPrivateRequiredInteractionState().sys?.interaction,
                    current: {
                        ...buildPrivateRequiredInteractionState().sys?.interaction?.current,
                        data: {
                            ...buildPrivateRequiredInteractionState().sys?.interaction?.current?.data,
                            title: '第二道题',
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.diagnostics.sharedInteractionTitle).toBe('选择一张要弃掉的手牌');
        expect(resolved.diagnostics.privateInteractionTitle).toBe('第二道题');
    });

    it('private-required prompt 即使 interaction id/kind/source/option id 相同，只要 option value 漂移也必须判定 stale-private-overlay', () => {
        const sharedState = buildPrivateRequiredInteractionState();
        const driftedSeatState = {
            ...buildPrivateRequiredInteractionState(),
            sys: {
                ...buildPrivateRequiredInteractionState().sys,
                interaction: {
                    ...buildPrivateRequiredInteractionState().sys?.interaction,
                    current: {
                        ...buildPrivateRequiredInteractionState().sys?.interaction?.current,
                        data: {
                            ...buildPrivateRequiredInteractionState().sys?.interaction?.current?.data,
                            options: [
                                { id: 'hand-a', label: '候选 A', value: { cardUid: 'hand-b' } },
                            ],
                        },
                    },
                },
            },
        } as MatchState<unknown>;

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.visibleState).toBe(sharedState);
        expect(resolved.diagnostics.sharedInteractionOptionSignature).toBe('hand-a:0:null');
        expect(resolved.diagnostics.privateInteractionOptionSignature).toBe('hand-a:0:{"cardUid":"hand-b"}');
    });

    it('private-required stale overlay 的 blockedKey 应包含 interaction semantic fingerprint，避免同 turn/phase/eventStream 的新 prompt 被旧冷却吞掉', async () => {
        const gameId = '__test_online_ai_blocked_key_interaction_semantics__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const dispatch = await resolveNextAiDispatch({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredInteractionState(),
            matchId: 'match-online-ai-blocked-key-interaction-semantics',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: () => buildBlockedDecisionView(),
        });

        expect(dispatch.kind).toBe('blocked');
        if (dispatch.kind !== 'blocked') {
            return;
        }
        expect(dispatch.blockedKey).toContain('owner-prompt-1');
        expect(dispatch.blockedKey).toContain('simple-choice');
        expect(dispatch.blockedKey).toContain('super_spies_secret_agent_discard');
    });

    it('private-required stale overlay 即使 turn/phase/currentPlayer/eventStream 相同，只要 interaction sourceId 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_interaction_source_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredInteractionState(),
            matchId: 'match-online-ai-blocked-key-interaction-source-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView(),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView({
                diagnostics: {
                    sharedInteractionSourceId: 'super_spies_the_spy_who_ditched_me_discard',
                    privateInteractionSourceId: 'super_spies_the_spy_who_ditched_me_discard',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required stale overlay 即使 turn/phase/currentPlayer/eventStream 相同，只要 interaction option signature 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_interaction_option_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredInteractionState(),
            matchId: 'match-online-ai-blocked-key-interaction-option-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView(),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView({
                diagnostics: {
                    sharedInteractionOptionSignature: 'hand-a:0,hand-b:0',
                    privateInteractionOptionSignature: 'hand-a:0',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required stale overlay 即使 turn/phase/currentPlayer/eventStream 相同，只要 interaction title 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_interaction_title_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredInteractionState(),
            matchId: 'match-online-ai-blocked-key-interaction-title-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView(),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView({
                diagnostics: {
                    sharedInteractionTitle: '第二道题',
                    privateInteractionTitle: '第二道题',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required stale overlay 即使 turn/phase/currentPlayer/eventStream 相同，只要 interaction option value 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_interaction_option_value_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredInteractionState(),
            matchId: 'match-online-ai-blocked-key-interaction-option-value-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView(),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => buildBlockedDecisionView({
                diagnostics: {
                    sharedInteractionOptionSignature: 'hand-a:0:{"cardUid":"hand-b"}',
                    privateInteractionOptionSignature: 'hand-a:0:{"cardUid":"hand-b"}',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('response-window responder 漂移时，private-required 应判 stale-private-overlay', () => {
        const sharedState = buildPrivateRequiredResponseWindowState('1');
        const driftedSeatState = buildPrivateRequiredResponseWindowState('0');

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.diagnostics.sharedResponseWindowResponderId).toBe('1');
        expect(resolved.diagnostics.privateResponseWindowResponderId).toBe('0');
    });

    it('response-window 即使 id/type/source/responder 相同，只要 responderQueue 漂移也应判 stale-private-overlay', () => {
        const sharedState = {
            ...buildPrivateRequiredResponseWindowState('1'),
            sys: {
                ...buildPrivateRequiredResponseWindowState('1').sys,
                responseWindow: {
                    current: {
                        ...buildPrivateRequiredResponseWindowState('1').sys?.responseWindow?.current,
                        responderQueue: ['1', '2'],
                    },
                },
            },
        } as MatchState<unknown>;
        const driftedSeatState = buildPrivateRequiredResponseWindowState('1');

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: driftedSeatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(false);
        expect(resolved.blockedReason).toBe('stale-private-overlay');
        expect(resolved.diagnostics.sharedResponseWindowQueueSignature).toBe('1|2');
        expect(resolved.diagnostics.privateResponseWindowQueueSignature).toBe('1');
    });

    it('private-required response-window 即使 id/type/source 相同，只要 responder 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_response_window_responder_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredResponseWindowState('1'),
            matchId: 'match-online-ai-blocked-key-response-window-responder-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => {
                const state = buildPrivateRequiredResponseWindowState('1');
                return {
                    kind: 'online-ai-decision-view',
                    visibility: 'private-required',
                    sharedState: state,
                    privateOverlay: buildPrivateRequiredResponseWindowState('0'),
                    visibleState: state,
                    canDecide: false,
                    blockedReason: 'stale-private-overlay',
                    diagnostics: {
                        sharedPhase: 'defensiveRoll',
                        privatePhase: 'defensiveRoll',
                        sharedTurnNumber: 4,
                        privateTurnNumber: 4,
                        sharedCurrentPlayerId: '1',
                        privateCurrentPlayerId: '0',
                        sharedEventStreamNextId: 21,
                        privateEventStreamNextId: 21,
                        sharedInteractionId: null,
                        privateInteractionId: null,
                        sharedInteractionKind: null,
                        privateInteractionKind: null,
                        sharedInteractionSourceId: null,
                        privateInteractionSourceId: null,
                        sharedInteractionOptionSignature: null,
                        privateInteractionOptionSignature: null,
                        sharedResponseWindowId: 'rw-owner-only-1',
                        privateResponseWindowId: 'rw-owner-only-1',
                        sharedResponseWindowType: 'afterRollConfirmed',
                        privateResponseWindowType: 'afterRollConfirmed',
                        sharedResponseWindowSourceId: 'attack-1',
                        privateResponseWindowSourceId: 'attack-1',
                        sharedResponseWindowResponderId: '1',
                        privateResponseWindowResponderId: '0',
                        sharedResponseWindowQueueSignature: '1',
                        privateResponseWindowQueueSignature: '0',
                    },
                };
            },
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => {
                const state = buildPrivateRequiredResponseWindowState('1');
                return {
                    kind: 'online-ai-decision-view',
                    visibility: 'private-required',
                    sharedState: state,
                    privateOverlay: buildPrivateRequiredResponseWindowState('0'),
                    visibleState: state,
                    canDecide: false,
                    blockedReason: 'stale-private-overlay',
                    diagnostics: {
                        sharedPhase: 'defensiveRoll',
                        privatePhase: 'defensiveRoll',
                        sharedTurnNumber: 4,
                        privateTurnNumber: 4,
                        sharedCurrentPlayerId: '1',
                        privateCurrentPlayerId: '0',
                        sharedEventStreamNextId: 21,
                        privateEventStreamNextId: 21,
                        sharedInteractionId: null,
                        privateInteractionId: null,
                        sharedInteractionKind: null,
                        privateInteractionKind: null,
                        sharedInteractionSourceId: null,
                        privateInteractionSourceId: null,
                        sharedInteractionOptionSignature: null,
                        privateInteractionOptionSignature: null,
                        sharedResponseWindowId: 'rw-owner-only-1',
                        privateResponseWindowId: 'rw-owner-only-1',
                        sharedResponseWindowType: 'afterRollConfirmed',
                        privateResponseWindowType: 'afterRollConfirmed',
                        sharedResponseWindowSourceId: 'attack-1',
                        privateResponseWindowSourceId: 'attack-1',
                        sharedResponseWindowResponderId: '1',
                        privateResponseWindowResponderId: '1',
                        sharedResponseWindowQueueSignature: '1',
                        privateResponseWindowQueueSignature: '1',
                    },
                };
            },
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required response-window 即使 id/type/source/responder 相同，只要 queue signature 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_response_window_queue_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredResponseWindowState('1'),
            matchId: 'match-online-ai-blocked-key-response-window-queue-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1|2',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1|2',
                    privateResponseWindowQueueSignature: '1|2',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required response-window 即使 type/source/responder/queue 相同，只要 window id 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_response_window_id_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredResponseWindowState('1'),
            matchId: 'match-online-ai-blocked-key-response-window-id-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-2',
                    privateResponseWindowId: 'rw-owner-only-2',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required response-window 即使 id/type/responder/queue 相同，只要 source 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_response_window_source_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredResponseWindowState('1'),
            matchId: 'match-online-ai-blocked-key-response-window-source-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-2',
                    privateResponseWindowSourceId: 'attack-2',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });

    it('private-required response-window 即使 id/source/responder/queue 相同，只要 windowType 漂移，blockedKey 也必须变化', async () => {
        const gameId = '__test_online_ai_blocked_key_response_window_type_drift__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => null,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const baseArgs = {
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildPrivateRequiredResponseWindowState('1'),
            matchId: 'match-online-ai-blocked-key-response-window-type-drift',
            seatControllers: {
                '1': { type: 'local-ai' as const },
            },
        };

        const firstDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollConfirmed',
                    privateResponseWindowType: 'afterRollConfirmed',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });
        const secondDispatch = await resolveNextAiDispatch({
            ...baseArgs,
            visibleStateResolver: () => ({
                kind: 'online-ai-decision-view',
                visibility: 'private-required',
                sharedState: buildPrivateRequiredResponseWindowState('1'),
                privateOverlay: buildPrivateRequiredResponseWindowState('1'),
                visibleState: buildPrivateRequiredResponseWindowState('1'),
                canDecide: false,
                blockedReason: 'stale-private-overlay',
                diagnostics: {
                    sharedPhase: 'defensiveRoll',
                    privatePhase: 'defensiveRoll',
                    sharedTurnNumber: 4,
                    privateTurnNumber: 4,
                    sharedCurrentPlayerId: '1',
                    privateCurrentPlayerId: '1',
                    sharedEventStreamNextId: 21,
                    privateEventStreamNextId: 21,
                    sharedInteractionId: null,
                    privateInteractionId: null,
                    sharedInteractionKind: null,
                    privateInteractionKind: null,
                    sharedInteractionSourceId: null,
                    privateInteractionSourceId: null,
                    sharedInteractionOptionSignature: null,
                    privateInteractionOptionSignature: null,
                    sharedResponseWindowId: 'rw-owner-only-1',
                    privateResponseWindowId: 'rw-owner-only-1',
                    sharedResponseWindowType: 'afterRollSkipped',
                    privateResponseWindowType: 'afterRollSkipped',
                    sharedResponseWindowSourceId: 'attack-1',
                    privateResponseWindowSourceId: 'attack-1',
                    sharedResponseWindowResponderId: '1',
                    privateResponseWindowResponderId: '1',
                    sharedResponseWindowQueueSignature: '1',
                    privateResponseWindowQueueSignature: '1',
                },
            }),
        });

        expect(firstDispatch.kind).toBe('blocked');
        expect(secondDispatch.kind).toBe('blocked');
        if (firstDispatch.kind !== 'blocked' || secondDispatch.kind !== 'blocked') {
            return;
        }
        expect(firstDispatch.blockedKey).not.toBe(secondDispatch.blockedKey);
    });
});
