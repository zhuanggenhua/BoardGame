/* @vitest-environment happy-dom */
import { createElement, useEffect } from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchApi from '../../services/matchApi';
import { isMatchNotFoundError, useMatchStatus, validateStoredMatchSeat, type StoredMatchCredentials } from '../../hooks/match/useMatchStatus';
import { haveAiSeatCredentialsChanged, loadOnlineAiSeatState } from '../onlineAiSeats';
import type { GameManifestEntry } from '../../games/manifest.types';
import type { MatchState } from '../../engine/types';
import { registerGameAiRuntime, resolveNextAiAction, resolveNextAiDispatch, resolveOnlineAiDecisionView } from '../../engine/ai';
import {
    buildAiProgressMarker,
    LocalGameProvider,
    releaseAiAttemptKeyIfMatches,
    shouldRetryLocalAiAttemptAfterDispatch,
    tryReserveAiAttemptKey,
    useGameClient,
} from '../../engine/transport/react';
import {
    applyAiAutoRecoveryRejection,
    finalizeOnlineAiResolutionConfirmation,
    resolveForceAdvancePhaseAfterRecovery,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    submitOnlineAiResolution,
} from '../onlineAiForceSkip';
import { resolveOnlineHudPresence } from '../matchHudPresence';

type Player = { id: number; name?: string | null };

const buildStored = (overrides?: Partial<StoredMatchCredentials>): StoredMatchCredentials => ({
    matchID: 'match-1',
    playerID: '0',
    playerName: 'Alice',
    ...overrides,
});

const buildPlayers = (players: Player[]): Player[] => players;
const buildGameManifest = (): GameManifestEntry => ({
    id: 'smashup',
    type: 'game',
    enabled: true,
    titleKey: 'games.smashup.title',
    descriptionKey: 'games.smashup.description',
    category: 'card',
    playersKey: 'games.smashup.players',
    icon: 'gamepad-2',
    playerOptions: [2, 3],
    ai: {
        capture: false,
        localAi: true,
        remoteAi: false,
    },
});

describe('validateStoredMatchSeat', () => {
    it('缺失本地信息时不清理', () => {
        expect(validateStoredMatchSeat(null, [], '0').shouldClear).toBe(false);
        expect(validateStoredMatchSeat(buildStored({ playerID: undefined }), [], '0').shouldClear).toBe(false);
    });

    it('playerID 不匹配时不清理', () => {
        const stored = buildStored({ playerID: '0' });
        expect(validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Alice' }]), '1').shouldClear).toBe(false);
    });

    it('座位不存在时清理', () => {
        const stored = buildStored({ updatedAt: Date.now() - 20_000 });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 1, name: 'Bob' }]), '0');
        expect(result.shouldClear).toBe(true);
        expect(result.reason).toBe('missing_seat');
    });

    it('新写入的凭证遇到短暂缺席位时不立刻清理', () => {
        const stored = buildStored({ updatedAt: Date.now() });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 1, name: 'Bob' }]), '0');
        expect(result.shouldClear).toBe(false);
    });

    it('座位为空时清理', () => {
        const stored = buildStored({ updatedAt: Date.now() - 20_000 });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: '' }]), '0');
        expect(result.shouldClear).toBe(true);
        expect(result.reason).toBe('seat_empty');
    });

    it('新写入的凭证遇到 seat.name 短暂为空时不立刻清理', () => {
        const stored = buildStored({ updatedAt: Date.now() });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: '' }]), '0');
        expect(result.shouldClear).toBe(false);
    });

    it('昵称不一致时不清理（凭据才是认证手段）', () => {
        const stored = buildStored({ playerName: 'Alice' });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Carol' }]), '0');
        expect(result.shouldClear).toBe(false);
    });

    it('昵称一致时不清理', () => {
        const stored = buildStored({ playerName: 'Alice' });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Alice' }]), '0');
        expect(result.shouldClear).toBe(false);
    });

    it('本地无昵称时不做昵称校验', () => {
        const stored = buildStored({ playerName: undefined });
        const result = validateStoredMatchSeat(stored, buildPlayers([{ id: 0, name: 'Any' }]), '0');
        expect(result.shouldClear).toBe(false);
    });
});

describe('isMatchNotFoundError', () => {
    it('识别 404 异常对象', () => {
        expect(isMatchNotFoundError({ status: 404, message: 'Match not found' })).toBe(true);
    });

    it('识别带 404 文本的 Error', () => {
        expect(isMatchNotFoundError(new Error('404: Match not found'))).toBe(true);
    });

    it('忽略非 404 错误', () => {
        expect(isMatchNotFoundError(new Error('500: network error'))).toBe(false);
    });
});

describe('onlineAiSeats', () => {
    it('未显式配置在线 AI 座位时，不得套用本地默认 AI', async () => {
        const claimMissingSeatCredential = vi.fn(async (playerId: string) => `reclaimed-${playerId}`);

        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-human-only',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: '真人' }],
                setupData: {},
            },
            storedAiSeatCredentials: {},
            claimMissingSeatCredential,
        });

        expect(state.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
        });
        expect(claimMissingSeatCredential).not.toHaveBeenCalled();
        expect(state.seatCredentials).toEqual({});
    });

    it('缺少 enableAi 标记时，即使残留了 seatControllers 也不得把真人房识别成 AI 房', async () => {
        const claimMissingSeatCredential = vi.fn(async (playerId: string) => `reclaimed-${playerId}`);

        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-stale-ai-config',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: '真人' }],
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {},
            claimMissingSeatCredential,
        });

        expect(state.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
        });
        expect(state.seatCredentials).toEqual({});
        expect(claimMissingSeatCredential).not.toHaveBeenCalled();
    });

    it('显式 enableAi=false 时，应忽略残留的 AI seatControllers 与本地旧凭据', async () => {
        const claimMissingSeatCredential = vi.fn(async (playerId: string) => `reclaimed-${playerId}`);

        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-disabled',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: '真人' }],
                setupData: {
                    enableAi: false,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: { '1': 'stale-credential' },
            claimMissingSeatCredential,
        });

        expect(state.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'human' },
        });
        expect(state.seatCredentials).toEqual({});
        expect(claimMissingSeatCredential).not.toHaveBeenCalled();
    });

    it('回归：房主重进在线房间时，本地缺失 AI 凭据也不能把 AI 座位降级成人类', async () => {
        const claimMissingSeatCredential = vi.fn(async (playerId: string) => `reclaimed-${playerId}`);

        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-regression',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }],
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {},
            claimMissingSeatCredential,
        });

        expect(state.seatControllers['1']).toEqual({ type: 'local-ai', difficulty: 'normal' });
        expect(claimMissingSeatCredential).toHaveBeenCalledTimes(1);
        expect(claimMissingSeatCredential).toHaveBeenCalledWith('1');
        expect(state.seatCredentials).toEqual({ '1': 'reclaimed-1' });
    });

    it('缺少本地 AI 凭据时仍保留 AI 座位定义', async () => {
        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-1',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }],
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {},
        });

        expect(state.seatControllers['1']).toEqual({ type: 'local-ai', difficulty: 'normal' });
        expect(state.seatCredentials).toEqual({});
    });

    it('房主可补领缺失的 AI 凭据并合并现有凭据', async () => {
        const claimMissingSeatCredential = vi.fn(async (playerId: string) => `claimed-${playerId}`);

        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-2',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }, { id: 2, name: 'P2' }],
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'hard' },
                        '2': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {
                '1': 'existing-ai-1',
            },
            claimMissingSeatCredential,
        });

        expect(claimMissingSeatCredential).toHaveBeenCalledWith('2');
        expect(state.seatCredentials).toEqual({
            '1': 'existing-ai-1',
            '2': 'claimed-2',
        });
    });

    it('回归：matchInfo.players 暂未列出后续空座时，仍应从显式 seatControllers 恢复第二个 AI 座位', async () => {
        const claimMissingSeatCredential = vi.fn(async (playerId: string) => `claimed-${playerId}`);

        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-missing-empty-seat',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }],
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'hard' },
                        '2': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {
                '1': 'existing-ai-1',
            },
            claimMissingSeatCredential,
        });

        expect(state.seatControllers).toEqual({
            '0': { type: 'human' },
            '1': { type: 'local-ai', difficulty: 'hard' },
            '2': { type: 'local-ai', difficulty: 'normal' },
        });
        expect(claimMissingSeatCredential).toHaveBeenCalledWith('2');
        expect(state.seatCredentials).toEqual({
            '1': 'existing-ai-1',
            '2': 'claimed-2',
        });
    });

    it('兼容旧房间：缺少 enableAi 标记但已有本地 AI 凭据时，仍保留显式 AI 座位定义', async () => {
        const state = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-legacy',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }],
                setupData: {
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {
                '1': 'existing-ai-1',
            },
        });

        expect(state.seatControllers['1']).toEqual({ type: 'local-ai', difficulty: 'normal' });
        expect(state.seatCredentials).toEqual({ '1': 'existing-ai-1' });
    });

    it('enableAi=true 的真 AI 房，仍然允许 force-end-turn 收口卡死 AI', async () => {
        const onlineAiState = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-force-end-turn',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }],
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'normal' },
                    },
                },
            },
            storedAiSeatCredentials: {
                '1': 'existing-ai-1',
            },
        });

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    turnNumber: 3,
                    phase: 'playCards',
                },
            } as MatchState<unknown>,
            seatControllers: onlineAiState.seatControllers,
            seatStates: {},
        });

        expect(candidate?.reason).toBe('active-turn');
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'ADVANCE_PHASE', payload: {} },
        ]);
    });

    it('回归：factionSelect 阶段 AI seat 未就绪时，watchdog 只能走 legal-action recovery，不得用 ADVANCE_PHASE 跳过派系选择', async () => {
        const onlineAiState = await loadOnlineAiSeatState({
            gameConfig: buildGameManifest(),
            matchInfo: {
                matchID: 'match-ai-faction-select-stall',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }, { id: 1, name: 'P1' }],
                setupData: {
                    enableAi: true,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', difficulty: 'expert' },
                    },
                },
            },
            storedAiSeatCredentials: {
                '1': 'existing-ai-1',
            },
        });

        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 1,
                    factionSelection: {
                        takenFactions: ['steampunks_pod'],
                        playerSelections: {
                            '0': ['steampunks_pod'],
                            '1': [],
                        },
                        completedPlayers: [],
                    },
                },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    turnNumber: 1,
                    phase: 'factionSelect',
                },
            } as MatchState<unknown>,
            seatControllers: onlineAiState.seatControllers,
            seatStates: {},
        });

        expect(candidate).toMatchObject({
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
        });
        expect(candidate?.resolution.action.commands).toEqual([]);
    });

    it('仅凭据有变化时才触发持久化', () => {
        expect(haveAiSeatCredentialsChanged({}, {})).toBe(false);
        expect(haveAiSeatCredentialsChanged({ '1': 'same' }, { '1': 'same' })).toBe(false);
        expect(haveAiSeatCredentialsChanged({ '1': 'old' }, { '1': 'new' })).toBe(true);
    });
});

describe('resolveOnlineHudPresence', () => {
    it('在线传输未就绪时，不应把玩家误标成离线', () => {
        const result = resolveOnlineHudPresence({
            fallbackPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 1, name: '真人', isConnected: false },
            ],
            transportPlayers: [],
            transportReady: false,
            myPlayerId: '0',
        });

        expect(result.presenceReady).toBe(false);
        expect(result.opponentName).toBe('真人');
        expect(result.opponentConnected).toBeUndefined();
        expect(result.players.map((player) => player.isConnected)).toEqual([undefined, undefined]);
    });

    it('传输就绪后应优先采用在线同步的连接状态', () => {
        const result = resolveOnlineHudPresence({
            fallbackPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 1, name: '真人', isConnected: false },
            ],
            transportPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 1, name: '真人', isConnected: true },
            ],
            transportReady: true,
            myPlayerId: '0',
        });

        expect(result.presenceReady).toBe(true);
        expect(result.opponentName).toBe('真人');
        expect(result.opponentConnected).toBe(true);
        expect(result.players[1]?.isConnected).toBe(true);
    });

    it('AI 座位在 HUD 中应视作常在线，避免出现假离线提示', () => {
        const result = resolveOnlineHudPresence({
            fallbackPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 2, name: 'AI 2号位', isConnected: false },
            ],
            transportPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 2, name: 'AI 2号位', isConnected: false },
            ],
            transportReady: true,
            myPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '2': { type: 'local-ai', difficulty: 'normal' },
            },
        });

        expect(result.players.find((player) => player.id === 2)?.isConnected).toBe(true);
        expect(result.opponentName).toBe('AI 2号位');
        expect(result.opponentConnected).toBe(true);
    });
});

describe('resolveNextAiAction 在线视角', () => {
    it('公开 setup 决策在 private overlay 过期时，仍应基于 authoritative shared 继续', async () => {
        const gameId = '__test_online_ai_shared_setup_fallback__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const phase = (state.sys as { phase?: string })?.phase;
                const currentPlayerId = (state.core as { currentPlayerId?: string })?.currentPlayerId;
                if (phase !== 'factionSelect' || currentPlayerId !== playerId) {
                    return [];
                }
                return [{
                    actionId: `select-faction-${playerId}`,
                    kind: 'select-faction',
                    label: `由 ${playerId} 选择派系`,
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'robots' } }],
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
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'factionSelect',
                turnNumber: 3,
                interaction: { current: null, queue: [], isBlocked: false },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const staleSeatState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'draw',
                turnNumber: 2,
                interaction: { current: null, queue: [], isBlocked: false },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-online-ai-shared-setup-fallback',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay: staleSeatState,
                playerId,
            }),
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('select-faction');
        expect(resolution?.action.commands).toEqual([
            { type: 'SELECT_FACTION', payload: { factionId: 'robots' } },
        ]);
    });

    it('private-required 决策在 private overlay 过期时，仍必须阻止 AI 出手', async () => {
        const gameId = '__test_online_ai_private_overlay_stale_guard__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { playerId?: string };
                    };
                })?.interaction?.current;
                if (interaction?.playerId !== playerId) {
                    return [];
                }
                return [{
                    actionId: `respond-${playerId}`,
                    kind: 'interaction-choice',
                    label: `由 ${playerId} 响应`,
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: `pick-${playerId}` } }],
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
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'summon',
                turnNumber: 5,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const staleSeatState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'draw',
                turnNumber: 4,
                interaction: {
                    current: {
                        id: 'hidden-choice',
                        playerId: '1',
                    },
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-online-ai-private-overlay-stale-guard',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay: staleSeatState,
                playerId,
            }),
        });

        expect(resolution).toBeNull();
    });

    it('共享态未阻断且无交互时，private overlay 的旧交互必须判定为过期并阻止 AI 出手', async () => {
        const gameId = '__test_online_ai_private_overlay_stale_hidden_interaction__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { id?: string; playerId?: string };
                    };
                })?.interaction?.current;
                if (!interaction || interaction.playerId !== playerId) {
                    return [];
                }
                return [{
                    actionId: `respond-${playerId}`,
                    kind: 'interaction-choice',
                    label: `由 ${playerId} 响应`,
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: `pick-${playerId}` } }],
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
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 12,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const staleSeatState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 12,
                interaction: {
                    current: {
                        id: 'stale-hidden-choice',
                        playerId: '1',
                    },
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-online-ai-private-overlay-stale-hidden-interaction',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay: staleSeatState,
                playerId,
            }),
        });

        expect(resolution).toBeNull();
    });

    it('private overlay 过期时，调度层应返回 blocked 结果而不是空结果', async () => {
        const gameId = '__test_online_ai_dispatch_blocked_result__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { id?: string; playerId?: string };
                    };
                })?.interaction?.current;
                if (!interaction || interaction.playerId !== playerId) {
                    return [];
                }
                return [{
                    actionId: `respond-${playerId}`,
                    kind: 'interaction-choice',
                    label: `由 ${playerId} 响应`,
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: `pick-${playerId}` } }],
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
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 12,
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const staleSeatState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 12,
                interaction: {
                    current: {
                        id: 'stale-hidden-choice',
                        playerId: '1',
                    },
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const dispatchResult = await resolveNextAiDispatch({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-online-ai-dispatch-blocked-result',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay: staleSeatState,
                playerId,
            }),
        });

        expect(dispatchResult.kind).toBe('blocked');
        if (dispatchResult.kind !== 'blocked') {
            return;
        }
        expect(dispatchResult.playerId).toBe('1');
        expect(dispatchResult.blockedReason).toBe('stale-private-overlay');
        expect(dispatchResult.visibility).toBe('private-required');
    });

    it('response window 当前 responder 不是 activePlayer 时，仍应允许 AI 响应', async () => {
        const gameId = '__test_online_ai_response_window_responder_not_active_player__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const responseWindow = (state.sys as {
                    responseWindow?: {
                        current?: {
                            responderQueue?: string[];
                            currentResponderIndex?: number;
                        };
                    };
                })?.responseWindow?.current;
                const currentResponderId = responseWindow?.responderQueue?.[responseWindow.currentResponderIndex ?? 0];
                if (currentResponderId !== playerId) {
                    return [];
                }
                return [{
                    actionId: 'response-pass',
                    kind: 'response-pass',
                    label: '跳过响应',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
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
            core: {
                currentPlayerId: '0',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 9,
                eventStream: { nextId: 42 },
                interaction: { current: null, queue: [], isBlocked: false },
                responseWindow: {
                    current: {
                        id: 'rw-def-1',
                        sourceId: 'attack-1',
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as MatchState<unknown>;

        const privateOverlay = {
            core: {
                currentPlayerId: '0',
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 9,
                eventStream: { nextId: 42 },
                interaction: { current: null, queue: [], isBlocked: false },
                responseWindow: {
                    current: {
                        id: 'rw-def-1',
                        sourceId: 'attack-1',
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-online-ai-response-window-responder-not-active-player',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                sharedState,
                privateOverlay,
                playerId,
            }),
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('response-pass');
        expect(resolution?.action.commands).toEqual([
            { type: 'RESPONSE_PASS', payload: {} },
        ]);
    });

    it('在线 AI 应优先使用 seat 自己同步到的状态，才能看到隐藏交互', async () => {
        const gameId = '__test_online_ai_hidden_interaction__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { id?: string; playerId?: string };
                    };
                })?.interaction?.current;
                if (!interaction || interaction.playerId !== playerId || interaction.id !== 'ai-choice') {
                    return [];
                }
                return [{
                    actionId: 'respond-ai-choice',
                    kind: 'interaction-choice',
                    label: '响应交互',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } }],
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

        const filteredHumanState = {
            core: {},
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const aiSeatState = {
            core: {},
            sys: {
                interaction: {
                    current: {
                        id: 'ai-choice',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'wizard_sacrifice',
                            options: [{ id: 'pick-1', label: '选择唯一目标', value: { minionUid: 'm1' } }],
                        },
                    },
                    queue: [],
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const engineConfig = {
            gameId,
            domain: {} as never,
            systems: [],
        };

        const withoutSeatState = await resolveNextAiAction({
            engineConfig,
            state: filteredHumanState,
            matchId: 'match-online-ai-hidden',
            seatControllers: { '1': { type: 'local-ai' } },
        });
        expect(withoutSeatState).toBeNull();

        const withSeatState = await resolveNextAiAction({
            engineConfig,
            state: filteredHumanState,
            matchId: 'match-online-ai-hidden',
            seatControllers: { '1': { type: 'local-ai' } },
            visibleStateResolver: (playerId) => (playerId === '1' ? aiSeatState : undefined),
        });
        expect(withSeatState?.playerId).toBe('1');
        expect(withSeatState?.action.kind).toBe('interaction-choice');
        expect(withSeatState?.action.commands).toEqual([
            { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } },
        ]);
    });

    it('多个 AI seat 并存时，应由持有隐藏交互的那个 seat 响应', async () => {
        const gameId = '__test_online_ai_hidden_interaction_multi_seat__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { id?: string; playerId?: string };
                    };
                })?.interaction?.current;
                if (!interaction || interaction.playerId !== playerId) {
                    return [];
                }
                return [{
                    actionId: `respond-${playerId}`,
                    kind: 'interaction-choice',
                    label: `由 ${playerId} 响应`,
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: `pick-${playerId}` } }],
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

        const sharedFilteredState = {
            core: {},
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const seatOneState = {
            core: {},
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const seatTwoState = {
            core: {},
            sys: {
                interaction: {
                    current: {
                        id: 'seat-2-choice',
                        kind: 'simple-choice',
                        playerId: '2',
                        data: {
                            sourceId: 'shared_hidden_prompt',
                            options: [{ id: 'pick-2', label: '仅 2 号位可见', value: { chosenBy: '2' } }],
                        },
                    },
                    queue: [],
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedFilteredState,
            matchId: 'match-online-ai-hidden-multi-seat',
            seatControllers: {
                '1': { type: 'local-ai' },
                '2': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => {
                if (playerId === '1') return seatOneState;
                if (playerId === '2') return seatTwoState;
                return undefined;
            },
        });

        expect(resolution?.playerId).toBe('2');
        expect(resolution?.action.commands).toEqual([
            { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-2' } },
        ]);
    });

    it('在线 AI 的 response window reopening 即使 legal actions 不变，也应生成新的 attemptKey', async () => {
        const gameId = '__test_online_ai_response_window_attempt_key__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const responseWindow = (state.sys as {
                    responseWindow?: {
                        current?: {
                            responderQueue?: string[];
                            currentResponderIndex?: number;
                        };
                    };
                })?.responseWindow?.current;
                const currentResponderId = responseWindow?.responderQueue?.[responseWindow.currentResponderIndex ?? 0];
                if (currentResponderId !== playerId) {
                    return [];
                }
                return [{
                    actionId: 'response-pass',
                    kind: 'response-pass',
                    label: '跳过响应',
                    commands: [{ type: 'RESPONSE_PASS', payload: {} }],
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

        const buildState = (windowId: string, sourceId: string): MatchState<unknown> => ({
            core: {},
            sys: {
                turnNumber: 7,
                phase: 'offensiveRoll',
                eventStream: { nextId: 42 },
                interaction: { current: null, queue: [] },
                responseWindow: {
                    current: {
                        id: windowId,
                        sourceId,
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as MatchState<unknown>);

        const first = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildState('rw-after-roll-1', 'roll-signature-1'),
            matchId: 'match-online-ai-response-window',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        const reopened = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: buildState('rw-after-roll-2', 'roll-signature-2'),
            matchId: 'match-online-ai-response-window',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(first?.action.kind).toBe('response-pass');
        expect(reopened?.action.kind).toBe('response-pass');
        expect(first?.attemptKey).not.toBe(reopened?.attemptKey);
    });

    it('响应窗口当前 responder 为 AI 但 legal actions 为空时，应回退 RESPONSE_PASS 防止卡死', async () => {
        const gameId = '__test_online_ai_response_window_empty_actions__';
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

        const state = {
            core: {},
            sys: {
                turnNumber: 9,
                phase: 'afterRollConfirmed',
                eventStream: { nextId: 101 },
                interaction: { current: null, queue: [] },
                responseWindow: {
                    current: {
                        id: 'rw-empty-1',
                        sourceId: 'roll-signature-empty',
                        windowType: 'afterRollConfirmed',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state,
            matchId: 'match-online-ai-response-window-empty',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.action.kind).toBe('response-pass');
        expect(resolution?.action.commands).toEqual([
            { type: 'RESPONSE_PASS', payload: {} },
        ]);
    });

    it('local-ai policy 抛错时，应回退到首个合法动作，避免 watchdog 直接推进空回合', async () => {
        const gameId = '__test_online_ai_local_policy_throw_fallback__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => [{
                actionId: `select-faction-${playerId}`,
                kind: 'select-faction',
                label: `由 ${playerId} 选择派系`,
                commands: [{ type: 'su:select_faction', payload: { factionId: 'aliens' } }],
            }],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: () => {
                        throw new Error('policy_crashed');
                    },
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: {
                core: {},
                sys: {
                    interaction: { current: null, queue: [] },
                    responseWindow: {},
                },
            } as MatchState<unknown>,
            matchId: 'match-online-ai-local-policy-throw',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('select-faction');
        expect(resolution?.action.commands).toEqual([
            { type: 'su:select_faction', payload: { factionId: 'aliens' } },
        ]);
    });

    it('其他 seat 仅看到 isBlocked=true 时，不应继续生成普通动作抢跑', async () => {
        const gameId = '__test_online_ai_hidden_interaction_blocked_guard__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { id?: string; playerId?: string };
                    };
                })?.interaction?.current;
                if (interaction?.playerId === playerId) {
                    return [{
                        actionId: `respond-${playerId}`,
                        kind: 'interaction-choice',
                        label: `由 ${playerId} 响应`,
                        commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: `pick-${playerId}` } }],
                    }];
                }

                const currentPlayerId = (state.core as { currentPlayerId?: string })?.currentPlayerId;
                if (currentPlayerId === playerId) {
                    return [{
                        actionId: `advance-${playerId}`,
                        kind: 'advance-phase',
                        label: `由 ${playerId} 结束阶段`,
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

        const sharedFilteredState = {
            core: {},
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const blockedSeatState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const hiddenInteractionSeatState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                interaction: {
                    current: {
                        id: 'seat-2-choice',
                        kind: 'simple-choice',
                        playerId: '2',
                        data: {
                            sourceId: 'shared_hidden_prompt',
                            options: [{ id: 'pick-2', label: '仅 2 号位可见', value: { chosenBy: '2' } }],
                        },
                    },
                    queue: [],
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedFilteredState,
            matchId: 'match-online-ai-hidden-blocked-guard',
            seatControllers: {
                '1': { type: 'local-ai' },
                '2': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => {
                if (playerId === '1') return blockedSeatState;
                if (playerId === '2') return hiddenInteractionSeatState;
                return undefined;
            },
        });

        expect(resolution?.playerId).toBe('2');
        expect(resolution?.action.kind).toBe('interaction-choice');
        expect(resolution?.action.commands).toEqual([
            { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-2' } },
        ]);
    });

    it('seat 专属状态未同步时，应跳过该 AI，而不是回退到共享视角生成普通动作', async () => {
        const gameId = '__test_online_ai_hidden_interaction_wait_for_seat_state__';
        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const interaction = (state.sys as {
                    interaction?: {
                        current?: { playerId?: string };
                    };
                })?.interaction?.current;
                if (interaction?.playerId === playerId) {
                    return [{
                        actionId: `respond-${playerId}`,
                        kind: 'interaction-choice',
                        label: `由 ${playerId} 响应`,
                        commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: `pick-${playerId}` } }],
                    }];
                }

                const currentPlayerId = (state.core as { currentPlayerId?: string })?.currentPlayerId;
                if (currentPlayerId === playerId) {
                    return [{
                        actionId: `advance-${playerId}`,
                        kind: 'advance-phase',
                        label: `由 ${playerId} 结束阶段`,
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

        const sharedFilteredState = {
            core: {
                currentPlayerId: '1',
            },
            sys: {
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: true,
                },
                responseWindow: {},
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId,
                domain: {} as never,
                systems: [],
            },
            state: sharedFilteredState,
            matchId: 'match-online-ai-hidden-wait-for-seat-state',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: () => null,
        });

        expect(resolution).toBeNull();
    });
});

describe('submitOnlineAiResolution', () => {

    it('batch confirmed 后会回写对应 seat 的最新状态', () => {
        const updateLatestState = vi.fn();
        const resync = vi.fn();
        const sendBatch = vi.fn((_batchId, _commands, onConfirmed) => {
            onConfirmed?.({ sys: { phase: 'playCards' } });
        });

        const lastAiAttemptKeyRef = { current: null as string | null };

        submitOnlineAiResolution({
            client: {
                sendBatch,
                updateLatestState,
                resync,
            },

            resolution: {
                playerId: '1',
                attemptKey: 'attempt-confirmed',
                source: 'local-ai',
                action: {
                    actionId: 'respond-choice',
                    kind: 'interaction-choice',
                    label: '响应',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } }],
                },
            },
            lastAiAttemptKeyRef,
            scheduleRetry: vi.fn(),
        });

        expect(lastAiAttemptKeyRef.current).toBe('attempt-confirmed');
        expect(sendBatch).toHaveBeenCalledTimes(1);
        expect(updateLatestState).toHaveBeenCalledWith({ sys: { phase: 'playCards' } });
    });

    it('batch rejected 后会清空 attemptKey 并安排重试；unauthorized 不重试', () => {
        const retry = vi.fn();
        const resync = vi.fn();
        const lastAiAttemptKeyRef = { current: null as string | null };
        let rejectHandler: ((reason: string) => void) | undefined;
        const sendBatch = vi.fn((_batchId, _commands, _onConfirmed, onRejected) => {
            rejectHandler = onRejected;
        });

        submitOnlineAiResolution({
            client: {
                sendBatch,
                updateLatestState: vi.fn(),
                resync,
            },

            resolution: {
                playerId: '1',
                attemptKey: 'attempt-rejected',
                source: 'local-ai',
                action: {
                    actionId: 'respond-choice',
                    kind: 'interaction-choice',
                    label: '响应',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } }],
                },
            },
            lastAiAttemptKeyRef,
            scheduleRetry: retry,
        });

        rejectHandler?.('command_failed');
        expect(lastAiAttemptKeyRef.current).toBeNull();
        expect(resync).toHaveBeenCalledTimes(1);
        expect(retry).toHaveBeenCalledTimes(1);

        submitOnlineAiResolution({
            client: {
                sendBatch,
                updateLatestState: vi.fn(),
                resync,
            },

            resolution: {
                playerId: '1',
                attemptKey: 'attempt-unauthorized',
                source: 'local-ai',
                action: {
                    actionId: 'respond-choice',
                    kind: 'interaction-choice',
                    label: '响应',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } }],
                },
            },
            lastAiAttemptKeyRef,
            scheduleRetry: retry,
        });

        rejectHandler?.('unauthorized');
        expect(lastAiAttemptKeyRef.current).toBeNull();
        expect(resync).toHaveBeenCalledTimes(1);
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('confirmed / rejected 回调应透传给调用方', () => {
        const onConfirmed = vi.fn();
        const onRejected = vi.fn();
        const resync = vi.fn();
        let rejectHandler: ((reason: string) => void) | undefined;
        const sendBatch = vi.fn((_batchId, _commands, confirmed, rejected) => {
            confirmed?.({ sys: { phase: 'playCards' } });
            rejectHandler = rejected;
        });

        submitOnlineAiResolution({
            client: {
                sendBatch,
                updateLatestState: vi.fn(),
                resync,
            },
            resolution: {
                playerId: '1',
                attemptKey: 'attempt-callbacks',
                source: 'local-ai',
                action: {
                    actionId: 'respond-choice',
                    kind: 'interaction-choice',
                    label: '响应',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } }],
                },
            },
            lastAiAttemptKeyRef: { current: null },
            scheduleRetry: vi.fn(),
            onConfirmed,
            onRejected,
        });

        expect(onConfirmed).toHaveBeenCalledWith({ sys: { phase: 'playCards' } });
        rejectHandler?.('command_failed');
        expect(onRejected).toHaveBeenCalledWith('command_failed');
    });
});

describe('finalizeOnlineAiResolutionConfirmation', () => {
    it('confirmed 后应释放当前 attemptKey 并触发下一拍重试', () => {
        const scheduleRetry = vi.fn();
        const lastAiAttemptKeyRef = { current: 'attempt-confirmed' as string | null };

        const continued = finalizeOnlineAiResolutionConfirmation({
            lastAiAttemptKeyRef,
            resolutionAttemptKey: 'attempt-confirmed',
            scheduleRetry,
        });

        expect(continued).toBe(true);
        expect(lastAiAttemptKeyRef.current).toBeNull();
        expect(scheduleRetry).toHaveBeenCalledTimes(1);
    });

    it('旧确认不应清掉已切到新 attempt 的锁，也不应插入陈旧重试', () => {
        const scheduleRetry = vi.fn();
        const lastAiAttemptKeyRef = { current: 'attempt-newer' as string | null };

        const continued = finalizeOnlineAiResolutionConfirmation({
            lastAiAttemptKeyRef,
            resolutionAttemptKey: 'attempt-older',
            scheduleRetry,
        });

        expect(continued).toBe(false);
        expect(lastAiAttemptKeyRef.current).toBe('attempt-newer');
        expect(scheduleRetry).not.toHaveBeenCalled();
    });
});

describe('applyAiAutoRecoveryRejection', () => {
    it('同一失败原因只应提示一次，换原因后才重新提示', () => {
        const first = applyAiAutoRecoveryRejection({
            key: 'force-skip:1:hidden',
            firstSeenAt: 100,
            autoSubmittedAt: 200,
            lastReportedFailureReason: null,
            candidate: { playerId: '1' },
        }, 'command_failed', 300);

        expect(first.shouldNotify).toBe(true);
        expect(first.nextTracker.firstSeenAt).toBe(300);
        expect(first.nextTracker.autoSubmittedAt).toBeNull();
        expect(first.nextTracker.lastReportedFailureReason).toBe('command_failed');
        expect(first.nextTracker.key).toBe('force-skip:1:hidden');
        expect(first.nextTracker.candidate).toEqual({ playerId: '1' });

        const repeated = applyAiAutoRecoveryRejection(first.nextTracker, 'command_failed', 400);
        expect(repeated.shouldNotify).toBe(false);
        expect(repeated.nextTracker.lastReportedFailureReason).toBe('command_failed');

        const changedReason = applyAiAutoRecoveryRejection(repeated.nextTracker, 'unauthorized', 500);
        expect(changedReason.shouldNotify).toBe(true);
        expect(changedReason.nextTracker.lastReportedFailureReason).toBe('unauthorized');
    });
});

describe('resolveForceSkippableHiddenAiInteraction', () => {
    it('隐藏的 AI simple-choice 只剩控制选项时，应返回强制跳过 resolution', () => {
        const candidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'hoverbot-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    sourceId: 'robot_hoverbot',
                                    title: '盘旋机器人',
                                    options: [
                                        { id: 'skip', label: '跳过', value: { skip: true } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        expect(candidate?.playerId).toBe('1');
        expect(candidate?.interactionId).toBe('hoverbot-hidden');
        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'skip' },
        });
    });

    it('隐藏交互包含可执行选项时，不应返回强制跳过 resolution', () => {
        const candidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'hoverbot-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    sourceId: 'robot_hoverbot',
                                    title: '盘旋机器人',
                                    options: [
                                        { id: 'play', label: '打出', value: { cardUid: 'c1' } },
                                        { id: 'skip', label: '跳过', value: { skip: true } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        expect(candidate).toBeNull();
    });
    it('隐藏交互只剩 __emergency_skip__ 或 done 时，也应返回自动收口 resolution', () => {
        const emergencyCandidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'empty-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    sourceId: 'base_inventors_salon',
                                    options: [
                                        { id: '__emergency_skip__', label: '跳过（无可用选项）', value: { __emergency_skip__: true } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        expect(emergencyCandidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: '__emergency_skip__' },
        });

        const doneCandidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'done-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    sourceId: 'zombie_lord_pick',
                                    options: [
                                        { id: 'done', label: '完成', value: { done: true } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        expect(doneCandidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { optionId: 'done' },
        });
    });

    it('可空选但仍有可执行选项的隐藏 AI multi 交互时，不应返回强制跳过 resolution', () => {
        const candidate = resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'optional-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    multi: { min: 0, max: 2 },
                                    options: [
                                        { id: 'pick-1', label: '选项 1', value: { id: 1 } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        expect(candidate).toBeNull();
    });

    it('非阻塞态或不可跳过的交互时，不应返回强制跳过 resolution', () => {
        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        })).toBeNull();

        expect(resolveForceSkippableHiddenAiInteraction({
            sharedState: {
                core: {},
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'mandatory-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    options: [
                                        { id: 'only', label: '必须点', value: { id: 1 } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        })).toBeNull();
    });
});

describe('resolveForceEndTurnForStalledAi', () => {
    it('隐藏交互卡住 8 秒后，应先收口交互再 ADVANCE_PHASE', () => {
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: true,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {},
                    sys: {
                        interaction: {
                            current: {
                                id: 'hidden-skip',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    options: [
                                        { id: 'skip', label: '跳过', value: { skip: true } },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
        });

        expect(candidate?.reason).toBe('hidden-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } },
        ]);
    });

    it('不可跳过的交互卡住时，应改为 CANCEL 后再 ADVANCE_PHASE', () => {
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'visible-mandatory',
                            playerId: '1',
                            kind: 'simple-choice',
                            data: {
                                options: [
                                    { id: 'only', label: '必须点', value: { cardUid: 'c1' } },
                                ],
                            },
                        },
                        queue: [],
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('visible-interaction');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'SYS_INTERACTION_CANCEL', payload: {} },
        ]);
    });

    it('响应窗口卡住时，应 RESPONSE_PASS 后再 ADVANCE_PHASE', () => {
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                    },
                    responseWindow: {
                        current: {
                            responderQueue: ['1'],
                            currentResponderIndex: 0,
                        },
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('response-window');
        expect(candidate?.requiresConfirmedAdvancePhase).toBe(true);
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'RESPONSE_PASS', payload: {} },
        ]);
    });

    it('无交互阻塞但轮到 AI 时，应直接 ADVANCE_PHASE', () => {
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    turnNumber: 3,
                    phase: 'playCards',
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            seatStates: {},
        });

        expect(candidate?.reason).toBe('active-turn');
        expect(candidate?.resolution.action.commands).toEqual([
            { type: 'ADVANCE_PHASE', payload: {} },
        ]);
    });

    it('交互收口确认后，仅在 AI 仍持有回合且界面已解锁时才补发 ADVANCE_PHASE', () => {
        const followUp = resolveForceAdvancePhaseAfterRecovery({
            authoritativeState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: undefined,
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                    turnNumber: 3,
                    phase: 'playCards',
                    eventStream: {
                        nextId: 12,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            playerId: '1',
        });

        expect(followUp?.action.commands).toEqual([
            { type: 'ADVANCE_PHASE', payload: {} },
        ]);
    });
});

describe('本地 AI 无进展重试判定', () => {
    const buildProgressState = (
        overrides?: Partial<MatchState<unknown>>,
    ): MatchState<unknown> => ({
        core: {
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
        },
        sys: {
            turnNumber: 1,
            phase: 'playCards',
            eventStream: { nextId: 5 },
            interaction: { current: null, queue: [] },
            responseWindow: { current: null },
        },
        ...overrides,
    } as MatchState<unknown>);

    it('attemptKey 未变化且状态 marker 未推进时，应允许解锁重试', () => {
        const previousState = buildProgressState();
        const nextState = buildProgressState();

        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: false,
            activeAttemptKey: 'attempt-1',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState),
            nextState,
        })).toBe(true);
    });

    it('状态 marker 已推进或 attemptKey 已切换时，不应重复重试', () => {
        const previousState = buildProgressState();
        const advancedState = buildProgressState({
            sys: {
                turnNumber: 1,
                phase: 'playCards',
                eventStream: { nextId: 6 },
                interaction: { current: null, queue: [] },
                responseWindow: { current: null },
            },
        });

        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: false,
            activeAttemptKey: 'attempt-1',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState),
            nextState: advancedState,
        })).toBe(false);

        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: false,
            activeAttemptKey: 'attempt-2',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState),
            nextState: previousState,
        })).toBe(false);

        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: true,
            activeAttemptKey: 'attempt-1',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState),
            nextState: previousState,
        })).toBe(false);
    });
});

describe('AI attemptKey 预占位', () => {
    it('同一个 attemptKey 在发送前只应保留一次，避免延迟窗口内重复调度', () => {
        const ref = { current: null as string | null };

        expect(tryReserveAiAttemptKey(ref, 'attempt-1')).toBe(true);
        expect(ref.current).toBe('attempt-1');

        expect(tryReserveAiAttemptKey(ref, 'attempt-1')).toBe(false);
        expect(ref.current).toBe('attempt-1');

        expect(tryReserveAiAttemptKey(ref, 'attempt-2')).toBe(true);
        expect(ref.current).toBe('attempt-2');
    });

    it('仅当当前 key 仍匹配时才释放预占位，避免误清空后续新 attempt', () => {
        const ref = { current: 'attempt-2' as string | null };

        releaseAiAttemptKeyIfMatches(ref, 'attempt-1');
        expect(ref.current).toBe('attempt-2');

        releaseAiAttemptKeyIfMatches(ref, 'attempt-2');
        expect(ref.current).toBeNull();
    });
});

describe('LocalGameProvider AI 重试集成', () => {
    afterEach(() => {
        vi.useRealTimers();
        cleanup();
    });

    it('本地 AI 命令被领域校验拒绝后，会在解锁后自动再尝试一轮', async () => {
        const gameId = '__test_local_ai_retry_after_rejection__';
        const decideSpy = vi.fn(() => {
            const callIndex = decideSpy.mock.calls.length;
            return callIndex <= 2 ? { actionId: 'invalid-action' } : null;
        });

        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId }) => (
                playerId === '1'
                    ? [{
                        actionId: 'invalid-action',
                        kind: 'main-action',
                        label: '触发失败命令',
                        commands: [{ type: 'FAIL_CMD', payload: { reason: 'retry-check' } }],
                    }]
                    : []
            ),
            localPolicies: {
                default: {
                    id: 'default',
                    decide: decideSpy,
                },
            },
            defaultLocalPolicyId: 'default',
        });

        const engineConfig = {
            gameId,
            domain: {
                gameId,
                setup: () => ({
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 1,
                }),
                validate: (_state: MatchState<unknown>, command: { type: string }) => (
                    command.type === 'FAIL_CMD'
                        ? { valid: false, error: 'rule_blocked' }
                        : { valid: true }
                ),
                execute: () => [],
                reduce: (core: unknown) => core,
            },
            systems: [],
        } as const;

        render(createElement(
            LocalGameProvider,
            {
                config: engineConfig as never,
                numPlayers: 2,
                seed: 'local-ai-retry-seed',
                seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } },
            },
            createElement('div', null, 'local-ai-retry'),
        ));

        await waitFor(() => {
            expect(decideSpy).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(decideSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
        }, { timeout: 1000 });
    });
});

describe('LocalGameProvider 视角与重置契约', () => {
    afterEach(() => {
        cleanup();
    });

    it('传入固定 playerId 且关闭 followCurrentTurnPlayer 时，不应因当前回合变成对手而翻转视角', async () => {
        const engineConfig = {
            gameId: '__test_local_fixed_player_view__',
            domain: {
                gameId: '__test_local_fixed_player_view__',
                setup: () => ({
                    turnOrder: ['0', '1'],
                    currentPlayerIndex: 1,
                }),
                validate: () => ({ valid: true }),
                execute: () => [],
                reduce: (core: unknown) => core,
            },
            systems: [],
        } as const;

        const Probe = () => {
            const { playerId } = useGameClient();
            return createElement('div', { 'data-testid': 'local-fixed-player-view' }, playerId ?? 'null');
        };

        render(
            createElement(
                LocalGameProvider,
                {
                    config: engineConfig as never,
                    numPlayers: 2,
                    seed: 'local-fixed-player-view-seed',
                    playerId: '0',
                    followCurrentTurnPlayer: false,
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'human' },
                    },
                },
                createElement(Probe),
            ),
        );

        await waitFor(() => {
            expect(screen.getByTestId('local-fixed-player-view')).toHaveTextContent('0');
        });
    });

    it('reset 应透传原始 setupData，避免重赛掉回默认配置', async () => {
        const setupData = { preferredMap: 'desert', expansions: ['titans'] };
        const setupSpy = vi.fn((_playerIds: string[], _random: unknown, receivedSetupData?: unknown) => ({
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            setupEcho: receivedSetupData,
        }));
        let resetRef: (() => void) | undefined;

        const engineConfig = {
            gameId: '__test_local_reset_setup_data__',
            domain: {
                gameId: '__test_local_reset_setup_data__',
                setup: setupSpy,
                validate: () => ({ valid: true }),
                execute: () => [],
                reduce: (core: unknown) => core,
            },
            systems: [],
        } as const;

        const Probe = () => {
            const { reset } = useGameClient();
            useEffect(() => {
                resetRef = reset;
            }, [reset]);
            return createElement('div', { 'data-testid': 'local-reset-setup-probe' }, 'ready');
        };

        render(
            createElement(
                LocalGameProvider,
                {
                    config: engineConfig as never,
                    numPlayers: 2,
                    seed: 'local-reset-setup-seed',
                    setupData,
                },
                createElement(Probe),
            ),
        );

        await waitFor(() => {
            expect(screen.getByTestId('local-reset-setup-probe')).toBeInTheDocument();
            expect(setupSpy).toHaveBeenCalledTimes(1);
        });

        act(() => {
            resetRef?.();
        });

        await waitFor(() => {
            expect(setupSpy).toHaveBeenCalledTimes(2);
        });
        expect(setupSpy.mock.calls[0]?.[2]).toEqual(setupData);
        expect(setupSpy.mock.calls[1]?.[2]).toEqual(setupData);
    });
});

describe('useMatchStatus 竞态保护', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        cleanup();
    });

    it('切换 matchID 后，旧请求 404 不会污染新房间状态', async () => {
        let rejectOldRequest!: (reason?: unknown) => void;
        const oldRequest = new Promise<never>((_, reject) => {
            rejectOldRequest = reject;
        });

        const getMatchSpy = vi.spyOn(matchApi, 'getMatch').mockImplementation(async (_gameName, matchID) => {
            if (matchID === 'old-match') {
                return oldRequest as never;
            }
            return {
                matchID: 'new-match',
                gameName: 'dicethrone',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            };
        });

        const { result, rerender } = renderHook(
            ({ id }) => useMatchStatus('dicethrone', id, '0'),
            { initialProps: { id: 'old-match' as string | undefined } }
        );

        await waitFor(() => {
            expect(getMatchSpy).toHaveBeenCalledWith('dicethrone', 'old-match');
        });

        rerender({ id: 'new-match' });

        await waitFor(() => {
            expect(getMatchSpy).toHaveBeenCalledWith('dicethrone', 'new-match');
        });

        await act(async () => {
            rejectOldRequest(new Error('404: Match not found'));
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(result.current.matchID).toBe('new-match');
            expect(result.current.error).toBeNull();
            expect(result.current.isLoading).toBe(false);
        });
    });
});

describe('Home 活跃对局缺房确认', () => {
    let Home: typeof import('../Home').Home;
    let latestStoredMatch: StoredMatchCredentials | null;
    let storedMatch: StoredMatchCredentials | null;
    let lobbyPresenceState: {
        matches: Array<{ matchID: string; gameName: string; players: unknown[] }>;
        hasSnapshot: boolean;
        hasSeen: boolean;
        exists: boolean;
        isMissing: boolean;
    };
    let getMatchMock: ReturnType<typeof vi.fn>;
    let clearMatchCredentialsMock: ReturnType<typeof vi.fn>;
    let clearOwnerActiveMatchMock: ReturnType<typeof vi.fn>;
    let publishMatchCleanupNoticeMock: ReturnType<typeof vi.fn>;
    let markMatchCleanupNoticeSeenMock: ReturnType<typeof vi.fn>;
    let toastWarningMock: ReturnType<typeof vi.fn>;
    let toastErrorMock: ReturnType<typeof vi.fn>;
    let navigateMock: ReturnType<typeof vi.fn>;
    let setSearchParamsMock: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.resetModules();

        latestStoredMatch = {
            matchID: 'match-1',
            playerID: '0',
            credentials: 'cred-1',
            gameName: 'tictactoe',
            updatedAt: 1,
        };
        storedMatch = latestStoredMatch;
        lobbyPresenceState = {
            matches: [{ matchID: 'match-1', gameName: 'tictactoe', players: [] }],
            hasSnapshot: true,
            hasSeen: true,
            exists: true,
            isMissing: false,
        };

        getMatchMock = vi.fn()
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockRejectedValueOnce(new Error('404: not found'));

        clearMatchCredentialsMock = vi.fn(() => {
            latestStoredMatch = null;
            storedMatch = null;
        });
        clearOwnerActiveMatchMock = vi.fn();
        publishMatchCleanupNoticeMock = vi.fn(() => ({
            matchID: 'match-1',
            reason: 'destroyed',
            timestamp: Date.now(),
            nonce: 'notice-1',
        }));
        markMatchCleanupNoticeSeenMock = vi.fn();
        toastWarningMock = vi.fn();
        toastErrorMock = vi.fn();
        navigateMock = vi.fn();
        setSearchParamsMock = vi.fn();

        vi.doMock('react-router-dom', () => ({
            useNavigate: () => navigateMock,
            useSearchParams: () => [new URLSearchParams(), setSearchParamsMock],
        }));

        vi.doMock('react-i18next', () => ({
            useTranslation: () => ({
                t: (key: string) => key,
                i18n: { resolvedLanguage: 'zh-CN', language: 'zh-CN' },
            }),
        }));

        vi.doMock('../../components/layout/CategoryPills', () => ({
            CategoryPills: () => null,
        }));
        vi.doMock('../../components/lobby/GameDetailsModal', () => ({
            GameDetailsModal: () => null,
        }));
        vi.doMock('../../components/lobby/GameList', () => ({
            GameList: () => null,
        }));
        vi.doMock('../../components/auth/AuthModal', () => ({
            AuthModal: () => null,
        }));
        vi.doMock('../../components/common/overlays/ConfirmModal', () => ({
            ConfirmModal: () => null,
        }));
        vi.doMock('../../components/common/i18n/LanguageSwitcher', () => ({
            LanguageSwitcher: () => null,
        }));
        vi.doMock('../../components/social/UserMenu', () => ({
            UserMenu: () => null,
        }));
        vi.doMock('../../components/common/SEO', () => ({
            SEO: () => null,
        }));

        vi.doMock('../../config/games.config', () => ({
            getGamesByCategory: () => [],
            getGameById: () => null,
            refreshUgcGames: vi.fn().mockResolvedValue(undefined),
            subscribeGameRegistry: () => () => undefined,
        }));

        vi.doMock('../../contexts/AuthContext', () => ({
            useAuth: () => ({
                user: null,
                token: null,
                logout: vi.fn(),
            }),
        }));

        vi.doMock('../../contexts/ModalStackContext', () => ({
            useModalStack: () => ({
                openModal: vi.fn(() => 'modal-1'),
                closeModal: vi.fn(),
            }),
        }));

        vi.doMock('../../contexts/ToastContext', () => ({
            useToast: () => ({
                warning: toastWarningMock,
                error: toastErrorMock,
            }),
        }));

        vi.doMock('../../hooks/routing/useUrlModal', () => ({
            useUrlModal: () => ({
                navigateAwayRef: { current: vi.fn() },
            }),
        }));

        vi.doMock('../../hooks/useLobbyStats', () => ({
            useLobbyStats: () => ({ mostPopularGameId: null }),
        }));

        vi.doMock('../../hooks/useLobbyMatchPresence', () => ({
            useLobbyMatchPresence: () => lobbyPresenceState,
        }));

        vi.doMock('../../core/cursor/useGlobalCursor', () => ({
            useGlobalCursor: () => undefined,
        }));

        vi.doMock('../../services/matchApi', () => ({
            getMatch: getMatchMock,
        }));

        vi.doMock('../../hooks/match/useMatchStatus', async () => {
            const actual = await vi.importActual<typeof import('../../hooks/match/useMatchStatus')>('../../hooks/match/useMatchStatus');
            return {
                ...actual,
                getLatestStoredMatchCredentials: () => latestStoredMatch,
                pruneStoredMatchCredentials: vi.fn(),
                getOwnerActiveMatch: () => null,
                clearMatchCredentials: clearMatchCredentialsMock,
                clearOwnerActiveMatch: clearOwnerActiveMatchMock,
                publishMatchCleanupNotice: publishMatchCleanupNoticeMock,
                readMatchCleanupNotice: () => null,
                hasSeenMatchCleanupNotice: () => false,
                markMatchCleanupNoticeSeen: markMatchCleanupNoticeSeenMock,
                isOwnerActiveMatchSuppressed: () => false,
                readStoredMatchCredentials: () => storedMatch,
            };
        });

        Home = (await import('../Home')).Home;
    });

    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('宽限期确认成功后会重置确认标记，后续真正销毁时仍会再次确认并清理', async () => {
        const { rerender } = render(createElement(Home));

        await screen.findByText('lobby:home.activeMatch.status');
        expect(getMatchMock).toHaveBeenCalledTimes(1);

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        rerender(createElement(Home));

        await waitFor(() => {
            expect(getMatchMock).toHaveBeenCalledTimes(2);
        });
        expect(clearMatchCredentialsMock).not.toHaveBeenCalled();
        expect(clearOwnerActiveMatchMock).not.toHaveBeenCalled();

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [{ matchID: 'match-1', gameName: 'tictactoe', players: [] }],
            exists: true,
            isMissing: false,
        };
        rerender(createElement(Home));

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        rerender(createElement(Home));

        await waitFor(() => {
            expect(getMatchMock).toHaveBeenCalledTimes(3);
            expect(clearMatchCredentialsMock).toHaveBeenCalledWith('match-1');
        });
        expect(clearOwnerActiveMatchMock).toHaveBeenCalledWith('match-1');
        expect(markMatchCleanupNoticeSeenMock).toHaveBeenCalled();
        expect(toastWarningMock).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
        await waitFor(() => {
            expect(screen.queryByText('lobby:home.activeMatch.status')).toBeNull();
        });
    });

    it('缺房确认遇到非 404 时会延迟重试，直到后续确认 404 再清理', async () => {
        vi.useFakeTimers();
        getMatchMock.mockReset()
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockRejectedValueOnce(new Error('500: transient error'))
            .mockRejectedValueOnce(new Error('404: not found'));

        try {
            const flushEffects = async () => {
                await act(async () => {
                    await Promise.resolve();
                });
                await act(async () => {
                    await Promise.resolve();
                });
            };

            const { rerender } = render(createElement(Home));
            await flushEffects();
            expect(getMatchMock).toHaveBeenCalledTimes(1);

            lobbyPresenceState = {
                ...lobbyPresenceState,
                matches: [],
                exists: false,
                isMissing: true,
            };
            rerender(createElement(Home));
            await flushEffects();
            expect(getMatchMock).toHaveBeenCalledTimes(2);
            expect(clearMatchCredentialsMock).not.toHaveBeenCalled();

            await act(async () => {
                await vi.advanceTimersByTimeAsync(1500);
            });
            await flushEffects();

            expect(getMatchMock).toHaveBeenCalledTimes(3);
            expect(clearMatchCredentialsMock).toHaveBeenCalledWith('match-1');
            expect(clearOwnerActiveMatchMock).toHaveBeenCalledWith('match-1');
            expect(toastWarningMock).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
        } finally {
            vi.useRealTimers();
        }
    });

    it('大厅快照持续更新时不会取消进行中的缺房确认', async () => {
        let rejectMissingCheck!: (reason?: unknown) => void;
        const pendingMissingCheck = new Promise<never>((_, reject) => {
            rejectMissingCheck = reject;
        });

        getMatchMock.mockReset()
            .mockResolvedValueOnce({
                matchID: 'match-1',
                gameName: 'tictactoe',
                players: [{ id: 0, name: 'Alice', isConnected: true }],
            })
            .mockImplementationOnce(() => pendingMissingCheck)
            .mockImplementation(() => new Promise(() => undefined));

        const { rerender } = render(createElement(Home));

        await screen.findByText('lobby:home.activeMatch.status');
        expect(getMatchMock).toHaveBeenCalledTimes(1);

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [],
            exists: false,
            isMissing: true,
        };
        rerender(createElement(Home));

        await waitFor(() => {
            expect(getMatchMock).toHaveBeenCalledTimes(2);
        });

        lobbyPresenceState = {
            ...lobbyPresenceState,
            matches: [{ matchID: 'match-2', gameName: 'tictactoe', players: [] }],
            exists: false,
            isMissing: true,
        };
        await act(async () => {
            rerender(createElement(Home));
            await Promise.resolve();
        });

        expect(getMatchMock).toHaveBeenCalledTimes(2);

        await act(async () => {
            rejectMissingCheck({ status: 404, message: 'Match not found' });
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(clearMatchCredentialsMock).toHaveBeenCalledWith('match-1');
            expect(clearOwnerActiveMatchMock).toHaveBeenCalledWith('match-1');
        });
        expect(markMatchCleanupNoticeSeenMock).toHaveBeenCalled();
        expect(toastWarningMock).toHaveBeenCalledWith({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
    });
});
