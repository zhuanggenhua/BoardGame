import { describe, expect, it } from 'vitest';
import type { MatchState } from '../../types';
import { registerGameAiRuntime, resolveNextAiDispatch } from '../index';
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

function buildCompareRollVisibleState(args?: {
    currentPlayerId?: string;
    interactionId?: string;
    interactionPlayerId?: string;
    contestantPlayerIds?: string[];
    eventStreamNextId?: number;
    isBlocked?: boolean;
}): MatchState<unknown> {
    const contestantPlayerIds = args?.contestantPlayerIds ?? ['0', '1'];
    return {
        core: {
            currentPlayerId: args?.currentPlayerId ?? '1',
        },
        sys: {
            phase: 'defensiveRoll',
            turnNumber: 3,
            eventStream: {
                nextId: args?.eventStreamNextId ?? 42,
                entries: [],
            },
            interaction: {
                current: {
                    id: args?.interactionId ?? 'compare-roll-1',
                    kind: 'compare-roll-choice',
                    playerId: args?.interactionPlayerId ?? '0',
                    data: {
                        title: 'compareRoll.gunslingerDuel.title',
                        contestants: contestantPlayerIds.map((playerId, index) => ({
                            playerId,
                            roll: 5 - index,
                            labelKey: index === 0
                                ? 'compareRoll.gunslingerDuel.attacker'
                                : 'compareRoll.gunslingerDuel.defender',
                        })),
                        options: [
                            { id: 'accept', label: '确认' },
                        ],
                    },
                },
                queue: [],
                isBlocked: args?.isBlocked ?? false,
            },
            responseWindow: {},
        },
    } as MatchState<unknown>;
}

describe('resolveOnlineAiDecisionView', () => {
    it('phase 为空但 event/currentPlayer 对齐时，不应把私有视角误判为过期', async () => {
        const gameId = '__test_online_ai_phase_less_private_overlay__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const core = state.core as {
                    currentPlayer?: string;
                    stage?: string;
                } | undefined;
                if (core?.currentPlayer !== playerId || core?.stage !== 'draw') {
                    return [];
                }
                return [{
                    actionId: `draw-${playerId}`,
                    kind: 'draw-card',
                    label: `draw-${playerId}`,
                    commands: [{ type: 'DRAW_FROM_DECK', payload: {} }],
                }];
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

        const sharedState = {
            sys: {
                phase: '',
                turnNumber: 0,
                eventStream: {
                    nextId: 4,
                    entries: [],
                },
                interaction: { current: null, queue: [], isBlocked: false },
                responseWindow: { current: null },
            },
            core: {
                currentPlayer: '1',
                turn: 2,
                stage: 'draw',
            },
        } as MatchState<unknown>;
        const seatState = structuredClone(sharedState);

        const resolved = resolveOnlineAiDecisionView({
            sharedState,
            privateOverlay: seatState,
            playerId: '1',
        });

        expect(resolved.visibility).toBe('private-required');
        expect(resolved.canDecide).toBe(true);
        expect(resolved.blockedReason).toBeNull();
        expect(resolved.visibleState).toBe(seatState);

        const dispatch = await resolveNextAiDispatch({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-phase-less-private-overlay',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay: seatState,
                playerId,
            }),
        });

        expect(dispatch.kind).toBe('action');
        if (dispatch.kind !== 'action') {
            return;
        }
        expect(dispatch.resolution.playerId).toBe('1');
        expect(dispatch.resolution.action.commands).toEqual([
            { type: 'DRAW_FROM_DECK', payload: {} },
        ]);
    });

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

    it('compare-roll contestants 变化时，离开可见集合的 seat 必须清掉旧 current，新进入者必须拿到新 current', () => {
        const updatedSharedState = buildCompareRollVisibleState({
            currentPlayerId: '2',
            contestantPlayerIds: ['0', '2'],
        });
        const staleSeatStateForPlayer1 = buildCompareRollVisibleState({
            currentPlayerId: '1',
            contestantPlayerIds: ['0', '1'],
            isBlocked: true,
        });

        const formerContestantView = resolveOnlineAiDecisionView({
            sharedState: updatedSharedState,
            privateOverlay: staleSeatStateForPlayer1,
            playerId: '1',
        });

        expect(formerContestantView.visibility).toBe('shared');
        expect(formerContestantView.canDecide).toBe(true);
        expect(formerContestantView.blockedReason).toBeNull();
        expect(formerContestantView.visibleState).toBe(updatedSharedState);
        expect(formerContestantView.visibleState.sys?.interaction?.current).toMatchObject({
            id: 'compare-roll-1',
            kind: 'compare-roll-choice',
            playerId: '0',
        });
        expect(
            Array.isArray(formerContestantView.visibleState.sys?.interaction?.current?.data?.contestants)
                && formerContestantView.visibleState.sys?.interaction?.current?.data?.contestants
                    .some((contestant: any) => contestant.playerId === '1'),
        ).toBe(false);

        const newlyVisibleContestantView = resolveOnlineAiDecisionView({
            sharedState: updatedSharedState,
            privateOverlay: null,
            playerId: '2',
        });

        expect(newlyVisibleContestantView.visibility).toBe('shared');
        expect(newlyVisibleContestantView.canDecide).toBe(true);
        expect(newlyVisibleContestantView.blockedReason).toBeNull();
        expect(newlyVisibleContestantView.visibleState).toBe(updatedSharedState);
        expect(newlyVisibleContestantView.visibleState.sys?.interaction?.current).toMatchObject({
            id: 'compare-roll-1',
            kind: 'compare-roll-choice',
            playerId: '0',
        });
        expect(
            newlyVisibleContestantView.visibleState.sys?.interaction?.current?.data?.contestants,
        ).toEqual(expect.arrayContaining([
            expect.objectContaining({ playerId: '2' }),
        ]));
    });

    it('factionSelect shared state 滞后时，应使用更新的 seat snapshot 避免重复给上一位 AI 派发', async () => {
        const gameId = '__test_online_ai_faction_select_stale_shared__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const currentPlayerId = (state.core as { currentPlayerId?: string } | undefined)?.currentPlayerId;
                if (currentPlayerId !== playerId) {
                    return [];
                }
                return [{
                    actionId: `select-faction-${playerId}`,
                    kind: 'select-faction',
                    label: `select-faction-${playerId}`,
                    commands: [{ type: 'su:select_faction', payload: { factionId: `faction-${playerId}` } }],
                }];
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

        const staleSharedState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'factionSelect',
                turnNumber: 1,
                eventStream: {
                    nextId: 10,
                    entries: [],
                },
                interaction: { current: null, queue: [], isBlocked: false },
                responseWindow: { current: null },
            },
        } as MatchState<unknown>;
        const freshSeatState = {
            ...staleSharedState,
            core: {
                currentPlayerId: '2',
            },
            sys: {
                ...staleSharedState.sys,
                eventStream: {
                    nextId: 11,
                    entries: [],
                },
            },
        } as MatchState<unknown>;

        const dispatch = await resolveNextAiDispatch({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: staleSharedState,
            matchId: 'match-faction-select-stale-shared',
            seatControllers: {
                '1': { type: 'local-ai' },
                '2': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState: staleSharedState,
                privateOverlay: freshSeatState,
                playerId,
            }),
        });

        expect(dispatch.kind).toBe('action');
        if (dispatch.kind !== 'action') {
            return;
        }
        expect(dispatch.resolution.playerId).toBe('2');
        expect(dispatch.resolution.action.commands).toEqual([
            { type: 'su:select_faction', payload: { factionId: 'faction-2' } },
        ]);
    });
});
