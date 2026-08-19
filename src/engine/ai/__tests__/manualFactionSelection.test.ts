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

const buildCharacterSelectState = (): MatchState<unknown> => ({
    core: {
        currentPlayerId: '1',
        hostStarted: false,
        selectedCharacters: {
            '0': 'monk',
            '1': 'unselected',
        },
    },
    sys: {
        phase: 'setup',
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

    it('勾选 manualFactionSelection 后，AI 也不自动提交 setup-select-character 动作', async () => {
        const gameId = '__test_manual_setup_character_selection__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'setup-select-character-samurai',
                    kind: 'setup-select-character',
                    label: '选择角色 samurai',
                    commands: [{ type: 'SELECT_CHARACTER', payload: { characterId: 'samurai' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-character-samurai' }),
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
            state: buildCharacterSelectState(),
            matchId: 'local:manual-setup-character-selection',
            seatControllers: {
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
        });

        expect(resolution).toBeNull();
    });

    it('勾选 manualSetupSelection 后，AI 也不自动提交 setup-select-character 动作', async () => {
        const gameId = '__test_manual_setup_selection_alias__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'setup-select-character-samurai',
                    kind: 'setup-select-character',
                    label: '选择角色 samurai',
                    commands: [{ type: 'SELECT_CHARACTER', payload: { characterId: 'samurai' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-character-samurai' }),
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
            state: buildCharacterSelectState(),
            matchId: 'local:manual-setup-selection-alias',
            seatControllers: {
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        });

        expect(resolution).toBeNull();
    });

    it('勾选 manualSetupSelection 后，AI 已选角色时仍应自动提交 setup-ready', async () => {
        const gameId = '__test_manual_setup_selection_ready_after_character__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                if (playerId !== '1') return [];
                const selectedCharacters = (state.core as {
                    selectedCharacters?: Record<string, unknown>;
                }).selectedCharacters ?? {};
                const readyPlayers = (state.core as {
                    readyPlayers?: Record<string, unknown>;
                }).readyPlayers ?? {};
                if (selectedCharacters[playerId] !== 'samurai' || readyPlayers[playerId] === true) {
                    return [];
                }
                return [{
                    actionId: 'setup-player-ready',
                    kind: 'setup-ready',
                    label: '准备完成',
                    commands: [{ type: 'PLAYER_READY', payload: {} }],
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

        const selectedState = {
            ...buildCharacterSelectState(),
            core: {
                ...(buildCharacterSelectState().core as Record<string, unknown>),
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'samurai',
                },
                readyPlayers: {
                    '0': true,
                    '1': false,
                },
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
            } as never,
            state: selectedState,
            matchId: 'local:manual-setup-selection-ready-after-character',
            seatControllers: {
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        });

        expect(resolution?.action.kind).toBe('setup-ready');
        expect(resolution?.action.commands).toEqual([
            { type: 'PLAYER_READY', payload: {} },
        ]);
    });

    it('自定义前置选择 action kind 未提供 adapter 时，manualSetupSelection 不应误拦截自动动作', async () => {
        const gameId = '__test_manual_setup_selection_custom_kind_without_adapter__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'setup-select-draft-ranger',
                    kind: 'setup-select-draft',
                    label: '选择草案 ranger',
                    commands: [{ type: 'SELECT_DRAFT', payload: { draftId: 'ranger' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-draft-ranger' }),
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
            state: buildCharacterSelectState(),
            matchId: 'local:manual-setup-selection-custom-kind-without-adapter',
            seatControllers: {
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        });

        expect(resolution?.action.kind).toBe('setup-select-draft');
    });

    it('自定义前置选择 action kind 提供 adapter 时，manualSetupSelection 应拦截自动动作', async () => {
        const gameId = '__test_manual_setup_selection_custom_kind_with_adapter__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'setup-select-draft-ranger',
                    kind: 'setup-select-draft',
                    label: '选择草案 ranger',
                    commands: [{ type: 'SELECT_DRAFT', payload: { draftId: 'ranger' } }],
                }];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-draft-ranger' }),
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {},
                systems: [],
                onlineAiRecovery: {
                    shouldTreatActionAsManualSetupSelection: ({ actionKind }) => (
                        actionKind === 'setup-select-draft' ? true : undefined
                    ),
                },
            } as never,
            state: buildCharacterSelectState(),
            matchId: 'local:manual-setup-selection-custom-kind-with-adapter',
            seatControllers: {
                '1': { type: 'local-ai', manualSetupSelection: true },
            },
        });

        expect(resolution).toBeNull();
    });

    it('开局选项状态为实施中时，共享 AI 决策层应在策略前过滤该选项', async () => {
        const gameId = '__test_setup_option_status_in_progress_filter__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [
                    {
                        actionId: 'setup-select-faction-in-progress',
                        kind: 'setup-select-faction',
                        label: '选择阵营 in-progress',
                        commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'in-progress' } }],
                        metadata: {
                            factionId: 'in-progress',
                            setupOptionStatus: 'in_progress',
                            setupOptionStatusReason: '测试阵营仍在实施中',
                        },
                    },
                    {
                        actionId: 'setup-select-faction-ready',
                        kind: 'setup-select-faction',
                        label: '选择阵营 ready',
                        commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'ready' } }],
                        metadata: { factionId: 'ready' },
                    },
                ];
            },
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-faction-in-progress' }),
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
            matchId: 'local:setup-option-status-filter',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.actionId).toBe('setup-select-faction-ready');
        expect(resolution?.action.commands).toEqual([
            { type: 'SELECT_FACTION', payload: { factionId: 'ready' } },
        ]);
    });

    it('所有开局选项都不可自动选择时，共享 AI 决策层不应提交动作', async () => {
        const gameId = '__test_setup_option_status_all_blocked__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => {
                if (playerId !== '1') return [];
                return [{
                    actionId: 'setup-select-character-in-progress',
                    kind: 'setup-select-character',
                    label: '选择角色 in-progress',
                    commands: [{ type: 'SELECT_CHARACTER', payload: { characterId: 'in-progress' } }],
                    metadata: { characterId: 'in-progress' },
                }];
            },
            resolveSetupOptionStatus: () => ({ status: 'in_progress', reason: '测试角色仍在实施中' }),
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => ({ actionId: 'setup-select-character-in-progress' }),
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
            state: buildCharacterSelectState(),
            matchId: 'local:setup-option-status-all-blocked',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution).toBeNull();
    });
});
