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
});
