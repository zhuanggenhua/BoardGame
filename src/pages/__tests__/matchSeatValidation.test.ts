/* @vitest-environment happy-dom */
import { createElement, useEffect } from 'react';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as matchApi from '../../services/matchApi';
import {
    clearMatchCredentials,
    isMatchNotFoundError,
    leaveMatch,
    persistMatchCredentials,
    readStoredMatchCredentials,
    useMatchStatus,
    validateStoredMatchSeat,
    type StoredMatchCredentials,
} from '../../hooks/match/useMatchStatus';
import {
    haveAiSeatCredentialsChanged,
    loadOnlineAiSeatState,
    resolveOnlineAiSeatClaimOptions,
    resolveMissingOnlineAiSeatCredentialIds,
} from '../onlineAiSeats';
import type { GameManifestEntry } from '../../games/manifest.types';
import type { MatchState } from '../../engine/types';
import type { GameEngineConfig } from '../../engine/transport/engineConfig';
import { registerGameAiRuntime, resolveNextAiAction, resolveNextAiDispatch, resolveOnlineAiDecisionView, getGameAiRuntime } from '../../engine/ai';
import {
    buildAiProgressMarker,
    LocalGameProvider,
    releaseAiAttemptKeyIfMatches,
    shouldForwardOnlineBatchRejectionToError,
    shouldRecoverFromRejectedCommandError,
    shouldRetryLocalAiAttemptAfterDispatch,
    tryReserveAiAttemptKey,
    useGameClient,
} from '../../engine/transport/react';
import { buildLocalMatchSnapshotKey, persistLocalMatchSnapshot } from '../../engine/transport/localSession';
import {
    applyAiAutoRecoveryRejection,
    finalizeOnlineAiResolutionConfirmation,
    resolveOnlineAiAutoRecoveryCompletionNotice,
    resolveForceAdvancePhaseAfterRecovery,
    resolveForceEndTurnForStalledAi,
    resolveForceSkippableHiddenAiInteraction,
    shouldSilentlyRetryOnlineAiBatchRejection,
    submitOnlineAiResolution,
} from '../onlineAiForceSkip';
import {
    isTutorialRoutePath,
    shouldShowOnlineGameErrorToast,
} from '../matchRoomRuntime';
import {
    resolveOnlineManualSetupTakeoverPlayerId,
    resolveManualSetupAttemptReleaseSource,
    resolveManualSetupSelectionActionKindFromCommand,
    resolveManualSetupSelectionId,
    resolveManualSetupSelectionTakeoverPlayerId,
    shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt,
    shouldReleaseFactionSelectAttemptFromSharedState,
    shouldReleaseManualSetupAttemptFromSharedState,
    shouldTakeOverManualSetupSelection,
} from '../matchManualSetup';
import { resolveMissingMatchConfirmationSignal } from '../matchMissingConfirmation';
import {
    buildOnlineAiIdleSeatRecoveryKey,
    buildOnlineAiSeamAwareAttemptMarkers,
    buildOnlineAiSeamAwareProgressMarker,
    buildOnlineAiSubmitBlockedRecoveryKey,
    resolveManualOnlineAiRecovery,
    resolveOnlineAiEffectiveSeatState,
    resolveOnlineAiEffectiveSeatStates,
    shouldRetainOnlineAiSeatOverrideAfterLatestState,
    shouldStageOnlineAiSeatOverrideFromConfirmedState,
} from '../onlineAiRecovery';
import { resolveMatchRoomRouteIdentity } from '../matchRouteIdentity';
import { resolveSmashUpLocalPregameControlledPlayerId } from '../../games/smashup/localPregameControl';
import { resolveOnlineHudPresence } from '../matchHudPresence';
import {
    resolveMatchSeatSwapContext,
    type MatchSeatSwapConfig,
} from '../../components/game/framework/matchSeatSwap';
import { findMatchPlayerInfo, resolveMatchPlayerConnected } from '../../engine/transport/matchPlayers';
import { resolveExitMatchErrorMessageKey } from '../../components/lobby/roomActions';
import { diceThroneAiRuntime } from '../../games/dicethrone/ai';

type Player = { id: number; name?: string | null };

vi.mock('../../games/registry', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../games/registry')>();
    const { diceThroneGameRuntimeAdapter } = await import('../../games/dicethrone/runtimeAdapter');
    const { smashUpGameRuntimeAdapter } = await import('../../games/smashup/runtimeAdapter');
    const { summonerWarsGameRuntimeAdapter } = await import('../../games/summonerwars/runtimeAdapter');

    return {
        ...actual,
        getGameImplementation: (gameId: string) => {
            const implementation = actual.getGameImplementation(gameId);
            if (gameId === 'dicethrone') {
                return implementation
                    ? { ...implementation, runtimeAdapter: diceThroneGameRuntimeAdapter }
                    : { runtimeAdapter: diceThroneGameRuntimeAdapter };
            }
            if (gameId === 'smashup') {
                return implementation
                    ? { ...implementation, runtimeAdapter: smashUpGameRuntimeAdapter }
                    : { runtimeAdapter: smashUpGameRuntimeAdapter };
            }
            if (gameId === 'summonerwars') {
                return implementation
                    ? { ...implementation, runtimeAdapter: summonerWarsGameRuntimeAdapter }
                    : { runtimeAdapter: summonerWarsGameRuntimeAdapter };
            }
            return implementation;
        },
    };
});

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

const buildOnlineAiSeatState = (args?: {
    nextId?: number;
    phase?: string;
    currentPlayerId?: string;
    interactionId?: string;
    interactionSourceId?: string;
}): MatchState<unknown> => ({
    core: {
        currentPlayerId: args?.currentPlayerId ?? '1',
    },
    sys: {
        phase: args?.phase ?? 'playCards',
        turnNumber: 1,
        decisionEpoch: 0,
        eventStream: {
            nextId: args?.nextId ?? 1,
            entries: [],
        },
        interaction: {
            current: args?.interactionId
                ? {
                    id: args.interactionId,
                    sourceId: args.interactionSourceId ?? args.interactionId,
                    data: {
                        sourceId: args.interactionSourceId ?? args.interactionId,
                        options: [],
                    },
                }
                : undefined,
            queue: [],
            isBlocked: Boolean(args?.interactionId),
        },
        responseWindow: {},
    },
}) as MatchState<unknown>;

const createOnlineAiMarkerEngineConfig = (): Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> => ({
    gameId: 'dicethrone',
    onlineAiRecovery: {
        activeTurnLegalActionOnlyPhases: ['offensiveRoll', 'targetingRoll', 'defensiveRoll'],
        resolveCurrentPlayerId: ({ state, phase, fallbackPlayerId }) => {
            if (phase !== 'defensiveRoll') {
                return fallbackPlayerId;
            }
            const pendingAttack = (state.core as {
                pendingAttack?: {
                    defenderId?: unknown;
                };
            } | undefined)?.pendingAttack;
            return typeof pendingAttack?.defenderId === 'string'
                ? pendingAttack.defenderId
                : fallbackPlayerId;
        },
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

describe('isTutorialRoutePath', () => {
    it('正确识别默认教程与子教程路由', () => {
        expect(isTutorialRoutePath('/play/dicethrone/tutorial')).toBe(true);
        expect(isTutorialRoutePath('/play/smashup/tutorial/cowboys-duel')).toBe(true);
    });

    it('不会把普通对局或测试路由误判成教程路由', () => {
        expect(isTutorialRoutePath('/play/dicethrone')).toBe(false);
        expect(isTutorialRoutePath('/play/dicethrone/match/m-1')).toBe(false);
    });
});

describe('resolveMissingMatchConfirmationSignal', () => {
    it('只有联机同步通道明确的 match_not_found 信号才会确认缺房', () => {
        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
        })).toBe('transport_not_found');

        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: null,
        })).toBeNull();
    });

    it('网络态、REST 404 或自动加入阶段不会把房间误判成不存在', () => {
        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'sync_timeout',
        })).toBeNull();

        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: null,
        })).toBeNull();

        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: true,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
        })).toBeNull();

        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: false,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: true,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
        })).toBeNull();

        expect(resolveMissingMatchConfirmationSignal({
            isTutorialRoute: true,
            matchId: 'match-1',
            shouldAutoJoin: false,
            isAutoJoining: false,
            autoJoinGraceActive: false,
            onlineTransportError: 'match_not_found',
        })).toBeNull();
    });
});

describe('resolveMatchRoomRouteIdentity', () => {
    it('有 stored seat 且 URL 缺失时，必须继续使用 seat 身份而不是误退 spectator/null playerID', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            debugPlayerID: null,
            urlPlayerID: null,
            storedPlayerID: '1',
            shouldAutoJoin: false,
            spectateParam: null,
        });

        expect(result.hasStoredSeat).toBe(true);
        expect(result.isSpectatorRoute).toBe(false);
        expect(result.effectivePlayerID).toBe('1');
        expect(result.statusPlayerID).toBe('1');
        expect(result.transportPlayerID).toBe('1');
    });

    it('即使显式带 spectate=1，只要本地仍有 stored seat，也不能把真实 seat 页压成 spectator', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            debugPlayerID: null,
            urlPlayerID: null,
            storedPlayerID: '0',
            shouldAutoJoin: false,
            spectateParam: '1',
        });

        expect(result.hasStoredSeat).toBe(true);
        expect(result.isSpectatorRoute).toBe(false);
        expect(result.effectivePlayerID).toBe('0');
        expect(result.statusPlayerID).toBe('0');
        expect(result.transportPlayerID).toBe('0');
    });

    it('只有无 URL、无 stored seat、且允许 spectate 路由时，才应退回 spectator/null playerID', () => {
        const result = resolveMatchRoomRouteIdentity({
            isTutorialRoute: false,
            debugPlayerID: null,
            urlPlayerID: null,
            storedPlayerID: null,
            shouldAutoJoin: false,
            spectateParam: null,
        });

        expect(result.hasStoredSeat).toBe(false);
        expect(result.isSpectatorRoute).toBe(true);
        expect(result.effectivePlayerID).toBeUndefined();
        expect(result.statusPlayerID).toBeNull();
        expect(result.transportPlayerID).toBeNull();
    });
});

describe('match-credentials-changed lifecycle', () => {
    afterEach(() => {
        localStorage.clear();
    });

    it('persistMatchCredentials 会立刻写入 localStorage，并通知同页监听器刷新 stored seat', () => {
        const handler = vi.fn();
        window.addEventListener('match-credentials-changed', handler);

        try {
            persistMatchCredentials('match-1', {
                matchID: 'match-1',
                playerID: '0',
                credentials: 'cred-0',
                gameName: 'smashup',
            });

            expect(readStoredMatchCredentials('match-1')).toEqual(expect.objectContaining({
                matchID: 'match-1',
                playerID: '0',
                credentials: 'cred-0',
                gameName: 'smashup',
            }));
            expect(handler).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener('match-credentials-changed', handler);
        }
    });

    it('clearMatchCredentials 会立刻清空 localStorage，并通知同页监听器避免页面继续沿用旧 seat', () => {
        persistMatchCredentials('match-1', {
            matchID: 'match-1',
            playerID: '0',
            credentials: 'cred-0',
            gameName: 'smashup',
        });
        const handler = vi.fn();
        window.addEventListener('match-credentials-changed', handler);

        try {
            clearMatchCredentials('match-1');

            expect(readStoredMatchCredentials('match-1')).toBeNull();
            expect(handler).toHaveBeenCalledTimes(1);
        } finally {
            window.removeEventListener('match-credentials-changed', handler);
        }
    });
});

describe('TutorialMatchRoomWithAudio', () => {
    it('切换教程路由时会强制重建 MatchRoom，避免残留旧教程状态', async () => {
        vi.resetModules();
        const lifecycle: string[] = [];

        vi.doMock('../MatchRoom', async () => {
            const React = await vi.importActual<typeof import('react')>('react');
            const router = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

            return {
                MatchRoom: () => {
                    const location = router.useLocation();

                    React.useEffect(() => {
                        lifecycle.push(`mount:${location.pathname}`);
                        return () => {
                            lifecycle.push(`unmount:${location.pathname}`);
                        };
                    }, [location.pathname]);

                    return React.createElement('div', { 'data-testid': 'tutorial-match-room-probe' }, location.pathname);
                },
            };
        });

        try {
            const { default: TutorialMatchRoomWithAudio } = await import('../TutorialMatchRoomWithAudio');

            const Harness = ({ nextPath }: { nextPath?: string }) => {
                const navigate = useNavigate();

                useEffect(() => {
                    if (nextPath) {
                        navigate(nextPath);
                    }
                }, [navigate, nextPath]);

                return createElement(
                    Routes,
                    null,
                    createElement(Route, {
                        path: '/play/:gameId/tutorial',
                        element: createElement(TutorialMatchRoomWithAudio),
                    }),
                    createElement(Route, {
                        path: '/play/:gameId/tutorial/:tutorialId',
                        element: createElement(TutorialMatchRoomWithAudio),
                    }),
                );
            };

            const { rerender } = render(
                createElement(
                    MemoryRouter,
                    { initialEntries: ['/play/smashup/tutorial'] },
                    createElement(Harness),
                ),
            );

            expect(screen.getByTestId('tutorial-match-room-probe').textContent).toBe('/play/smashup/tutorial');
            expect(lifecycle).toEqual(['mount:/play/smashup/tutorial']);

            rerender(
                createElement(
                    MemoryRouter,
                    { initialEntries: ['/play/smashup/tutorial'] },
                    createElement(Harness, { nextPath: '/play/smashup/tutorial/cowboys-duel' }),
                ),
            );

            await waitFor(() => {
                expect(screen.getByTestId('tutorial-match-room-probe').textContent).toBe('/play/smashup/tutorial/cowboys-duel');
            });

            expect(lifecycle).toEqual([
                'mount:/play/smashup/tutorial',
                'unmount:/play/smashup/tutorial',
                'mount:/play/smashup/tutorial/cowboys-duel',
            ]);
        } finally {
            vi.doUnmock('../MatchRoom');
            vi.resetModules();
        }
    });
});

describe('resolveMatchSeatSwapContext', () => {
    const requestSeatSwapConfig: MatchSeatSwapConfig = {
        mode: 'request',
        requestCommandType: 'REQUEST_SEAT_SWAP',
        respondCommandType: 'RESPOND_SEAT_SWAP',
        cancelCommandType: 'CANCEL_SEAT_SWAP',
    };
    const summonerWarsSeatSwapConfig: MatchSeatSwapConfig = {
        mode: 'instant',
        requestCommandType: 'sw:swap_seat',
        respondCommandType: null,
        cancelCommandType: null,
    };
    const smashUpSeatSwapConfig: MatchSeatSwapConfig = {
        mode: 'instant',
        requestCommandType: 'su:swap_seat',
        respondCommandType: null,
        cancelCommandType: null,
    };

    it('应优先使用 seatingOrder，并在 setup 阶段暴露请求型换座上下文', () => {
        const context = resolveMatchSeatSwapContext({
            seatSwapConfig: requestSeatSwapConfig,
            myPlayerId: '1',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
                '2': { type: 'human' },
            },
            state: {
                sys: { phase: 'setup' },
                core: {
                    seatingOrder: ['2', '1', '0'],
                    turnOrder: ['0', '1', '2'],
                    players: { '0': {}, '1': {}, '2': {} },
                    seatSwapRequest: { requesterId: '1', targetPlayerId: '2' },
                },
            } as MatchState<unknown>,
        });

        expect(context).toEqual({
            seatSwapMode: 'request',
            seatingOrder: ['2', '1', '0'],
            seatControllerTypeByPlayerId: {
                '0': 'human',
                '1': 'local-ai',
                '2': 'human',
            },
            pendingSeatSwapRequest: {
                requesterId: '1',
                targetPlayerId: '2',
            },
            requestSeatSwapCommandType: 'REQUEST_SEAT_SWAP',
            respondSeatSwapCommandType: 'RESPOND_SEAT_SWAP',
            cancelSeatSwapCommandType: 'CANCEL_SEAT_SWAP',
        });
    });

    it('当没有显式座位顺序时，应回退到 startingPlayerId 旋转后的玩家顺序', () => {
        const context = resolveMatchSeatSwapContext({
            seatSwapConfig: summonerWarsSeatSwapConfig,
            myPlayerId: '0',
            state: {
                sys: { phase: 'factionSelect' },
                core: {
                    hostStarted: false,
                    startingPlayerId: '1',
                    selectedFactions: { '0': 'phoenixelves', '1': 'guilddwarves' },
                    players: { '0': {}, '1': {}, '2': {} },
                },
            } as MatchState<unknown>,
        });

        expect(context?.seatSwapMode).toBe('instant');
        expect(context?.seatingOrder).toEqual(['1', '0', '2']);
        expect(context?.pendingSeatSwapRequest).toBeNull();
        expect(context?.requestSeatSwapCommandType).toBe('sw:swap_seat');
        expect(context?.respondSeatSwapCommandType).toBeNull();
        expect(context?.cancelSeatSwapCommandType).toBeNull();
    });

    it('应为大杀四方解析即时换座命令类型', () => {
        const context = resolveMatchSeatSwapContext({
            seatSwapConfig: smashUpSeatSwapConfig,
            myPlayerId: '0',
            state: {
                sys: { phase: 'factionSelect' },
                core: {
                    hostStarted: false,
                    selectedFactions: { '0': 'wizards', '1': 'dinosaurs' },
                    players: { '0': {}, '1': {} },
                },
            } as MatchState<unknown>,
        });

        expect(context?.requestSeatSwapCommandType).toBe('su:swap_seat');
        expect(context?.respondSeatSwapCommandType).toBeNull();
        expect(context?.cancelSeatSwapCommandType).toBeNull();
    });

    it('大杀四方在线选派系阶段缺少 hostStarted 时，仍应解析共享换座上下文', () => {
        const context = resolveMatchSeatSwapContext({
            seatSwapConfig: smashUpSeatSwapConfig,
            myPlayerId: '0',
            state: {
                sys: { phase: 'factionSelect' },
                core: {
                    turnOrder: ['0', '1', '2', '3'],
                    currentPlayerIndex: 0,
                    factionSelection: {
                        playerSelections: {
                            '0': [],
                            '1': [],
                            '2': [],
                            '3': [],
                        },
                    },
                    players: { '0': {}, '1': {}, '2': {}, '3': {} },
                },
            } as MatchState<unknown>,
        });

        expect(context).toMatchObject({
            seatSwapMode: 'instant',
            seatingOrder: ['0', '1', '2', '3'],
            pendingSeatSwapRequest: null,
            requestSeatSwapCommandType: 'su:swap_seat',
        });
    });

    it('不在可换座阶段时应返回 null', () => {
        const context = resolveMatchSeatSwapContext({
            seatSwapConfig: requestSeatSwapConfig,
            myPlayerId: '0',
            state: {
                sys: { phase: 'main1' },
                core: {
                    seatingOrder: ['0', '1'],
                    players: { '0': {}, '1': {} },
                },
            } as MatchState<unknown>,
        });

        expect(context).toBeNull();
    });
});

describe('matchPlayers helpers', () => {
    it('应按 playerId 查找 transport 玩家并读取连接状态', () => {
        const players = [
            { id: 0, name: 'Alice', isConnected: true },
            { id: 2, name: 'Bot', isConnected: false },
        ];

        expect(findMatchPlayerInfo(players, '2')).toEqual({ id: 2, name: 'Bot', isConnected: false });
        expect(resolveMatchPlayerConnected(players, '2', true)).toBe(false);
        expect(resolveMatchPlayerConnected(players, '1', true)).toBe(true);
        expect(resolveMatchPlayerConnected(players, '1', false)).toBe(false);
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

describe('resolveOnlineAiAutoRecoveryCompletionNotice', () => {
    const seatControllers: Record<string, AiSeatController> = {
        '0': { type: 'human' },
        '1': { type: 'local-ai', policyId: 'baseline' },
    };

    it('响应窗口恢复完成后如果已经切回人类回合，不再弹自动提示', () => {
        const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
            candidateReason: 'response-window',
            authoritativeState: {
                core: {
                    activePlayerId: '0',
                },
                sys: {
                    phase: 'main1',
                },
            } as MatchState<unknown>,
            seatControllers,
        });

        expect(notice).toBeNull();
    });

    it('交互超时仍停留在 AI 流程时，显示自动跳过提示', () => {
        const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
            candidateReason: 'visible-interaction',
            authoritativeState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    phase: 'main2',
                },
            } as MatchState<unknown>,
            seatControllers,
        });

        expect(notice).toEqual({
            tone: 'info',
            title: 'AI 响应超时',
            message: 'AI 已自动跳过。',
        });
    });

    it('response-loop hard-close 收口后若仍停留在 AI 流程，也应显示自动跳过提示', () => {
        const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
            candidateReason: 'response-loop',
            authoritativeState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    phase: 'afterRollConfirmed',
                },
            } as MatchState<unknown>,
            seatControllers,
        });

        expect(notice).toEqual({
            tone: 'info',
            title: 'AI 响应超时',
            message: 'AI 已自动跳过。',
        });
    });

    it('真正的 active-turn 强制推进仍保留强制结束回合提示', () => {
        const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
            candidateReason: 'active-turn',
            authoritativeState: null,
            seatControllers,
        });

        expect(notice).toEqual({
            tone: 'warning',
            title: 'AI 强制结束回合',
            message: 'AI 已强制结束回合。',
        });
    });

    it('active-turn 恢复完成后如果已经切回人类回合，不再弹强制结束回合提示', () => {
        const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
            candidateReason: 'active-turn',
            authoritativeState: {
                core: {
                    activePlayerId: '0',
                },
                sys: {
                    phase: 'main1',
                },
            } as MatchState<unknown>,
            seatControllers,
        });

        expect(notice).toBeNull();
    });

    it('custom current-player seam 变化时，恢复完成提示应按 seam-aware current player 抑制人类回合 toast', () => {
        const notice = resolveOnlineAiAutoRecoveryCompletionNotice({
            candidateReason: 'response-window',
            authoritativeState: {
                core: {
                    activePlayerId: '1',
                    pendingAttack: {
                        defenderId: '0',
                    },
                },
                sys: {
                    phase: 'defensiveRoll',
                },
            } as MatchState<unknown>,
            seatControllers,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        });

        expect(notice).toBeNull();
    });
});

describe('leaveMatch 错误分类', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('403 凭证异常会返回 forbidden，供 UI 显示明确提示', async () => {
        vi.spyOn(matchApi, 'leaveMatch').mockRejectedValue({ status: 403, message: 'Invalid credentials', code: 'HTTP_403' });

        await expect(leaveMatch('tictactoe', 'match-1', '1', 'stale-creds')).resolves.toMatchObject({
            success: false,
            error: 'forbidden',
        });
    });

    it('500 服务异常会返回 server_error，而不是吞成 unknown', async () => {
        vi.spyOn(matchApi, 'leaveMatch').mockRejectedValue({ status: 500, message: 'server exploded', code: 'HTTP_500' });

        await expect(leaveMatch('tictactoe', 'match-1', '1', 'creds')).resolves.toMatchObject({
            success: false,
            error: 'server_error',
        });
    });
});

describe('resolveExitMatchErrorMessageKey', () => {
    it('非房主离房 forbidden 应映射到 leaveForbidden', () => {
        expect(resolveExitMatchErrorMessageKey('forbidden', false)).toBe('error.leaveForbidden');
    });

    it('非房主离房 server_error 应映射到 leaveNetwork', () => {
        expect(resolveExitMatchErrorMessageKey('server_error', false)).toBe('error.leaveNetwork');
    });

    it('房主销毁 network 应映射到 destroyNetwork', () => {
        expect(resolveExitMatchErrorMessageKey('network', true)).toBe('error.destroyNetwork');
    });
});

describe('onlineAiSeats', () => {
    it('补领 guest 房间的 AI 凭据时，即使当前存在 token 也必须使用房间 ownerKey 的 guestId', () => {
        const options = resolveOnlineAiSeatClaimOptions({
            matchInfo: {
                matchID: 'match-guest-owner',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }],
                setupData: {
                    ownerKey: 'guest:2141',
                    ownerType: 'guest',
                    guestId: '2141',
                },
            },
            token: 'stale-user-token',
            guestId: '9999',
            playerName: 'AI 2 号位',
        });

        expect(options).toEqual({
            guestId: '2141',
            playerName: 'AI 2 号位',
        });
    });

    it('补领 user 房间的 AI 凭据时才使用 token', () => {
        const options = resolveOnlineAiSeatClaimOptions({
            matchInfo: {
                matchID: 'match-user-owner',
                gameName: 'smashup',
                players: [{ id: 0, name: '房主' }],
                setupData: {
                    ownerKey: 'user:u-1',
                    ownerType: 'user',
                },
            },
            token: 'user-token',
            guestId: '2141',
            playerName: 'AI 2 号位',
        });

        expect(options).toEqual({
            token: 'user-token',
            playerName: 'AI 2 号位',
        });
    });

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

    it('应识别仍缺少凭据的 AI 座位，供重进后的自动补领重试使用', () => {
        expect(resolveMissingOnlineAiSeatCredentialIds({
            '0': { type: 'human' },
            '1': { type: 'local-ai', difficulty: 'hard' },
            '2': { type: 'local-ai', difficulty: 'normal' },
        }, {
            '1': 'existing-ai-1',
        })).toEqual(['2']);

        expect(resolveMissingOnlineAiSeatCredentialIds({
            '0': { type: 'human' },
            '1': { type: 'local-ai', difficulty: 'hard' },
        }, {
            '1': 'existing-ai-1',
        })).toEqual([]);
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
            engineConfig: {
                gameId: 'smashup',
                onlineAiRecovery: {
                    publicPregameLegalActionPhases: ['factionSelect'],
                },
            },
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
                    hostStarted: false,
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
            engineConfig: {
                gameId: 'smashup',
                onlineAiRecovery: {
                    publicPregameLegalActionPhases: ['factionSelect'],
                },
            },
        });

        expect(candidate).toMatchObject({
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
        });
        expect(candidate?.resolution.action.commands).toEqual([]);
    });

    it('手动强制结束在 visible-interaction 场景应优先返回 force-end-turn，不额外触发 AI dispatch', async () => {
        const resolveDispatchImpl = vi.fn();
        const result = await resolveManualOnlineAiRecovery({
            engineConfig: { gameId: 'smashup' },
            matchId: 'match-manual-force-end-visible',
            sharedState: {
                core: {
                    activePlayerId: '1',
                },
                sys: {
                    interaction: {
                        current: {
                            id: 'stuck-visible',
                            playerId: '1',
                            kind: 'simple-choice',
                            data: {
                                options: [],
                            },
                        },
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
            resolveDispatchImpl,
        });

        expect(result.kind).toBe('force-end-turn');
        expect(resolveDispatchImpl).not.toHaveBeenCalled();
    });

    it('手动强制结束在 legalActionOnly 场景应直接强制推进，不再退回 AI 合法动作', async () => {
        const resolveDispatchImpl = vi.fn().mockResolvedValue({
            kind: 'action',
            resolution: {
                playerId: '1',
                attemptKey: 'manual-legal-action',
                source: 'local-ai',
                action: {
                    actionId: 'select-faction',
                    kind: 'select-faction',
                    label: '选择派系',
                    commands: [{ type: 'SELECT_FACTION', payload: { factionId: 'pirates' } }],
                },
            },
        });

        const result = await resolveManualOnlineAiRecovery({
            engineConfig: { gameId: 'smashup' },
            matchId: 'match-manual-force-end-legal-only',
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
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': buildOnlineAiSeatState({ phase: 'factionSelect', currentPlayerId: '1' }),
            },
            resolveDispatchImpl,
        });

        expect(result).toMatchObject({
            kind: 'force-end-turn',
            candidate: {
                playerId: '1',
                reason: 'active-turn',
                resolution: {
                    action: {
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                },
            },
        });
        expect(resolveDispatchImpl).not.toHaveBeenCalled();
    });

    it('DiceThrone 手动强制结束在无交互但攻击阶段卡住时应直接推进阶段', async () => {
        const resolveDispatchImpl = vi.fn();
        const result = await resolveManualOnlineAiRecovery({
            engineConfig: {
                gameId: 'dicethrone',
                onlineAiRecovery: {
                    activeTurnLegalActionOnlyPhases: ['offensiveRoll', 'targetingRoll', 'defensiveRoll'],
                },
            },
            matchId: 'match-manual-dicethrone-attack-stuck',
            sharedState: {
                core: {
                    activePlayerId: '1',
                    currentPlayerId: '1',
                    pendingAttack: {
                        attackerId: '1',
                        sourceAbilityId: 'steadfast-2-3',
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
                    turnNumber: 3,
                    phase: 'offensiveRoll',
                },
            } as MatchState<unknown>,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            resolveDispatchImpl,
        });

        expect(result).toMatchObject({
            kind: 'force-end-turn',
            candidate: {
                playerId: '1',
                reason: 'active-turn',
                resolution: {
                    action: {
                        commands: [{ type: 'ADVANCE_PHASE', payload: {} }],
                    },
                },
            },
        });
        expect(resolveDispatchImpl).not.toHaveBeenCalled();
    });

    it('手动恢复遇到 compare-roll contestant 时，应把 blocked seat snapshot 交给 dispatch，而不是提前 force-end-turn', async () => {
        const resolveDispatchImpl = vi.fn().mockImplementation(async (dispatchArgs) => {
            const resolved = dispatchArgs.visibleStateResolver?.('1');
            expect(resolved).toMatchObject({
                kind: 'online-ai-decision-view',
                visibility: 'shared',
                canDecide: true,
                blockedReason: null,
            });
            if (!resolved || typeof resolved !== 'object' || !('visibleState' in resolved)) {
                throw new Error('expected resolved online ai decision view');
            }
            const visibleState = resolved.visibleState as MatchState<unknown>;
            expect(visibleState.sys?.interaction?.current).toMatchObject({
                id: 'compare-roll-1',
                kind: 'compare-roll-choice',
                playerId: '0',
            });
            expect(visibleState.sys?.interaction?.isBlocked).toBe(true);
            return {
                kind: 'idle',
                idleReason: 'no-action',
            };
        });

        const result = await resolveManualOnlineAiRecovery({
            engineConfig: { gameId: 'dicethrone' },
            matchId: 'match-manual-compare-roll-contestant',
            sharedState: {
                core: {
                    currentPlayerId: '1',
                },
                sys: {
                    phase: 'defensiveRoll',
                    turnNumber: 9,
                    eventStream: { nextId: 42, entries: [] },
                    interaction: {
                        current: {
                            id: 'compare-roll-1',
                            kind: 'compare-roll-choice',
                            playerId: '0',
                            data: {
                                contestants: [
                                    { playerId: '0', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker' },
                                    { playerId: '1', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender' },
                                ],
                                options: [{ id: 'confirm', label: '确认' }],
                            },
                        },
                        queue: [],
                        isBlocked: false,
                    },
                    responseWindow: {
                        current: undefined,
                    },
                },
            } as MatchState<unknown>,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {
                '1': {
                    core: {
                        currentPlayerId: '1',
                    },
                    sys: {
                        phase: 'defensiveRoll',
                        turnNumber: 9,
                        eventStream: { nextId: 42, entries: [] },
                        interaction: {
                            current: {
                                id: 'compare-roll-1',
                                kind: 'compare-roll-choice',
                                playerId: '0',
                                data: {
                                    contestants: [
                                        { playerId: '0', roll: 6, labelKey: 'compareRoll.gunslingerDuel.attacker' },
                                        { playerId: '1', roll: 2, labelKey: 'compareRoll.gunslingerDuel.defender' },
                                    ],
                                    options: [{ id: 'confirm', label: '确认' }],
                                },
                            },
                            queue: [],
                            isBlocked: true,
                        },
                        responseWindow: {
                            current: undefined,
                        },
                    },
                } as MatchState<unknown>,
            },
            resolveDispatchImpl,
        });

        expect(resolveDispatchImpl).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ kind: 'unavailable' });
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

    it('AI 座位缺少 name 时应回退为 AI 座位名，而不是 P4 之类的通用占位', () => {
        const result = resolveOnlineHudPresence({
            fallbackPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 3, isConnected: false },
            ],
            transportPlayers: [
                { id: 0, name: '房主', isConnected: true },
                { id: 3, isConnected: true },
            ],
            transportReady: true,
            myPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '3': { type: 'local-ai', difficulty: 'normal' },
            },
        });

        expect(result.players.find((player) => player.id === 3)?.name).toBe('AI 4 号位');
        expect(result.opponentName).toBe('AI 4 号位');
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

    it('DiceThrone 右侧奖励骰普通确认应允许在线 AI 基于共享状态收口', async () => {
        registerGameAiRuntime(diceThroneAiRuntime);

        const sharedState = {
            core: {
                activePlayerId: '1',
                players: {
                    '0': {
                        characterId: 'samurai',
                        resources: { hp: 50, cp: 2 },
                        hand: [],
                        statusEffects: {},
                        tokens: {},
                        abilities: [],
                    },
                    '1': {
                        characterId: 'monk',
                        resources: { hp: 50, cp: 2 },
                        hand: [],
                        statusEffects: {},
                        tokens: {},
                        abilities: [],
                    },
                },
                dice: [],
                rollCount: 1,
                rollLimit: 3,
                rollConfirmed: true,
                pendingBonusDiceSettlement: {
                    id: 'right-tray-bonus-confirm',
                    sourceAbilityId: 'right-tray-bonus',
                    attackerId: '1',
                    targetId: '0',
                    dice: [{
                        index: 0,
                        value: 4,
                        face: 'chi',
                        effectParams: { value: 4 },
                    }],
                    rerollCostTokenId: 'taiji',
                    rerollCostAmount: 1,
                    rerollCount: 0,
                    maxRerollCount: 0,
                    readyToSettle: true,
                    displayOnly: true,
                    showTotal: false,
                    resolutionMode: 'none',
                    allowDiceModification: true,
                    continuation: { kind: 'complete' },
                },
            },
            sys: {
                phase: 'main2',
                turnNumber: 3,
                eventStream: { nextId: 12 },
                interaction: {
                    current: {
                        id: 'dt-bonus-dice-right-tray-bonus-confirm',
                        kind: 'dt:bonus-dice',
                        playerId: '1',
                        data: null,
                    },
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: null,
                },
            },
        } as MatchState<unknown>;

        const staleSeatState = {
            ...sharedState,
            sys: {
                ...sharedState.sys,
                phase: 'setup',
                eventStream: { nextId: 8 },
                interaction: {
                    current: null,
                    queue: [],
                    isBlocked: false,
                },
            },
        } as MatchState<unknown>;

        const resolution = await resolveNextAiAction({
            engineConfig: {
                gameId: 'dicethrone',
                domain: {} as never,
                systems: [],
            },
            state: sharedState,
            matchId: 'match-dicethrone-online-ai-bonus-dice-shared-confirm',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                runtime: getGameAiRuntime('dicethrone') ?? null,
                sharedState,
                privateOverlay: staleSeatState,
                playerId,
            }),
        });

        expect(resolution?.playerId).toBe('1');
        expect(resolution?.action.kind).toBe('confirm-roll');
        expect(resolution?.action.commands).toEqual([
            { type: 'CONFIRM_ROLL', payload: {} },
        ]);
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
    const buildResolution = (args?: {
        attemptKey?: string;
        commands?: Array<{ type: string; payload: unknown }>;
    }) => ({
        playerId: '1',
        attemptKey: args?.attemptKey ?? 'attempt-default',
        source: 'local-ai' as const,
        action: {
            actionId: 'respond-choice',
            kind: 'interaction-choice' as const,
            label: '响应',
            commands: args?.commands ?? [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } }],
        },
    });

    it('effective seat state 应优先读取临时 override，供 confirmed 后下一拍继续决策', () => {
        const staleSeatState = buildOnlineAiSeatState({
            nextId: 3,
            interactionId: 'stale-hidden',
            interactionSourceId: 'wizard_sacrifice',
        });
        const confirmedSeatState = buildOnlineAiSeatState({
            nextId: 4,
        });

        expect(resolveOnlineAiEffectiveSeatState({
            playerId: '1',
            seatStateOverrides: { '1': confirmedSeatState },
            seatLatestStates: { '1': staleSeatState },
        })).toBe(confirmedSeatState);
    });

    it('构建 force-skip/force-end-turn seatStates 时应统一走 effective seat state', () => {
        const staleSeatState = buildOnlineAiSeatState({
            nextId: 5,
            interactionId: 'stale-hidden',
            interactionSourceId: 'wizard_sacrifice',
        });
        const confirmedSeatState = buildOnlineAiSeatState({
            nextId: 6,
        });

        expect(resolveOnlineAiEffectiveSeatStates({
            playerIds: ['1', '2'],
            seatStateOverrides: { '1': confirmedSeatState },
            seatLatestStates: { '1': staleSeatState, '2': null },
        })).toEqual({
            '1': confirmedSeatState,
            '2': null,
        });
    });

    it('confirmed 标记已追平 latestState 时无需 staging override；缺失或不一致时必须 staging', () => {
        const latestState = buildOnlineAiSeatState({ nextId: 8 });
        const sameMarkerConfirmedState = buildOnlineAiSeatState({ nextId: 8 });
        const advancedConfirmedState = buildOnlineAiSeatState({ nextId: 9 });

        expect(shouldStageOnlineAiSeatOverrideFromConfirmedState({
            authoritativeState: sameMarkerConfirmedState,
            latestSeatState: latestState,
        })).toBe(false);

        expect(shouldStageOnlineAiSeatOverrideFromConfirmedState({
            authoritativeState: advancedConfirmedState,
            latestSeatState: latestState,
        })).toBe(true);

        expect(shouldStageOnlineAiSeatOverrideFromConfirmedState({
            authoritativeState: advancedConfirmedState,
            latestSeatState: null,
        })).toBe(true);
    });

    it('custom current-player seam 变化时，confirmed staging 应按 seam-aware marker 判定', () => {
        const latestState = buildOnlineAiSeatState({
            nextId: 18,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const confirmedState = buildOnlineAiSeatState({
            nextId: 18,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        (latestState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };
        (confirmedState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };

        expect(shouldStageOnlineAiSeatOverrideFromConfirmedState({
            authoritativeState: confirmedState,
            latestSeatState: latestState,
        })).toBe(false);

        expect(shouldStageOnlineAiSeatOverrideFromConfirmedState({
            authoritativeState: confirmedState,
            latestSeatState: latestState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).toBe(true);
    });

    it('staged override 只应作为 confirmed 到 state update 之间的一拍桥接，latestState 追平后应退回最新 seat state', () => {
        const staleSeatState = buildOnlineAiSeatState({
            nextId: 10,
            interactionId: 'stale-hidden',
            interactionSourceId: 'wizard_sacrifice',
        });
        const confirmedSeatState = buildOnlineAiSeatState({ nextId: 11 });
        const latestCaughtUpSeatState = buildOnlineAiSeatState({ nextId: 11 });

        expect(resolveOnlineAiEffectiveSeatState({
            playerId: '1',
            seatStateOverrides: { '1': confirmedSeatState },
            seatLatestStates: { '1': staleSeatState },
        })).toBe(confirmedSeatState);

        expect(resolveOnlineAiEffectiveSeatState({
            playerId: '1',
            seatStateOverrides: {},
            seatLatestStates: { '1': latestCaughtUpSeatState },
        })).toBe(latestCaughtUpSeatState);
    });

    it('latest seat state 已追平 confirmed override 时，不应继续沿用 override 阴影状态', () => {
        const confirmedSeatState = buildOnlineAiSeatState({ nextId: 12 });
        const latestCaughtUpSeatState = buildOnlineAiSeatState({ nextId: 12 });

        expect(shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: confirmedSeatState,
            latestSeatState: latestCaughtUpSeatState,
        })).toBe(false);

        expect(resolveOnlineAiEffectiveSeatState({
            playerId: '1',
            seatStateOverrides: { '1': confirmedSeatState },
            seatLatestStates: { '1': latestCaughtUpSeatState },
        })).toBe(latestCaughtUpSeatState);
    });

    it('latest seat state 尚未追平 confirmed override 时，必须继续保留 override 作为桥接态', () => {
        const confirmedSeatState = buildOnlineAiSeatState({ nextId: 14 });
        const staleSeatState = buildOnlineAiSeatState({
            nextId: 13,
            interactionId: 'stale-hidden',
            interactionSourceId: 'wizard_sacrifice',
        });

        expect(shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: confirmedSeatState,
            latestSeatState: staleSeatState,
        })).toBe(true);

        expect(resolveOnlineAiEffectiveSeatState({
            playerId: '1',
            seatStateOverrides: { '1': confirmedSeatState },
            seatLatestStates: { '1': staleSeatState },
        })).toBe(confirmedSeatState);
    });

    it('custom current-player seam 变化时，latest seat state 不应误判为已追平 override', () => {
        const overrideState = buildOnlineAiSeatState({
            nextId: 22,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const latestSeatState = buildOnlineAiSeatState({
            nextId: 22,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        (overrideState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };
        (latestSeatState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };

        expect(shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: overrideState,
            latestSeatState,
        })).toBe(false);

        expect(shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: overrideState,
            latestSeatState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).toBe(true);
    });

    it('custom current-player seam 变化时，recovery marker 必须使用 seam-aware 语义', () => {
        const previousState = buildOnlineAiSeatState({
            nextId: 30,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const nextState = buildOnlineAiSeatState({
            nextId: 30,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        (previousState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };
        (nextState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };

        expect(buildAiProgressMarker(previousState)).toBe(buildAiProgressMarker(nextState));

        expect(buildOnlineAiSeamAwareProgressMarker({
            state: previousState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).not.toBe(buildOnlineAiSeamAwareProgressMarker({
            state: nextState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        }));
    });

    it('custom current-player seam 变化时，online-ai attempt marker 必须按 seam-aware snapshot 比较', () => {
        const previousSharedState = buildOnlineAiSeatState({
            nextId: 31,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const nextSharedState = buildOnlineAiSeatState({
            nextId: 31,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const previousSeatState = buildOnlineAiSeatState({
            nextId: 31,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const nextSeatState = buildOnlineAiSeatState({
            nextId: 31,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        (previousSharedState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };
        (nextSharedState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };
        (previousSeatState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };
        (nextSeatState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };

        expect(buildAiProgressMarker(previousSharedState)).toBe(buildAiProgressMarker(nextSharedState));
        expect(buildAiProgressMarker(previousSeatState)).toBe(buildAiProgressMarker(nextSeatState));

        expect(buildOnlineAiSeamAwareAttemptMarkers({
            sharedState: previousSharedState,
            seatState: previousSeatState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).toEqual({
            sharedMarker: expect.any(String),
            seatMarker: expect.any(String),
        });
        expect(buildOnlineAiSeamAwareAttemptMarkers({
            sharedState: previousSharedState,
            seatState: previousSeatState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).not.toEqual(buildOnlineAiSeamAwareAttemptMarkers({
            sharedState: nextSharedState,
            seatState: nextSeatState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        }));
    });

    it('custom current-player seam 变化时，idle / submit-blocked recovery key 必须按 seam-aware marker 去重', () => {
        const previousState = buildOnlineAiSeatState({
            nextId: 32,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        const nextState = buildOnlineAiSeatState({
            nextId: 32,
            phase: 'defensiveRoll',
            currentPlayerId: '1',
        });
        (previousState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };
        (nextState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };

        expect(buildOnlineAiIdleSeatRecoveryKey({
            playerId: '1',
            authoritativeState: previousState,
        })).toBe(buildOnlineAiIdleSeatRecoveryKey({
            playerId: '1',
            authoritativeState: nextState,
        }));

        expect(buildOnlineAiIdleSeatRecoveryKey({
            playerId: '1',
            authoritativeState: previousState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).not.toBe(buildOnlineAiIdleSeatRecoveryKey({
            playerId: '1',
            authoritativeState: nextState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        }));

        expect(buildOnlineAiSubmitBlockedRecoveryKey({
            playerId: '1',
            resolution: {
                attemptKey: 'attempt-1',
                action: { kind: 'advance-phase' },
            },
            authoritativeState: previousState,
        })).toBe(buildOnlineAiSubmitBlockedRecoveryKey({
            playerId: '1',
            resolution: {
                attemptKey: 'attempt-1',
                action: { kind: 'advance-phase' },
            },
            authoritativeState: nextState,
        }));

        expect(buildOnlineAiSubmitBlockedRecoveryKey({
            playerId: '1',
            resolution: {
                attemptKey: 'attempt-1',
                action: { kind: 'advance-phase' },
            },
            authoritativeState: previousState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        })).not.toBe(buildOnlineAiSubmitBlockedRecoveryKey({
            playerId: '1',
            resolution: {
                attemptKey: 'attempt-1',
                action: { kind: 'advance-phase' },
            },
            authoritativeState: nextState,
            engineConfig: createOnlineAiMarkerEngineConfig(),
        }));
    });

    it('custom current-player seam 变化时，manual setup bridge 应按 seam-aware current player 接管 AI 座位', () => {
        const manualSetupEngineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> = {
            gameId: 'custom-manual-setup-game',
            onlineAiRecovery: {
                resolveCurrentPlayerId: ({ phase, fallbackPlayerId }) => (
                    phase === 'factionSelect' ? '1' : fallbackPlayerId
                ),
            },
        };
        const sharedState = buildOnlineAiSeatState({
            nextId: 34,
            phase: 'factionSelect',
            currentPlayerId: '0',
        });

        expect(resolveOnlineManualSetupTakeoverPlayerId({
            sharedState,
            seatControllers: {
                '0': { type: 'human', manualFactionSelection: true },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBeNull();

        expect(resolveOnlineManualSetupTakeoverPlayerId({
            sharedState,
            seatControllers: {
                '0': { type: 'human', manualFactionSelection: true },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
            engineConfig: manualSetupEngineConfig,
        })).toBe('1');
    });

    it('seat latest state 在重连后即使 nextId 更低，只要已明确关闭旧 owner-only prompt，也不应继续沿用 override 阴影状态', () => {
        const confirmedSeatState = buildOnlineAiSeatState({
            nextId: 14,
            interactionId: 'stale-hidden',
            interactionSourceId: 'wizard_sacrifice',
        });
        const postReconnectClosedSeatState = buildOnlineAiSeatState({
            nextId: 1,
            phase: 'playCards',
            currentPlayerId: '1',
        });

        expect(shouldRetainOnlineAiSeatOverrideAfterLatestState({
            seatStateOverride: confirmedSeatState,
            latestSeatState: postReconnectClosedSeatState,
        })).toBe(false);

        expect(resolveOnlineAiEffectiveSeatState({
            playerId: '1',
            seatStateOverrides: { '1': confirmedSeatState },
            seatLatestStates: { '1': postReconnectClosedSeatState },
        })).toBe(postReconnectClosedSeatState);
    });

    it('shared state 已记录 AI 选中的派系时，应立即释放 select-faction attempt', () => {
        const sharedState = {
            core: {
                factionSelection: {
                    takenFactions: ['robots'],
                    playerSelections: {
                        '0': [],
                        '1': ['robots'],
                    },
                    completedPlayers: [],
                },
            },
            sys: {
                phase: 'factionSelect',
            },
        } as MatchState<unknown>;

        expect(shouldReleaseFactionSelectAttemptFromSharedState({
            sharedState,
            playerId: '1',
            factionId: 'robots',
        })).toBe(true);
    });

    it('shared state 未吸收但 seat state 已写回该派系时，应允许释放 attempt 继续推进', () => {
        const sharedState = {
            core: {
                factionSelection: {
                    takenFactions: ['pirates'],
                    playerSelections: {
                        '0': ['pirates'],
                        '1': [],
                    },
                    completedPlayers: [],
                },
                currentPlayerIndex: 1,
            },
            sys: {
                phase: 'factionSelect',
            },
        } as MatchState<unknown>;
        const seatState = {
            core: {
                factionSelection: {
                    takenFactions: ['pirates', 'robots'],
                    playerSelections: {
                        '0': ['pirates'],
                        '1': ['robots'],
                    },
                    completedPlayers: [],
                },
                currentPlayerIndex: 2,
            },
            sys: {
                phase: 'factionSelect',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupAttemptReleaseSource({
            sharedState,
            seatState,
            playerId: '1',
            actionKind: 'select-faction',
            selectionId: 'robots',
        })).toBe('seat');
    });

    it('shared 与 seat 都已吸收时，应优先标记为 shared release', () => {
        const sharedState = {
            core: {
                factionSelection: {
                    takenFactions: ['pirates', 'robots'],
                    playerSelections: {
                        '0': ['pirates'],
                        '1': ['robots'],
                    },
                    completedPlayers: [],
                },
            },
            sys: {
                phase: 'factionSelect',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupAttemptReleaseSource({
            sharedState,
            seatState: sharedState,
            playerId: '1',
            actionKind: 'select-faction',
            selectionId: 'robots',
        })).toBe('shared');
    });

    it('SummonerWars 在线前置阶段：hostStarted=false 且 AI 还未选阵营时，应解析出要接管的 AI 座位', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                selectedFactions: {
                    '0': 'necromancer',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionTakeoverPlayerId({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBe('1');
        expect(shouldTakeOverManualSetupSelection({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBe(true);
    });

    it('SummonerWars 在线前置阶段：房主自己还没选阵营时，也应先接管 AI 座位', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                selectedFactions: {
                    '0': 'unselected',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionTakeoverPlayerId({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBe('1');
    });

    it('DiceThrone 在线前置阶段：房主自己还没选角色时，也应先接管 AI 座位', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                selectedCharacters: {
                    '0': 'unselected',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionTakeoverPlayerId({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBe('1');
    });

    it('DiceThrone 角色选择已写回 shared state 时，应释放 setup-select-character attempt', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                selectedCharacters: {
                    '0': 'monk',
                    '1': 'samurai',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(shouldReleaseManualSetupAttemptFromSharedState({
            sharedState,
            playerId: '1',
            actionKind: 'setup-select-character',
            selectionId: 'samurai',
        })).toBe(true);
    });

    it('SummonerWars 阵营选择已写回 shared state 时，应释放 setup-select-faction attempt', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                selectedFactions: {
                    '0': 'necromancer',
                    '1': 'paladin',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(shouldReleaseManualSetupAttemptFromSharedState({
            sharedState,
            playerId: '1',
            actionKind: 'setup-select-faction',
            selectionId: 'paladin',
        })).toBe(true);
    });

    it('自定义前置选择状态未提供 override 时，shared fallback 不应误判 takeover 或 release', () => {
        const sharedState = {
            core: {
                hostStarted: false,
                draftSetupSelections: {
                    '0': 'cleric',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionTakeoverPlayerId({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
        })).toBeNull();

        expect(shouldReleaseManualSetupAttemptFromSharedState({
            sharedState: {
                ...sharedState,
                core: {
                    hostStarted: false,
                    draftSetupSelections: {
                        '0': 'cleric',
                        '1': 'ranger',
                    },
                },
            } as MatchState<unknown>,
            playerId: '1',
            actionKind: 'setup-select-character',
            selectionId: 'ranger',
        })).toBe(false);
    });

    it('自定义前置选择状态提供 override 时，应按 adapter takeover 并释放 shared attempt', () => {
        const manualSetupEngineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> = {
            gameId: 'custom-manual-setup-game',
            onlineAiRecovery: {
                resolveManualSetupSelectionTakeoverPlayerId: ({
                    sharedState,
                    currentPlayerId,
                    seatControllers,
                    hasManualDispatch,
                }) => {
                    if (!hasManualDispatch) {
                        return null;
                    }
                    const selectedByPlayer = (sharedState.core as {
                        draftSetupSelections?: Record<string, unknown>;
                    } | undefined)?.draftSetupSelections;
                    if (!selectedByPlayer || typeof selectedByPlayer !== 'object') {
                        return undefined;
                    }
                    if (currentPlayerId && seatControllers[currentPlayerId]?.type === 'human') {
                        const currentSelection = selectedByPlayer[currentPlayerId];
                        if (typeof currentSelection !== 'string' || currentSelection === 'unselected') {
                            return null;
                        }
                    }
                    return Object.entries(seatControllers).find(([playerId, controller]) => (
                        controller?.type !== 'human'
                        && controller?.manualFactionSelection === true
                        && (
                            typeof selectedByPlayer[playerId] !== 'string'
                            || selectedByPlayer[playerId] === 'unselected'
                        )
                    ))?.[0] ?? null;
                },
                shouldReleaseManualSetupAttemptFromSharedState: ({
                    sharedState,
                    playerId,
                    actionKind,
                    selectionId,
                }) => {
                    if (actionKind !== 'setup-select-character') {
                        return undefined;
                    }
                    const selectedByPlayer = (sharedState.core as {
                        draftSetupSelections?: Record<string, unknown>;
                    } | undefined)?.draftSetupSelections;
                    if (!selectedByPlayer || typeof selectedByPlayer !== 'object') {
                        return undefined;
                    }
                    return selectedByPlayer[playerId] === selectionId;
                },
            },
        };
        const sharedState = {
            core: {
                hostStarted: false,
                draftSetupSelections: {
                    '0': 'cleric',
                    '1': 'unselected',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;
        const confirmedSharedState = {
            core: {
                hostStarted: false,
                draftSetupSelections: {
                    '0': 'cleric',
                    '1': 'ranger',
                },
            },
            sys: {
                phase: 'setup',
            },
        } as MatchState<unknown>;

        expect(resolveManualSetupSelectionTakeoverPlayerId({
            sharedState,
            currentPlayerId: '0',
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai', manualFactionSelection: true },
            },
            hasManualDispatch: true,
            engineConfig: manualSetupEngineConfig,
        })).toBe('1');

        expect(shouldReleaseManualSetupAttemptFromSharedState({
            sharedState: confirmedSharedState,
            playerId: '1',
            actionKind: 'setup-select-character',
            selectionId: 'ranger',
            engineConfig: manualSetupEngineConfig,
        })).toBe(true);

        expect(resolveManualSetupAttemptReleaseSource({
            sharedState: confirmedSharedState,
            seatState: sharedState,
            playerId: '1',
            actionKind: 'setup-select-character',
            selectionId: 'ranger',
            engineConfig: manualSetupEngineConfig,
        })).toBe('shared');
    });

    it('自定义前置选择命令未提供 override 时，shared fallback 不应误判 actionKind / selectionId', () => {
        expect(resolveManualSetupSelectionActionKindFromCommand({
            type: 'custom:select_draft',
            payload: { draftId: 'ranger' },
        })).toBeNull();

        expect(resolveManualSetupSelectionId({
            actionKind: 'setup-select-character',
            payload: { draftId: 'ranger' },
        })).toBeNull();
    });

    it('自定义前置选择命令提供 override 时，应按 adapter 解析 actionKind / selectionId', () => {
        const manualSetupEngineConfig: Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'> = {
            gameId: 'custom-manual-setup-command-game',
            onlineAiRecovery: {
                resolveManualSetupSelectionActionKindFromCommand: ({ type, payload }) => (
                    type === 'custom:select_draft'
                    && typeof (payload as { draftId?: unknown } | undefined)?.draftId === 'string'
                        ? 'setup-select-character'
                        : undefined
                ),
                resolveManualSetupSelectionId: ({ actionKind, payload }) => (
                    actionKind === 'setup-select-character'
                    && typeof (payload as { draftId?: unknown } | undefined)?.draftId === 'string'
                        ? (payload as { draftId: string }).draftId
                        : undefined
                ),
            },
        };

        expect(resolveManualSetupSelectionActionKindFromCommand({
            type: 'custom:select_draft',
            payload: { draftId: 'ranger' },
            engineConfig: manualSetupEngineConfig,
        })).toBe('setup-select-character');

        expect(resolveManualSetupSelectionId({
            actionKind: 'setup-select-character',
            payload: { draftId: 'ranger' },
            engineConfig: manualSetupEngineConfig,
        })).toBe('ranger');
    });

    it('shared state 未记录该派系且仍在 factionSelect 时，不应提前释放 select-faction attempt', () => {
        const sharedState = {
            core: {
                factionSelection: {
                    takenFactions: ['wizards'],
                    playerSelections: {
                        '0': ['wizards'],
                        '1': [],
                    },
                    completedPlayers: [],
                },
            },
            sys: {
                phase: 'factionSelect',
            },
        } as MatchState<unknown>;

        expect(shouldReleaseFactionSelectAttemptFromSharedState({
            sharedState,
            playerId: '1',
            factionId: 'robots',
        })).toBe(false);
    });

    it('shared state 已离开 factionSelect 时，可视为 select-faction attempt 已被权威态吸收', () => {
        const sharedState = {
            core: {
                factionSelection: undefined,
            },
            sys: {
                phase: 'startTurn',
            },
        } as MatchState<unknown>;

        expect(shouldReleaseFactionSelectAttemptFromSharedState({
            sharedState,
            playerId: '1',
            factionId: 'robots',
        })).toBe(true);
    });

    it('在线 AI 的前置选择动作在 seat 侧确认后，必须等待 shared state 吸收后再重试', () => {
        expect(shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt('select-faction')).toBe(true);
        expect(shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt('setup-select-faction')).toBe(true);
        expect(shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt('setup-select-character')).toBe(true);
        expect(shouldAwaitSharedStateBeforeRetryingOnlineAiAttempt('advance-phase')).toBe(false);
    });

    it('batch confirmed 只透传权威态，不直接回写 seat latestState', () => {
        const updateLatestState = vi.fn();
        const resync = vi.fn();
        const sendCommand = vi.fn();
        const subscribeStateUpdate = vi.fn(() => vi.fn());
        const sendBatch = vi.fn((_batchId, _commands, onConfirmed) => {
            onConfirmed?.({ sys: { phase: 'playCards' } });
        });

        const lastAiAttemptKeyRef = { current: null as string | null };

        submitOnlineAiResolution({
            client: {
                sendBatch,
                sendCommand,
                subscribeStateUpdate,
                latestState: buildOnlineAiSeatState({ nextId: 8 }),
                updateLatestState,
                resync,
            },
            resolution: buildResolution({
                attemptKey: 'attempt-confirmed',
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } },
                    { type: 'ADVANCE_PHASE', payload: { reason: 'follow-up' } },
                ],
            }),
            lastAiAttemptKeyRef,
            scheduleRetry: vi.fn(),
        });

        expect(lastAiAttemptKeyRef.current).toBe('attempt-confirmed');
        expect(sendBatch).toHaveBeenCalledTimes(1);
        expect(sendCommand).not.toHaveBeenCalled();
        expect(updateLatestState).not.toHaveBeenCalled();
    });

    it('batch rejected 后会清空 attemptKey 并安排重试；unauthorized 不重试', () => {
        const retry = vi.fn();
        const resync = vi.fn();
        const lastAiAttemptKeyRef = { current: null as string | null };
        const sendCommand = vi.fn();
        const subscribeStateUpdate = vi.fn(() => vi.fn());
        let rejectHandler: ((reason: string) => void) | undefined;
        const sendBatch = vi.fn((_batchId, _commands, _onConfirmed, onRejected) => {
            rejectHandler = onRejected;
        });

        submitOnlineAiResolution({
            client: {
                sendBatch,
                sendCommand,
                subscribeStateUpdate,
                latestState: buildOnlineAiSeatState({ nextId: 9 }),
                updateLatestState: vi.fn(),
                resync,
            },
            resolution: buildResolution({
                attemptKey: 'attempt-rejected',
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } },
                    { type: 'ADVANCE_PHASE', payload: { reason: 'follow-up' } },
                ],
            }),
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
                sendCommand,
                subscribeStateUpdate,
                latestState: buildOnlineAiSeatState({ nextId: 10 }),
                updateLatestState: vi.fn(),
                resync,
            },
            resolution: buildResolution({
                attemptKey: 'attempt-unauthorized',
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } },
                    { type: 'ADVANCE_PHASE', payload: { reason: 'follow-up' } },
                ],
            }),
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
        const sendCommand = vi.fn();
        const subscribeStateUpdate = vi.fn(() => vi.fn());
        let rejectHandler: ((reason: string) => void) | undefined;
        const sendBatch = vi.fn((_batchId, _commands, confirmed, rejected) => {
            confirmed?.({ sys: { phase: 'playCards' } });
            rejectHandler = rejected;
        });

        submitOnlineAiResolution({
            client: {
                sendBatch,
                sendCommand,
                subscribeStateUpdate,
                latestState: buildOnlineAiSeatState({ nextId: 11 }),
                updateLatestState: vi.fn(),
                resync,
            },
            resolution: buildResolution({
                attemptKey: 'attempt-callbacks',
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } },
                    { type: 'ADVANCE_PHASE', payload: { reason: 'follow-up' } },
                ],
            }),
            lastAiAttemptKeyRef: { current: null },
            scheduleRetry: vi.fn(),
            onConfirmed,
            onRejected,
        });

        expect(onConfirmed).toHaveBeenCalledWith({ sys: { phase: 'playCards' } });
        rejectHandler?.('command_failed');
        expect(onRejected).toHaveBeenCalledWith('command_failed');
    });

    it('提供 onWillResync 时由调用方接管 resync，内部不再重复 resync', () => {
        const retry = vi.fn();
        const resync = vi.fn();
        const onWillResync = vi.fn();
        const sendCommand = vi.fn();
        const subscribeStateUpdate = vi.fn(() => vi.fn());
        let rejectHandler: ((reason: string) => void) | undefined;
        const sendBatch = vi.fn((_batchId, _commands, _onConfirmed, onRejected) => {
            rejectHandler = onRejected;
        });

        submitOnlineAiResolution({
            client: {
                sendBatch,
                sendCommand,
                subscribeStateUpdate,
                latestState: buildOnlineAiSeatState({ nextId: 12 }),
                updateLatestState: vi.fn(),
                resync,
            },
            resolution: buildResolution({
                attemptKey: 'attempt-callback-resync',
                commands: [
                    { type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } },
                    { type: 'ADVANCE_PHASE', payload: { reason: 'follow-up' } },
                ],
            }),
            lastAiAttemptKeyRef: { current: null },
            scheduleRetry: retry,
            onWillResync,
        });

        rejectHandler?.('command_failed');
        expect(onWillResync).toHaveBeenCalledWith('command_failed');
        expect(resync).not.toHaveBeenCalled();
        expect(retry).toHaveBeenCalledTimes(1);
    });

    it('单命令提交应通过 state update 确认，不依赖 batch confirmed', () => {
        const onConfirmed = vi.fn();
        const unsubscribe = vi.fn();
        const sendBatch = vi.fn();
        const sendCommand = vi.fn();
        let stateListener: ((state: unknown) => void) | null = null;
        const subscribeStateUpdate = vi.fn((listener: (state: unknown) => void) => {
            stateListener = listener;
            return unsubscribe;
        });

        submitOnlineAiResolution({
            client: {
                sendBatch,
                sendCommand,
                subscribeStateUpdate,
                latestState: buildOnlineAiSeatState({ nextId: 13 }),
                updateLatestState: vi.fn(),
                resync: vi.fn(),
            },
            resolution: buildResolution({
                attemptKey: 'attempt-single-confirmed',
                commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-1' } }],
            }),
            lastAiAttemptKeyRef: { current: null },
            scheduleRetry: vi.fn(),
            onConfirmed,
        });

        expect(sendBatch).not.toHaveBeenCalled();
        expect(sendCommand).toHaveBeenCalledWith(
            'SYS_INTERACTION_RESPOND',
            { optionId: 'pick-1' },
            { onlineAiAttemptKey: 'attempt-single-confirmed' },
        );

        stateListener?.(buildOnlineAiSeatState({ nextId: 14 }));
        expect(onConfirmed).toHaveBeenCalledWith(expect.objectContaining({
            sys: expect.objectContaining({
                eventStream: expect.objectContaining({ nextId: 14 }),
            }),
        }));
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('SmashUp factionSelect 同一玩家连续选派系时，单命令确认不应误判为 4 秒超时', async () => {
        vi.useFakeTimers();
        try {
            const onConfirmed = vi.fn();
            const onRejected = vi.fn();
            const onWillResync = vi.fn();
            const unsubscribe = vi.fn();
            const sendBatch = vi.fn();
            const sendCommand = vi.fn();
            let stateListener: ((state: unknown) => void) | null = null;
            const subscribeStateUpdate = vi.fn((listener: (state: unknown) => void) => {
                stateListener = listener;
                return unsubscribe;
            });

            const latestState = {
                ...buildOnlineAiSeatState({
                    nextId: 15,
                    phase: 'factionSelect',
                    currentPlayerId: '3',
                }),
                core: {
                    currentPlayerId: '3',
                    factionSelection: {
                        takenFactions: ['aliens', 'pirates', 'robots'],
                        playerSelections: {
                            '0': ['aliens'],
                            '1': ['pirates'],
                            '2': ['robots'],
                            '3': [],
                        },
                    },
                },
            } as MatchState<unknown>;
            const confirmedState = {
                ...buildOnlineAiSeatState({
                    nextId: 15,
                    phase: 'factionSelect',
                    currentPlayerId: '3',
                }),
                core: {
                    currentPlayerId: '3',
                    factionSelection: {
                        takenFactions: ['aliens', 'pirates', 'robots', 'wizards'],
                        playerSelections: {
                            '0': ['aliens'],
                            '1': ['pirates'],
                            '2': ['robots'],
                            '3': ['wizards'],
                        },
                    },
                },
            } as MatchState<unknown>;

            submitOnlineAiResolution({
                client: {
                    sendBatch,
                    sendCommand,
                    subscribeStateUpdate,
                    latestState,
                    updateLatestState: vi.fn(),
                    resync: vi.fn(),
                },
                resolution: buildResolution({
                    playerId: '3',
                    attemptKey: 'attempt-faction-progress',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'pick-wizards' } }],
                }),
                lastAiAttemptKeyRef: { current: null },
                scheduleRetry: vi.fn(),
                onConfirmed,
                onRejected,
                onWillResync,
            });

            stateListener?.(confirmedState);
            expect(onConfirmed).toHaveBeenCalledWith(confirmedState);

            await vi.advanceTimersByTimeAsync(4000);
            expect(onRejected).not.toHaveBeenCalled();
            expect(onWillResync).not.toHaveBeenCalled();
            expect(unsubscribe).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('custom current-player seam 变化时，单命令确认应按 seam-aware marker 判定推进', async () => {
        vi.useFakeTimers();
        try {
            const onConfirmed = vi.fn();
            const onRejected = vi.fn();
            const onWillResync = vi.fn();
            const unsubscribe = vi.fn();
            const sendBatch = vi.fn();
            const sendCommand = vi.fn();
            let stateListener: ((state: unknown) => void) | null = null;
            const subscribeStateUpdate = vi.fn((listener: (state: unknown) => void) => {
                stateListener = listener;
                return unsubscribe;
            });

            const latestState = buildOnlineAiSeatState({
                nextId: 16,
                phase: 'defensiveRoll',
                currentPlayerId: '1',
            });
            const confirmedState = buildOnlineAiSeatState({
                nextId: 16,
                phase: 'defensiveRoll',
                currentPlayerId: '1',
            });
            (latestState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '0' };
            (confirmedState.core as { pendingAttack?: unknown }).pendingAttack = { defenderId: '1' };

            expect(buildAiProgressMarker(latestState)).toBe(buildAiProgressMarker(confirmedState));
            expect(buildAiProgressMarker(latestState, {
                engineConfig: createOnlineAiMarkerEngineConfig(),
            })).not.toBe(buildAiProgressMarker(confirmedState, {
                engineConfig: createOnlineAiMarkerEngineConfig(),
            }));

            submitOnlineAiResolution({
                client: {
                    sendBatch,
                    sendCommand,
                    subscribeStateUpdate,
                    latestState,
                    updateLatestState: vi.fn(),
                    resync: vi.fn(),
                },
                resolution: buildResolution({
                    playerId: '1',
                    attemptKey: 'attempt-custom-current-player-progress',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'confirm' } }],
                }),
                lastAiAttemptKeyRef: { current: null },
                scheduleRetry: vi.fn(),
                engineConfig: createOnlineAiMarkerEngineConfig(),
                onConfirmed,
                onRejected,
                onWillResync,
            });

            stateListener?.(confirmedState);
            expect(onConfirmed).toHaveBeenCalledWith(confirmedState);

            await vi.advanceTimersByTimeAsync(4000);
            expect(onRejected).not.toHaveBeenCalled();
            expect(onWillResync).not.toHaveBeenCalled();
            expect(unsubscribe).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('单命令超时后会清空 attemptKey、安排重试，并允许 onWillResync 接管 resync', async () => {
        vi.useFakeTimers();
        try {
            const retry = vi.fn();
            const resync = vi.fn();
            const onWillResync = vi.fn();
            const onRejected = vi.fn();
            const unsubscribe = vi.fn();
            const sendBatch = vi.fn();
            const sendCommand = vi.fn();
            const subscribeStateUpdate = vi.fn(() => unsubscribe);
            const lastAiAttemptKeyRef = { current: null as string | null };

            submitOnlineAiResolution({
                client: {
                    sendBatch,
                    sendCommand,
                    subscribeStateUpdate,
                    latestState: buildOnlineAiSeatState({ nextId: 15 }),
                    updateLatestState: vi.fn(),
                    resync,
                },
                resolution: buildResolution({
                    attemptKey: 'attempt-single-timeout',
                    commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } }],
                }),
                lastAiAttemptKeyRef,
                scheduleRetry: retry,
                onWillResync,
                onRejected,
            });

            expect(lastAiAttemptKeyRef.current).toBe('attempt-single-timeout');
            await vi.advanceTimersByTimeAsync(4000);

            expect(lastAiAttemptKeyRef.current).toBeNull();
            expect(sendBatch).not.toHaveBeenCalled();
            expect(onWillResync).toHaveBeenCalledWith('command_timeout');
            expect(resync).not.toHaveBeenCalled();
            expect(retry).toHaveBeenCalledTimes(1);
            expect(onRejected).toHaveBeenCalledWith('command_timeout');
            expect(unsubscribe).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('单命令收到 online_ai_circuit_open 后应立即停止当前尝试，不再安排重试', () => {
        const retry = vi.fn();
        const onRejected = vi.fn();
        const unsubscribeState = vi.fn();
        const unsubscribeError = vi.fn();
        const subscribeStateUpdate = vi.fn(() => unsubscribeState);
        let errorListener: ((error: string) => void) | null = null;
        const subscribeError = vi.fn((listener: (error: string) => void) => {
            errorListener = listener;
            return unsubscribeError;
        });
        const lastAiAttemptKeyRef = { current: null as string | null };

        submitOnlineAiResolution({
            client: {
                sendBatch: vi.fn(),
                sendCommand: vi.fn(),
                subscribeStateUpdate,
                subscribeError,
                latestState: buildOnlineAiSeatState({ nextId: 16 }),
                updateLatestState: vi.fn(),
                resync: vi.fn(),
            },
            resolution: buildResolution({
                attemptKey: 'attempt-single-circuit-open',
                commands: [{ type: 'SYS_INTERACTION_RESPOND', payload: { optionId: 'skip' } }],
            }),
            lastAiAttemptKeyRef,
            scheduleRetry: retry,
            onRejected,
        });

        errorListener?.('online_ai_circuit_open');

        expect(lastAiAttemptKeyRef.current).toBeNull();
        expect(retry).not.toHaveBeenCalled();
        expect(onRejected).toHaveBeenCalledWith('online_ai_circuit_open');
        expect(unsubscribeState).toHaveBeenCalledTimes(1);
        expect(unsubscribeError).toHaveBeenCalledTimes(1);
    });

    it('单命令未送达时应立即释放 attempt，不等待确认超时', () => {
        const retry = vi.fn();
        const onRejected = vi.fn();
        const unsubscribe = vi.fn();
        const lastAiAttemptKeyRef = { current: null as string | null };

        submitOnlineAiResolution({
            client: {
                sendBatch: vi.fn(),
                sendCommand: vi.fn(() => false),
                subscribeStateUpdate: vi.fn(() => unsubscribe),
                latestState: buildOnlineAiSeatState({ nextId: 16 }),
                updateLatestState: vi.fn(),
                resync: vi.fn(),
            },
            resolution: buildResolution({
                attemptKey: 'attempt-not-sent',
                commands: [{ type: 'PLAYER_READY', payload: {} }],
            }),
            lastAiAttemptKeyRef,
            scheduleRetry: retry,
            onRejected,
        });

        expect(lastAiAttemptKeyRef.current).toBeNull();
        expect(onRejected).toHaveBeenCalledWith('command_not_sent');
        expect(retry).not.toHaveBeenCalled();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('单命令收到 stale_state 后应结束当前尝试并等待新的权威状态，避免重复提交旧动作', () => {
        const retry = vi.fn();
        const onWillResync = vi.fn();
        const onConfirmed = vi.fn();
        const onRejected = vi.fn();
        const unsubscribeState = vi.fn();
        const unsubscribeError = vi.fn();
        let stateListener: ((state: unknown) => void) | null = null;
        let errorListener: ((error: string) => void) | null = null;
        const subscribeStateUpdate = vi.fn((listener: (state: unknown) => void) => {
            stateListener = listener;
            return unsubscribeState;
        });
        const subscribeError = vi.fn((listener: (error: string) => void) => {
            errorListener = listener;
            return unsubscribeError;
        });
        const lastAiAttemptKeyRef = { current: null as string | null };

        submitOnlineAiResolution({
            client: {
                sendBatch: vi.fn(),
                sendCommand: vi.fn(),
                subscribeStateUpdate,
                subscribeError,
                latestState: buildOnlineAiSeatState({ nextId: 16 }),
                updateLatestState: vi.fn(),
                resync: vi.fn(),
            },
            resolution: buildResolution({
                attemptKey: 'attempt-single-stale-state',
                commands: [{ type: 'ROLL_DICE', payload: {} }],
            }),
            lastAiAttemptKeyRef,
            scheduleRetry: retry,
            onWillResync,
            onConfirmed,
            onRejected,
        });

        errorListener?.('stale_state');
        stateListener?.(buildOnlineAiSeatState({ nextId: 17 }));

        expect(lastAiAttemptKeyRef.current).toBeNull();
        expect(onWillResync).toHaveBeenCalledWith('stale_state');
        expect(retry).not.toHaveBeenCalled();
        expect(onRejected).toHaveBeenCalledWith('stale_state');
        expect(onConfirmed).not.toHaveBeenCalled();
        expect(unsubscribeState).toHaveBeenCalledTimes(1);
        expect(unsubscribeError).toHaveBeenCalledTimes(1);
    });
});

describe('shouldSilentlyRetryOnlineAiBatchRejection', () => {
    it('仅对 stale_state 走静默重试分支', () => {
        expect(shouldSilentlyRetryOnlineAiBatchRejection('stale_state')).toBe(true);
        expect(shouldSilentlyRetryOnlineAiBatchRejection('online_ai_circuit_open')).toBe(true);
        expect(shouldSilentlyRetryOnlineAiBatchRejection('command_failed')).toBe(false);
        expect(shouldSilentlyRetryOnlineAiBatchRejection('unauthorized')).toBe(false);
    });
});

describe('online command error visibility', () => {
    it('命令执行失败和 pipeline 详情不应被 MatchRoom 静默拦截', () => {
        expect(shouldShowOnlineGameErrorToast('command_failed')).toBe(true);
        expect(shouldShowOnlineGameErrorToast('pipeline_error: effect contract missing turnFlags')).toBe(true);
        expect(shouldShowOnlineGameErrorToast('summon_position_not_adjacent_to_gate')).toBe(true);
        expect(shouldShowOnlineGameErrorToast('stale_state')).toBe(false);
        expect(shouldShowOnlineGameErrorToast('unauthorized')).toBe(false);
    });

    it('batch 拒绝除 stale_state 外都应透传给错误展示，同时自定义命令错误也要触发回滚重同步', () => {
        expect(shouldForwardOnlineBatchRejectionToError('command_failed')).toBe(true);
        expect(shouldForwardOnlineBatchRejectionToError('pipeline_error: forced detail')).toBe(true);
        expect(shouldForwardOnlineBatchRejectionToError('summon_position_not_adjacent_to_gate')).toBe(true);
        expect(shouldForwardOnlineBatchRejectionToError('stale_state')).toBe(false);

        expect(shouldRecoverFromRejectedCommandError('pipeline_error: forced detail')).toBe(true);
        expect(shouldRecoverFromRejectedCommandError('summon_position_not_adjacent_to_gate')).toBe(true);
        expect(shouldRecoverFromRejectedCommandError('unauthorized')).toBe(false);
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
            payload: { interactionId: 'hoverbot-hidden', optionId: 'skip' },
        });
    });

    it('隐藏交互包含可执行选项但显式提供 skip/pass 时，仍应返回强制跳过 resolution', () => {
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

        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'hoverbot-hidden', optionId: 'skip' },
        });
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
            payload: { interactionId: 'empty-hidden', optionId: '__emergency_skip__' },
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
            payload: { interactionId: 'done-hidden', optionId: 'done' },
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

    it('trigger-only hidden simple-choice 应按 engineConfig 自动选择首个 trigger', () => {
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
                                id: 'trigger-hidden',
                                playerId: '1',
                                kind: 'simple-choice',
                                data: {
                                    sourceId: 'smashup_reaction_choose',
                                    multi: { min: 1, max: 1 },
                                    options: [
                                        {
                                            id: 'trigger-a',
                                            label: '触发 A',
                                            value: { kind: 'trigger', triggerId: 'afterScoring:a' },
                                        },
                                    ],
                                },
                            },
                            queue: [],
                        },
                    },
                } as MatchState<unknown>,
            },
            engineConfig: {
                gameId: 'smashup',
                onlineAiRecovery: {
                    autoSelectFirstTriggerOnlySimpleChoiceSourceIds: ['smashup_reaction_choose'],
                },
            },
        });

        expect(candidate?.resolution.action.commands[0]).toEqual({
            type: 'SYS_INTERACTION_RESPOND',
            payload: { interactionId: 'trigger-hidden', optionId: 'trigger-a' },
        });
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
            { type: 'SYS_INTERACTION_RESPOND', payload: { interactionId: 'hidden-skip', optionId: 'skip' } },
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
            { type: 'SYS_INTERACTION_CANCEL', payload: { interactionId: 'visible-mandatory' } },
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

    it('DiceThrone 防御阶段应按防御方识别 AI 强制结束候选', () => {
        const candidate = resolveForceEndTurnForStalledAi({
            sharedState: {
                core: {
                    activePlayerId: '0',
                    pendingAttack: {
                        attackerId: '0',
                        defenderId: '1',
                        isDefendable: true,
                        sourceAbilityId: 'fist-technique-5',
                        defenseAbilityId: 'duel',
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
                    turnNumber: 3,
                    phase: 'defensiveRoll',
                },
            } as MatchState<unknown>,
            seatControllers: {
                '0': { type: 'human' },
                '1': { type: 'local-ai' },
            },
            seatStates: {},
            engineConfig: createOnlineAiMarkerEngineConfig(),
        });

        expect(candidate).toMatchObject({
            playerId: '1',
            reason: 'active-turn-legal-only',
            legalActionOnly: true,
        });
    });

    it('DiceThrone 防御阶段在线 AI 应允许防御方用共享状态恢复合法动作', async () => {
        registerGameAiRuntime(diceThroneAiRuntime);
        const sharedState = {
            core: {
                activePlayerId: '0',
                players: {
                    '0': {
                        resources: {},
                        hand: [],
                        statusEffects: {},
                        tokens: {},
                        abilities: [],
                    },
                    '1': {
                        resources: {},
                        hand: [],
                        statusEffects: {},
                        tokens: {},
                        abilities: [],
                    },
                },
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                    isDefendable: true,
                    sourceAbilityId: 'dagger-strike-5',
                },
                dice: [],
                rollCount: 0,
                rollLimit: 3,
                rollConfirmed: false,
            },
            sys: {
                phase: 'defensiveRoll',
                turnNumber: 3,
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
        } as MatchState<unknown>;
        const privateOverlay = {
            ...sharedState,
            core: {
                ...(sharedState.core as Record<string, unknown>),
                players: {
                    ...((sharedState.core as { players: Record<string, unknown> }).players),
                    '1': {
                        ...((sharedState.core as { players: Record<string, Record<string, unknown>> }).players['1']),
                        abilities: [
                            {
                                id: 'shadow-defense',
                                type: 'defensive',
                            },
                        ],
                    },
                },
            },
        } as MatchState<unknown>;

        const dispatch = await resolveNextAiDispatch({
            engineConfig: {
                gameId: 'dicethrone',
                onlineAiRecovery: {
                    activeTurnLegalActionOnlyPhases: ['offensiveRoll', 'targetingRoll', 'defensiveRoll'],
                    resolveCurrentPlayerId: ({ state, phase, fallbackPlayerId }) => {
                        if (phase !== 'defensiveRoll') return fallbackPlayerId;
                        const pendingAttack = (state.core as { pendingAttack?: { defenderId?: unknown } }).pendingAttack;
                        return typeof pendingAttack?.defenderId === 'string'
                            ? pendingAttack.defenderId
                            : fallbackPlayerId;
                    },
                },
            } as Pick<GameEngineConfig, 'gameId' | 'onlineAiRecovery'>,
            state: sharedState,
            matchId: 'match-watchdog-dicethrone-defensive-legal-action',
            seatControllers: {
                '1': { type: 'local-ai' },
            },
            visibleStateResolver: (playerId) => resolveOnlineAiDecisionView({
                runtime: getGameAiRuntime('dicethrone') ?? null,
                sharedState,
                privateOverlay,
                playerId,
            }),
        });

        expect(dispatch).toMatchObject({
            kind: 'action',
            resolution: {
                playerId: '1',
                action: {
                    kind: 'select-ability',
                    commands: [{ type: 'SELECT_ABILITY', payload: { abilityId: 'shadow-defense' } }],
                },
            },
        });
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

    it('同一 interaction id 下若 sourceId 或选项签名变化，应视为已推进而不是重试', () => {
        const previousState = buildProgressState({
            sys: {
                turnNumber: 1,
                phase: 'scoreBases',
                eventStream: { nextId: 5 },
                interaction: {
                    current: {
                        id: 'reaction-choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window-1',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });
        const nextState = buildProgressState({
            sys: {
                turnNumber: 1,
                phase: 'scoreBases',
                eventStream: { nextId: 5 },
                interaction: {
                    current: {
                        id: 'reaction-choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                { id: 'play_action:c1:0', label: '打出动作牌', value: { kind: 'play_action' } },
                                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window-1',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: false,
            activeAttemptKey: 'attempt-1',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState),
            nextState,
        })).toBe(false);
    });

    it('决策面 epoch 变化时，即使 interaction / responseWindow 指纹未变，也应视为已推进', () => {
        const previousState = buildProgressState({
            sys: {
                turnNumber: 1,
                phase: 'scoreBases',
                eventStream: { nextId: 5 },
                decisionEpoch: 7,
                interaction: {
                    current: {
                        id: 'reaction-choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window-1',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });
        const nextState = buildProgressState({
            sys: {
                turnNumber: 1,
                phase: 'scoreBases',
                eventStream: { nextId: 5 },
                decisionEpoch: 8,
                interaction: {
                    current: {
                        id: 'reaction-choice-1',
                        kind: 'simple-choice',
                        playerId: '1',
                        data: {
                            sourceId: 'smashup_reaction_choose',
                            options: [
                                { id: 'trigger-a', label: 'A', value: { kind: 'trigger', triggerId: 'a' } },
                                { id: 'pass', label: 'Pass', value: { kind: 'pass' } },
                            ],
                        },
                    },
                    queue: [],
                },
                responseWindow: {
                    current: {
                        id: 'reaction-window-1',
                        windowType: 'afterScoring',
                        sourceId: 'smashup_reaction_choose',
                        responderQueue: ['1'],
                        currentResponderIndex: 0,
                    },
                },
            },
        });

        expect(buildAiProgressMarker(previousState)).not.toBe(buildAiProgressMarker(nextState));
        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: false,
            activeAttemptKey: 'attempt-1',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState),
            nextState,
        })).toBe(false);
    });

    it('custom current-player seam 漂移时，本地 AI retry guard 不应误判为未推进', () => {
        const engineConfig = {
            gameId: 'custom-offturn-game',
            onlineAiRecovery: {
                resolveCurrentPlayerId: ({ state, phase, fallbackPlayerId }: {
                    state: MatchState<unknown>;
                    phase: string;
                    fallbackPlayerId: string | null;
                }) => {
                    if (phase !== 'defensiveRoll') {
                        return fallbackPlayerId;
                    }
                    const pendingAttack = (state.core as {
                        pendingAttack?: {
                            defenderId?: unknown;
                        };
                    } | undefined)?.pendingAttack;
                    return typeof pendingAttack?.defenderId === 'string'
                        ? pendingAttack.defenderId
                        : fallbackPlayerId;
                },
            },
        } as const;

        const previousState = buildProgressState({
            core: {
                activePlayerId: '0',
                pendingAttack: {
                    attackerId: '0',
                    defenderId: '1',
                },
            },
            sys: {
                turnNumber: 1,
                phase: 'defensiveRoll',
                eventStream: { nextId: 5 },
                interaction: { current: null, queue: [] },
                responseWindow: { current: null },
            },
        });
        const nextState = buildProgressState({
            core: {
                activePlayerId: '0',
                pendingAttack: undefined,
            },
            sys: {
                turnNumber: 1,
                phase: 'main2',
                eventStream: { nextId: 5 },
                interaction: { current: null, queue: [] },
                responseWindow: { current: null },
            },
        });

        expect(buildAiProgressMarker(previousState, { engineConfig })).not.toBe(
            buildAiProgressMarker(nextState, { engineConfig }),
        );
        expect(shouldRetryLocalAiAttemptAfterDispatch({
            cancelled: false,
            activeAttemptKey: 'attempt-1',
            resolutionAttemptKey: 'attempt-1',
            markerBeforeDispatch: buildAiProgressMarker(previousState, { engineConfig }),
            nextState,
            engineConfig,
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

    it('本地 AI 当前回合没有 legal action 时，不应永久卡住在 AI 半回合', async () => {
        vi.useFakeTimers();
        const gameId = '__test_local_ai_stall_watchdog__';

        registerGameAiRuntime({
            gameId,
            buildLegalActions: () => [],
            localPolicies: {
                default: {
                    id: 'default',
                    decide: vi.fn(() => null),
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
                    watchdogRecoveries: 0,
                }),
                validate: () => ({ valid: true }),
                execute: (_state: MatchState<unknown>, command: { type: string }) => (
                    command.type === 'ADVANCE_PHASE'
                        ? [{ type: 'AI_TURN_FORCE_ADVANCED' } as const]
                        : []
                ),
                reduce: (
                    core: {
                        turnOrder: string[];
                        currentPlayerIndex: number;
                        watchdogRecoveries?: number;
                    },
                    event: { type: string },
                ) => (
                    event.type === 'AI_TURN_FORCE_ADVANCED'
                        ? {
                            ...core,
                            currentPlayerIndex: 0,
                            watchdogRecoveries: (core.watchdogRecoveries ?? 0) + 1,
                        }
                        : core
                ),
            },
            systems: [],
        } as const;

        const Probe = () => {
            const { state } = useGameClient<{
                currentPlayerIndex: number;
                watchdogRecoveries?: number;
            }>();
            return createElement(
                'div',
                { 'data-testid': 'local-ai-stall-probe' },
                JSON.stringify({
                    currentPlayerIndex: state?.core.currentPlayerIndex ?? null,
                    watchdogRecoveries: state?.core.watchdogRecoveries ?? null,
                }),
            );
        };

        render(createElement(
            LocalGameProvider,
            {
                config: engineConfig as never,
                numPlayers: 2,
                seed: 'local-ai-stall-seed',
                seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } },
            },
            createElement(Probe),
        ));

        await act(async () => {
            await vi.advanceTimersByTimeAsync(1600);
        });

        const probe = screen.getByTestId('local-ai-stall-probe');
        expect(probe.textContent).toContain('"currentPlayerIndex":0');
        expect(probe.textContent).toContain('"watchdogRecoveries":1');
    });

    it('回归：从本地快照恢复到 AI 回合后，AI 应继续自动推进', async () => {
        const gameId = '__test_local_ai_resume_after_restore__';
        const seed = 'local-ai-resume-seed';
        const decideSpy = vi.fn(() => ({ actionId: 'advance-to-human' }));

        registerGameAiRuntime({
            gameId,
            buildLegalActions: ({ playerId, state }) => {
                const core = state.core as {
                    currentPlayerIndex?: number;
                    turnOrder?: string[];
                };
                const currentPlayerId = Array.isArray(core.turnOrder) && typeof core.currentPlayerIndex === 'number'
                    ? core.turnOrder[core.currentPlayerIndex]
                    : null;
                if (playerId !== '1' || currentPlayerId !== '1') {
                    return [];
                }
                return [{
                    actionId: 'advance-to-human',
                    kind: 'advance-phase',
                    label: '推进到真人回合',
                    commands: [{ type: 'ADVANCE_TO_HUMAN', payload: {} }],
                }];
            },
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
                validate: () => ({ valid: true }),
                execute: (_state: MatchState<unknown>, command: { type: string }) => (
                    command.type === 'ADVANCE_TO_HUMAN'
                        ? [{ type: 'TURN_PASSED' } as const]
                        : []
                ),
                reduce: (
                    core: {
                        turnOrder: string[];
                        currentPlayerIndex: number;
                        resumedAiTurns?: number;
                    },
                    event: { type: string },
                ) => (
                    event.type === 'TURN_PASSED'
                        ? {
                            ...core,
                            currentPlayerIndex: 0,
                            resumedAiTurns: (core.resumedAiTurns ?? 0) + 1,
                        }
                        : core
                ),
            },
            systems: [],
        } as const;

        const snapshotState = {
            core: {
                turnOrder: ['0', '1'],
                currentPlayerIndex: 1,
                resumedAiTurns: 0,
            },
            sys: {
                phase: 'playCards',
                turnNumber: 3,
                eventStream: {
                    nextId: 1,
                    entries: [],
                },
                interaction: {
                    current: undefined,
                    queue: [],
                    isBlocked: false,
                },
                responseWindow: {
                    current: undefined,
                },
            },
        } as MatchState<unknown>;

        persistLocalMatchSnapshot({
            gameId,
            seed,
            numPlayers: 2,
            state: snapshotState,
            randomCursor: 0,
        });

        const Probe = () => {
            const { state } = useGameClient<{
                currentPlayerIndex: number;
                resumedAiTurns?: number;
            }>();
            return createElement(
                'div',
                {
                    'data-testid': 'local-ai-resume-probe',
                },
                JSON.stringify({
                    currentPlayerIndex: state?.core.currentPlayerIndex ?? null,
                    resumedAiTurns: state?.core.resumedAiTurns ?? null,
                }),
            );
        };

        try {
            render(createElement(
                LocalGameProvider,
                {
                    config: engineConfig as never,
                    numPlayers: 2,
                    seed,
                    persistSession: true,
                    seatControllers: { '1': { type: 'local-ai', minimumActionDelayMs: 0 } },
                },
                createElement(Probe),
            ));

            await waitFor(() => {
                const probe = screen.getByTestId('local-ai-resume-probe');
                expect(probe.textContent).toContain('"currentPlayerIndex":0');
                expect(probe.textContent).toContain('"resumedAiTurns":1');
            }, { timeout: 1500 });

        } finally {
            localStorage.removeItem(buildLocalMatchSnapshotKey(gameId, seed));
        }
    });
});

describe('LocalGameProvider 视角与重置契约', () => {
    afterEach(() => {
        cleanup();
    });

    it('混合人机且未显式先手时，LocalGameProvider 初始化应先把真人座位传给 domain.setup', async () => {
        const setupSpy = vi.fn((incomingPlayerIds: string[]) => ({
            turnOrder: incomingPlayerIds,
            currentPlayerIndex: 0,
        }));

        const engineConfig = {
            gameId: '__test_local_human_first_default__',
            domain: {
                gameId: '__test_local_human_first_default__',
                setup: setupSpy,
                validate: () => ({ valid: true }),
                execute: () => [],
                reduce: (core: unknown) => core,
            },
            systems: [],
        } as const;

        render(
            createElement(
                LocalGameProvider,
                {
                    config: engineConfig as never,
                    numPlayers: 2,
                    seed: 'local-human-first-default-seed',
                    seatControllers: {
                        '0': { type: 'local-ai' },
                        '1': { type: 'human' },
                    },
                },
                createElement('div', { 'data-testid': 'local-human-first-default-probe' }, 'ready'),
            ),
        );

        await waitFor(() => {
            expect(setupSpy).toHaveBeenCalledTimes(1);
        });
        expect(setupSpy.mock.calls[0]?.[0]).toEqual(['1', '0']);
    });

    it('LocalGameProvider 存在显式 firstPlayerId 时，不应覆盖调用方 playerIds 顺序', async () => {
        const setupSpy = vi.fn((incomingPlayerIds: string[]) => ({
            turnOrder: incomingPlayerIds,
            currentPlayerIndex: 0,
        }));

        const engineConfig = {
            gameId: '__test_local_human_first_explicit__',
            domain: {
                gameId: '__test_local_human_first_explicit__',
                setup: setupSpy,
                validate: () => ({ valid: true }),
                execute: () => [],
                reduce: (core: unknown) => core,
            },
            systems: [],
        } as const;

        render(
            createElement(
                LocalGameProvider,
                {
                    config: engineConfig as never,
                    numPlayers: 2,
                    seed: 'local-human-first-explicit-seed',
                    setupData: { firstPlayerId: '0' },
                    seatControllers: {
                        '0': { type: 'local-ai' },
                        '1': { type: 'human' },
                    },
                },
                createElement('div', { 'data-testid': 'local-human-first-explicit-probe' }, 'ready'),
            ),
        );

        await waitFor(() => {
            expect(setupSpy).toHaveBeenCalledTimes(1);
        });
        expect(setupSpy.mock.calls[0]?.[0]).toEqual(['0', '1']);
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

    it('回归：四人手动代 AI 选派系进入第二轮时，P4 的第二个派系必须写回到 player 3', async () => {
        const Probe = () => {
            const { state, dispatch, playerId } = useGameClient<{
                currentPlayerIndex: number;
                factionSelection?: {
                    playerSelections?: Record<string, string[]>;
                };
            }>();

            return createElement(
                'div',
                null,
                createElement('button', {
                    'data-testid': 'local-manual-p4-dispatch',
                    onClick: () => dispatch('su:select_faction', { factionId: 'tricksters' }),
                }),
                createElement(
                    'div',
                    { 'data-testid': 'local-manual-p4-probe' },
                    JSON.stringify({
                        playerId,
                        currentPlayerIndex: state?.core.currentPlayerIndex ?? null,
                        playerSelections: state?.core.factionSelection?.playerSelections ?? null,
                    }),
                ),
            );
        };

        const engineConfig = {
            gameId: '__test_smashup_local_manual_p4_second_pick__',
            resolveLocalPregameControlledPlayerId: resolveSmashUpLocalPregameControlledPlayerId,
            domain: {
                gameId: '__test_smashup_local_manual_p4_second_pick__',
                setup: () => ({
                    turnOrder: ['0', '1', '2', '3'],
                    currentPlayerIndex: 3,
                    factionSelection: {
                        playerSelections: {
                            '0': ['aliens'],
                            '1': ['ninjas'],
                            '2': ['robots'],
                            '3': ['wizards'],
                        },
                    },
                }),
                validate: () => ({ valid: true }),
                execute: (_state: MatchState<unknown>, command: { type: string; playerId?: string; payload?: { factionId?: string } }) => (
                    command.type === 'su:select_faction' && command.playerId && command.payload?.factionId
                        ? [{
                            type: 'FACTION_SELECTED',
                            payload: {
                                playerId: command.playerId,
                                factionId: command.payload.factionId,
                            },
                        } as const]
                        : []
                ),
                reduce: (
                    core: {
                        currentPlayerIndex: number;
                        factionSelection: {
                            playerSelections: Record<string, string[]>;
                        };
                    },
                    event: { type: string; payload?: { playerId?: string; factionId?: string } },
                ) => {
                    if (event.type !== 'FACTION_SELECTED' || !event.payload?.playerId || !event.payload?.factionId) {
                        return core;
                    }

                    return {
                        ...core,
                        currentPlayerIndex: 2,
                        factionSelection: {
                            playerSelections: {
                                ...core.factionSelection.playerSelections,
                                [event.payload.playerId]: [
                                    ...(core.factionSelection.playerSelections[event.payload.playerId] ?? []),
                                    event.payload.factionId,
                                ],
                            },
                        },
                    };
                },
            },
            systems: [],
        } as const;

        render(
            createElement(
                LocalGameProvider,
                {
                    config: engineConfig as never,
                    numPlayers: 4,
                    seed: 'smashup-local-manual-p4-second-pick',
                    playerId: '0',
                    seatControllers: {
                        '0': { type: 'human' },
                        '1': { type: 'local-ai', manualFactionSelection: true },
                        '2': { type: 'local-ai', manualFactionSelection: true },
                        '3': { type: 'local-ai', manualFactionSelection: true },
                    },
                },
                createElement(Probe),
            ),
        );

        expect(screen.getByTestId('local-manual-p4-probe').textContent).toContain('"playerId":"3"');

        await act(async () => {
            screen.getByTestId('local-manual-p4-dispatch').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });

        const probe = screen.getByTestId('local-manual-p4-probe');
        expect(probe.textContent).toContain('"playerId":"2"');
        expect(probe.textContent).toContain('"currentPlayerIndex":2');
        expect(probe.textContent).toContain('"3":["wizards","tricksters"]');
    });
});

describe('useMatchStatus 竞态保护', () => {
    afterEach(() => {
        vi.useRealTimers();
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

    it('房间 404 后停止重试，避免持续刷请求', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);

        const getMatchSpy = vi.spyOn(matchApi, 'getMatch').mockRejectedValue(new Error('404: Match not found'));
        const { result } = renderHook(() => useMatchStatus('dicethrone', 'missing-match', '0'));

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(result.current.errorKind).toBe('not_found');
        expect(result.current.error).toBe('房间不存在或已被删除');

        const callsAfter404 = getMatchSpy.mock.calls.length;
        act(() => {
            vi.advanceTimersByTime(30_000);
        });
        await act(async () => Promise.resolve());

        expect(getMatchSpy).toHaveBeenCalledTimes(callsAfter404);
    });

    it('瞬时网络错误会触发退避，避免固定 3 秒频率重试', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        vi.spyOn(Math, 'random').mockReturnValue(0.5);

        const getMatchSpy = vi.spyOn(matchApi, 'getMatch').mockRejectedValue(new Error('network timeout'));
        renderHook(() => useMatchStatus('dicethrone', 'backoff-match', '0'));

        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        expect(getMatchSpy).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(3000);
        });
        await act(async () => Promise.resolve());
        expect(getMatchSpy).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(3000);
        });
        await act(async () => Promise.resolve());
        expect(getMatchSpy).toHaveBeenCalledTimes(2);
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
            initReactI18next: {
                type: '3rdParty',
                init: () => undefined,
            },
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

        await waitFor(() => {
            expect(screen.getAllByText('lobby:home.activeMatch.status').length).toBeGreaterThan(0);
        });
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

        await waitFor(() => {
            expect(screen.getAllByText('lobby:home.activeMatch.status').length).toBeGreaterThan(0);
        });
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
