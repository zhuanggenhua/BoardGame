import { describe, expect, it } from 'vitest';
import { registerGameAiRuntime, resolveNextAiAction } from '..';
import type { MatchState } from '../../types';

const buildFactionSelectState = (): MatchState<unknown> => ({
    core: {
        turnOrder: ['0', '1'],
        currentPlayerIndex: 1,
    },
    sys: {
        phase: 'factionSelect',
        turnNumber: 1,
        interaction: { current: null, queue: [], isBlocked: false },
        responseWindow: { current: null },
    },
}) as MatchState<unknown>;

describe('AI 手动选派系', () => {
    it('勾选 manualFactionSelection 后，AI 不自动提交 setup 派系选择动作', async () => {
        const gameId = '__test_manual_faction_selection__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'select-faction-robots',
                    kind: 'select-faction',
                    label: '选择派系 robots',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'robots' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'select-faction-robots' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state: buildFactionSelectState(),
            matchId: 'local:manual-faction-selection',
            seatControllers: {
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        });

        expect(resolution).toBeNull();
    });

    it('勾选 manualFactionSelection 后，AI 也不自动提交 setup-select-faction 动作', async () => {
        const gameId = '__test_manual_setup_faction_selection__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'setup-select-faction-phoenixelves',
                    kind: 'setup-select-faction',
                    label: '选择阵营 phoenixelves',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'phoenixelves' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-faction-phoenixelves' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state: buildFactionSelectState(),
            matchId: 'local:manual-setup-faction-selection',
            seatControllers: {
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        });

        expect(resolution).toBeNull();
    });

    it('未勾选 manualFactionSelection 时，AI 仍按原逻辑自动选择派系', async () => {
        const gameId = '__test_auto_faction_selection_default__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'select-faction-robots',
                    kind: 'select-faction',
                    label: '选择派系 robots',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'robots' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'select-faction-robots' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state: buildFactionSelectState(),
            matchId: 'local:auto-faction-selection',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('select-faction');
        expect(resolution?.action.commands).toEqual([
            { type: 'SELECT_FACTION', payload: { factionId: 'robots' } },
        ]);
    });
});
