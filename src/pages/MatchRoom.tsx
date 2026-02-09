import { useEffect, useState, useMemo, useRef } from 'react';
import type { ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_IMPLEMENTATIONS } from '../games/registry';
import { useDebug } from '../contexts/DebugContext';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import { RematchProvider } from '../contexts/RematchContext';
import {
    useMatchStatus,
    destroyMatch,
    leaveMatch,
    rejoinMatch,
    persistMatchCredentials,
    clearMatchCredentials,
    clearOwnerActiveMatch,
    readStoredMatchCredentials,
    validateStoredMatchSeat,
} from '../hooks/match/useMatchStatus';
import { getOrCreateGuestId } from '../hooks/match/ownerIdentity';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { useModalStack } from '../contexts/ModalStackContext';
import { useToast } from '../contexts/ToastContext';
import { SocketIO } from 'boardgame.io/multiplayer';
import { GAME_SERVER_URL } from '../config/server';
import { getGameById } from '../config/games.config';
import { GameHUD } from '../components/game/GameHUD';
import { GameModeProvider } from '../contexts/GameModeContext';
import { SEO } from '../components/common/SEO';
import { createUgcClientGame } from '../ugc/client/game';
import { createUgcRemoteHostBoard } from '../ugc/client/board';
import { LoadingScreen } from '../components/system/LoadingScreen';


export const MatchRoom = () => {
    const { playerID: debugPlayerID, setPlayerID } = useDebug();
    const { gameId, matchId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { startTutorial, closeTutorial, isActive, currentStep } = useTutorial();
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const { t, i18n } = useTranslation('lobby');

    const gameConfig = gameId ? getGameById(gameId) : undefined;
    const isUgcGame = Boolean(gameConfig?.isUgc);
    const isTutorialRoute = window.location.pathname.endsWith('/tutorial');

    type GameClientComponent = ComponentType<{ playerID?: string | null; matchID?: string; credentials?: string }>;

    const GameClient = useMemo(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        const impl = GAME_IMPLEMENTATIONS[gameId];

        // boardgame.io 的 SocketIO 传输会通过 socket.io（`/socket.io`）连接。
        // 开发环境依赖 Vite 代理将 `/socket.io` 转发到游戏服务端。
        return Client({
            game: impl.game,
            board: impl.board,
            debug: false,
            multiplayer: SocketIO({ server: GAME_SERVER_URL }),
            loading: () => <LoadingScreen title="Connecting" description={t('matchRoom.loadingResources')} />
        });
    }, [gameId]);

    const [ugcGameClient, setUgcGameClient] = useState<GameClientComponent | null>(null);
    const [ugcLoading, setUgcLoading] = useState(false);
    const [ugcError, setUgcError] = useState<string | null>(null);

    useEffect(() => {
        if (!gameId || !isUgcGame || isTutorialRoute) {
            setUgcGameClient(null);
            setUgcLoading(false);
            setUgcError(null);
            return;
        }

        let cancelled = false;
        setUgcLoading(true);
        setUgcError(null);

        createUgcClientGame(gameId)
            .then(({ game, config }) => {
                if (cancelled) return;
                const board = createUgcRemoteHostBoard({
                    packageId: gameId,
                    viewUrl: config.viewUrl,
                });
                const client = Client({
                    game,
                    board,
                    debug: false,
                    multiplayer: SocketIO({ server: GAME_SERVER_URL }),
                    loading: () => <LoadingScreen title="Connecting" description={t('matchRoom.joiningRoom')} />
                });
                setUgcGameClient(() => client as GameClientComponent);
            })
            .catch((error) => {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : 'UGC 运行态加载失败';
                setUgcError(message);
                setUgcGameClient(null);
            })
            .finally(() => {
                if (cancelled) return;
                setUgcLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [gameId, isUgcGame, isTutorialRoute]);

    const TutorialClient = useMemo(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        const impl = GAME_IMPLEMENTATIONS[gameId];
        return Client({
            game: impl.game,
            board: impl.board,
            debug: false,
            numPlayers: 2,
            loading: () => <LoadingScreen title="Tutorial" description={t('matchRoom.loadingResources')} />
        }) as React.ComponentType<{ playerID?: string | null }>;
    }, [gameId]);

    const [isLeaving, setIsLeaving] = useState(false);
    const [isGameNamespaceReady, setIsGameNamespaceReady] = useState(true);
    const [destroyModalId, setDestroyModalId] = useState<string | null>(null);
    const [forceExitModalId, setForceExitModalId] = useState<string | null>(null);
    const [shouldShowMatchError, setShouldShowMatchError] = useState(false);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const tutorialStartedRef = useRef(false);
    const lastTutorialStepIdRef = useRef<string | null>(null);
    const tutorialModalIdRef = useRef<string | null>(null);
    const errorToastRef = useRef<{ key: string; timestamp: number } | null>(null);

    const resolvedGameClient = isUgcGame ? ugcGameClient : GameClient;
    const ResolvedGameClient = resolvedGameClient ?? null;

    useEffect(() => {
        if (!gameId) return;
        const namespace = `game-${gameId}`;
        let isActive = true;

        setIsGameNamespaceReady(false);
        i18n.loadNamespaces(namespace)
            .then(() => {
                if (isActive) {
                    setIsGameNamespaceReady(true);
                }
            })
            .catch(() => {
                if (isActive) {
                    setIsGameNamespaceReady(true);
                }
            });

        return () => {
            isActive = false;
        };
    }, [gameId, i18n]);

    // 从地址查询参数中获取 playerID
    const urlPlayerID = searchParams.get('playerID');
    const shouldAutoJoin = searchParams.get('join') === 'true';
    const spectateParam = searchParams.get('spectate');
    const storedMatchCreds = useMemo(() => {
        // 教程模式不需要房间凭据
        if (isTutorialRoute || !matchId) return null;
        const raw = localStorage.getItem(`match_creds_${matchId}`);
        if (!raw) return null;
        try {
            return JSON.parse(raw) as { playerID?: string; credentials?: string };
        } catch {
            return null;
        }
    }, [matchId, isTutorialRoute, localStorageTick]);
    const storedPlayerID = storedMatchCreds?.playerID;
    const hasStoredSeat = Boolean(storedPlayerID);
    const isSpectatorRoute = !isTutorialRoute
        && !shouldAutoJoin
        && !urlPlayerID
        && !hasStoredSeat
        && (spectateParam === null || spectateParam === '1' || spectateParam === 'true');
    useEffect(() => {
        // 日志已移除：Spectate 调试信息过于频繁
    }, [gameId, matchId, urlPlayerID, shouldAutoJoin, spectateParam, isSpectatorRoute]);

    // 自动加入逻辑（调试重置跳转）
    const [isAutoJoining, setIsAutoJoining] = useState(false);
    const autoJoinStartedRef = useRef(false);
    useEffect(() => {
        if (!shouldAutoJoin || !gameId || !matchId || isTutorialRoute || isAutoJoining) return;
        if (autoJoinStartedRef.current) {
            return;
        }
        autoJoinStartedRef.current = true;

        let cancelled = false;
        let retryTimer: number | undefined;
        const safeSetIsAutoJoining = (value: boolean) => {
            if (!cancelled) {
                setIsAutoJoining(value);
            }
        };

        // 如果已有凭据，直接使用
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (stored) {
            try {
                const data = JSON.parse(stored);
                // 如果已有玩家 1 的凭据，直接跳转
                if (data?.playerID === '1') {
                    window.location.href = `/play/${gameId}/match/${matchId}?playerID=1`;
                    return;
                }
                // 如果是玩家0凭据（可能是同浏览器另一标签），不使用，继续自动加入
                if (data?.playerID === '0') {
                } else {
                    // 其他情况默认跳过
                    return;
                }
            } catch {
                // 解析失败，继续自动加入
            }
        }

        safeSetIsAutoJoining(true);
        const guestId = getOrCreateGuestId();
        const playerName = t('player.guest', { id: guestId, ns: 'lobby' });

        // 先查询房间状态，找到可用位置（带重试）
        const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });
        let retryCount = 0;
        const maxRetries = 5;

        const scheduleRetry = (delay: number) => {
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
            retryTimer = window.setTimeout(() => {
                if (!cancelled) {
                    void tryJoin();
                }
            }, delay);
        };

        const tryJoin = async () => {
            if (cancelled) return;
            try {
                const matchInfo = await lobbyClient.getMatch(gameId, matchId);
                if (cancelled) return;
                const openSeat = [...matchInfo.players]
                    .sort((a, b) => a.id - b.id)
                    .find(p => !p.name);
                // 找一个空位
                if (!openSeat) {
                    safeSetIsAutoJoining(false);
                    return;
                }
                const targetPlayerID = String(openSeat.id);
                const { success } = await rejoinMatch(gameId, matchId, targetPlayerID, playerName, { guestId });
                if (cancelled) return;
                if (success) {
                    window.location.href = `/play/${gameId}/match/${matchId}?playerID=${targetPlayerID}`;
                } else {
                    // 加入失败，重试
                    retryCount++;
                    if (retryCount < maxRetries) {
                        scheduleRetry(500);
                    } else {
                        // 最后再检查一次是否已有凭据
                        const finalStored = localStorage.getItem(`match_creds_${matchId}`);
                        if (finalStored) {
                            try {
                                const data = JSON.parse(finalStored);
                                if (data?.playerID) {
                                    window.location.href = `/play/${gameId}/match/${matchId}?playerID=${data.playerID}`;
                                    return;
                                }
                            } catch { }
                        }
                        safeSetIsAutoJoining(false);
                    }
                }
            } catch (err) {
                if (cancelled) return;
                // 出错也重试
                retryCount++;
                if (retryCount < maxRetries) {
                    scheduleRetry(500);
                } else {
                    // 最后再检查一次是否已有凭据
                    const finalStored = localStorage.getItem(`match_creds_${matchId}`);
                    if (finalStored) {
                        try {
                            const data = JSON.parse(finalStored);
                            if (data?.playerID) {
                                window.location.href = `/play/${gameId}/match/${matchId}?playerID=${data.playerID}`;
                                return;
                            }
                        } catch { }
                    }
                    safeSetIsAutoJoining(false);
                }
            }
        };

        // 延迟 1 秒，等待房主完全加入
        scheduleRetry(1000);

        return () => {
            cancelled = true;
            if (retryTimer !== undefined) {
                window.clearTimeout(retryTimer);
            }
        };
    }, [shouldAutoJoin, gameId, matchId, isTutorialRoute, isAutoJoining, t]);

    // 获取凭据
    const credentials = useMemo(() => {
        if (!matchId) return undefined;
        const resolvedPlayerID = urlPlayerID ?? storedPlayerID;
        if (!resolvedPlayerID) return undefined;
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (stored) {
            const data = JSON.parse(stored);
            if (data.playerID === resolvedPlayerID) {
                return data.credentials;
            }
        }
        return undefined;
    }, [matchId, urlPlayerID, storedPlayerID]);

    useEffect(() => {
        if (!matchId || !gameId) return;
        const stored = localStorage.getItem(`match_creds_${matchId}`);
        if (!stored) return;
        try {
            const data = JSON.parse(stored);
            if (data.gameName !== gameId) {
                persistMatchCredentials(matchId, {
                    ...data,
                    matchID: data.matchID || matchId,
                    gameName: gameId,
                });
            }
        } catch {
            return;
        }
    }, [gameId, matchId]);

    const tutorialPlayerID = debugPlayerID ?? urlPlayerID ?? '0';

    // 进入联机对局时，调试面板自动切换到自己对应的玩家视角
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!urlPlayerID) return;
        if (debugPlayerID === urlPlayerID) return;
        setPlayerID(urlPlayerID);
    }, [debugPlayerID, isTutorialRoute, setPlayerID, urlPlayerID]);

    // 联机对局始终使用地址中的玩家编号，缺失时回退到本地凭据
    const effectivePlayerID = isTutorialRoute
        ? tutorialPlayerID
        : (urlPlayerID ?? storedPlayerID ?? undefined);

    const statusPlayerID = isTutorialRoute
        ? (urlPlayerID ?? debugPlayerID ?? null)
        : (urlPlayerID ?? storedPlayerID ?? null);

    useEffect(() => {
        const handleStorage = () => setLocalStorageTick((t) => t + 1);
        const handleCredentialsChange = () => setLocalStorageTick((t) => t + 1);
        const handleOwnerActive = () => setLocalStorageTick((t) => t + 1);
        window.addEventListener('storage', handleStorage);
        window.addEventListener('match-credentials-changed', handleCredentialsChange);
        window.addEventListener('owner-active-match-changed', handleOwnerActive);

        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('match-credentials-changed', handleCredentialsChange);
            window.removeEventListener('owner-active-match-changed', handleOwnerActive);
        };
    }, []);

    useEffect(() => {
        if (isTutorialRoute) return;
        if (urlPlayerID || !storedPlayerID) return;
        if (spectateParam === '1' || spectateParam === 'true') return;
        if (!gameId || !matchId) return;
        navigate(`/play/${gameId}/match/${matchId}?playerID=${storedPlayerID}`, { replace: true });
    }, [gameId, matchId, navigate, spectateParam, storedPlayerID, urlPlayerID, isTutorialRoute]);

    // 使用房间状态钩子（以真实玩家身份为准）
    // 教程模式不需要房间状态检查
    const matchStatus = useMatchStatus(
        isTutorialRoute ? undefined : gameId,
        isTutorialRoute ? undefined : matchId,
        isTutorialRoute ? null : statusPlayerID
    );
    useEffect(() => {
        if (isTutorialRoute) return;
        if (!matchId || !statusPlayerID) return;
        if (matchStatus.isLoading || matchStatus.players.length === 0) return;

        const stored = readStoredMatchCredentials(matchId);
        const validation = validateStoredMatchSeat(stored, matchStatus.players, statusPlayerID);
        if (!validation.shouldClear) return;

        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        setLocalStorageTick((t) => t + 1);
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    }, [isTutorialRoute, matchId, statusPlayerID, matchStatus.isLoading, matchStatus.players, toast]);
    useEffect(() => {
        if (!isTutorialRoute) return;
        // 只有首次进入且当前未激活时才启动，避免结束后被再次拉起导致提示闪现
        if (!isActive && !tutorialStartedRef.current) {
            const impl = gameId ? GAME_IMPLEMENTATIONS[gameId] : null;
            if (impl?.tutorial) {
                console.warn(`[MatchRoom] startTutorial triggered isActive=${isActive} tutorialStarted=${tutorialStartedRef.current}`);
                // 延迟启动教程，等待 boardgame.io 客户端完全初始化
                const timer = setTimeout(() => {
                    startTutorial(impl.tutorial!);
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, [startTutorial, isTutorialRoute, isActive, gameId]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (isActive) {
            tutorialStartedRef.current = true;
        }
    }, [isTutorialRoute, isActive]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (currentStep?.id) {
            lastTutorialStepIdRef.current = currentStep.id;
        }
    }, [currentStep?.id, isTutorialRoute]);

    useEffect(() => {
        if (!isTutorialRoute) return;
        if (!tutorialStartedRef.current) return;

        // 教程模式下，部分游戏会在初始化/重置时短暂触发 tutorial.active=false。
        // 这里避免把"瞬间失活"误判为"教程已结束"，导致刚进入就 navigate(-1) 退回首页。
        if (!isActive) {
            console.warn(
                `[MatchRoom] tutorial inactive detected lastStepId=${lastTutorialStepIdRef.current} isTutorialRoute=${isTutorialRoute}`
            );
            const timer = window.setTimeout(() => {
                if (!tutorialStartedRef.current) return;
                // 二次确认仍未激活，且已进入完成步骤时才认为教程结束并返回。
                if (!isActive && lastTutorialStepIdRef.current === 'finish') {
                    console.warn('[MatchRoom] navigate(-1) triggered from finish step');
                    // 返回上一个路由（通常是带游戏参数的首页，会自动打开详情弹窗）
                    navigate(-1);
                }
            }, 600);
            return () => window.clearTimeout(timer);
        }
    }, [isTutorialRoute, isActive, navigate]);

    useEffect(() => {
        return () => {
            if (tutorialStartedRef.current) {
                closeTutorial();
            }
        };
    }, [closeTutorial]);

    useEffect(() => {
        // 关键约束：教程提示层只允许在 /tutorial 路由出现。
        // 否则如果某个联机对局状态中残留了 sys.tutorial.active=true（例如历史教程状态被持久化），
        // 就会在联机模式下误弹出教程提示。
        if (!isTutorialRoute) {
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
            // 联机/非教程路由下，不主动 closeTutorial()，避免在用户确实处于教程流程但路由切换瞬间被误关。
            return;
        }

        if (isActive && !tutorialModalIdRef.current) {
            tutorialModalIdRef.current = openModal({
                closeOnBackdrop: false,
                closeOnEsc: false,
                lockScroll: true,
                allowPointerThrough: true,
                onClose: () => {
                    tutorialModalIdRef.current = null;
                },
                render: () => <TutorialOverlay />,
            });
        }

        if (!isActive && tutorialModalIdRef.current) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }
    }, [closeModal, closeTutorial, isActive, isTutorialRoute, openModal]);

    const clearMatchLocalState = () => {
        if (!matchId) return;
        clearMatchCredentials(matchId);
        clearOwnerActiveMatch(matchId);
        // 关键：强制退出时，也要增加对当前房间的“主页活跃对局”抑制，
        // 确保即使在跨标签页同步延迟时，主页也能立即排除此房间。
        suppressOwnerActiveMatch(matchId);
    };

    const handleForceExitLocal = () => {
        clearMatchLocalState();
        navigateBackToLobby();
    };

    const openForceExitModal = () => {
        if (forceExitModalId) return;
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                setForceExitModalId(null);
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={t('matchRoom.destroy.forceExitTitle')}
                    description={t('matchRoom.destroy.forceExitDescription')}
                    confirmText={t('matchRoom.destroy.forceExitConfirm')}
                    onConfirm={() => {
                        close();
                        handleForceExitLocal();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        setForceExitModalId(modalId);
    };

    const navigateBackToLobby = () => {
        if (gameId) {
            navigate(`/?game=${gameId}`, { replace: true });
            return;
        }
        navigate('/', { replace: true });
    };

    // 离开房间处理 - 主动离开时释放座位（房主/非房主一致）
    const handleLeaveRoom = async () => {
        if (!matchId) {
            navigateBackToLobby();
            return;
        }

        // 观战 / 未绑定身份：直接返回大厅
        if (!statusPlayerID || !credentials) {
            navigateBackToLobby();
            return;
        }

        setIsLeaving(true);
        const ok = await leaveMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        setIsLeaving(false);
        if (!ok) {
            toast.error({ kind: 'i18n', key: 'matchRoom.leaveFailed', ns: 'lobby' });
            return;
        }
        navigateBackToLobby();
    };

    const handleConfirmDestroy = async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatus.isHost) {
            toast.warning({ kind: 'i18n', key: 'matchRoom.destroy.notAllowed', ns: 'lobby' });
            return;
        }

        setIsLeaving(true);
        const ok = await destroyMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        if (!ok) {
            // 关键：销毁失败时不要清理本地凭证，也不要跳转。
            // 否则会出现「后端房间仍存在 + 前端以为销毁了」的累加/脏数据问题。
            toast.error({ kind: 'i18n', key: 'matchRoom.destroy.failed', ns: 'lobby' });
            setIsLeaving(false);
            openForceExitModal();
            return;
        }

        clearMatchLocalState();
        navigateBackToLobby();
    };

    // 真正销毁房间（仅房主可用）
    const handleDestroyRoom = async () => {
        if (!matchId || !statusPlayerID || !credentials || !matchStatus.isHost) {
            if (!credentials) {
                toast.error({ kind: 'i18n', key: 'matchRoom.destroy.missingCredentials', ns: 'lobby' });
            }
            return;
        }

        if (destroyModalId) {
            closeModal(destroyModalId);
            setDestroyModalId(null);
        }
        const modalId = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                setDestroyModalId(null);
            },
            render: ({ close, closeOnBackdrop }) => (
                <ConfirmModal
                    title={t('matchRoom.destroy.title')}
                    description={t('matchRoom.destroy.description')}
                    onConfirm={() => {
                        close();
                        handleConfirmDestroy();
                    }}
                    onCancel={() => {
                        close();
                    }}
                    tone="cool"
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
        setDestroyModalId(modalId);
    };

    useEffect(() => {
        if (isTutorialRoute) {
            setShouldShowMatchError(false);
            return;
        }
        if (!matchStatus.error) {
            setShouldShowMatchError(false);
            return;
        }
        const timer = window.setTimeout(() => {
            setShouldShowMatchError(true);
        }, 4000);
        return () => window.clearTimeout(timer);
    }, [isTutorialRoute, matchStatus.error]);

    // 如果房间不存在，显示错误并自动跳转
    useEffect(() => {
        if (shouldShowMatchError) {
            console.warn(`[MatchRoom] shouldShowMatchError triggered navigate('/') isTutorialRoute=${isTutorialRoute}`);
            const timer = setTimeout(() => {
                navigate('/');
            }, 2500); // 2.5 秒后自动跳转

            return () => clearTimeout(timer);
        }
    }, [matchStatus.error, isTutorialRoute, navigate]);

    useEffect(() => {
        return () => {
            if (destroyModalId) {
                closeModal(destroyModalId);
                setDestroyModalId(null);
            }
            if (forceExitModalId) {
                closeModal(forceExitModalId);
                setForceExitModalId(null);
            }
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
        };
    }, [closeModal, destroyModalId, forceExitModalId]);

    useEffect(() => {
        if (!shouldShowMatchError) return;
        const key = `matchRoom.error.${gameId ?? 'unknown'}.${matchId ?? 'unknown'}`;
        const now = Date.now();
        const last = errorToastRef.current;
        if (last && last.key === key && now - last.timestamp < 3000) return;
        errorToastRef.current = { key, timestamp: now };
        toast.error(
            { kind: 'text', text: matchStatus.error ?? '房间不存在或已被删除' },
            { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
            { dedupeKey: key }
        );
    }, [gameId, matchId, shouldShowMatchError, toast]);

    if (!isGameNamespaceReady) {
        return <LoadingScreen description={t('matchRoom.loadingResources')} />;
    }

    // 自动加入过程中显示加载状态
    if (isAutoJoining || (shouldAutoJoin && !credentials)) {
        return <LoadingScreen description={t('matchRoom.joiningRoom')} />;
    }

    if (shouldShowMatchError) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <div className="text-center">
                    <div className="text-white/60 text-lg mb-4">{matchStatus.error}</div>
                    <div className="text-white/40 text-sm mb-6 animate-pulse">{t('matchRoom.redirecting')}</div>
                    <button
                        onClick={() => navigate('/')}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                        {t('matchRoom.returnHome')}
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
            <SEO
                title={isTutorialRoute
                    ? t('matchRoom.tutorialTitle', { game: gameId ? t(`common:game_names.${gameId}`, { ns: 'common' }) : '' })
                    : t('matchRoom.matchTitle', { game: gameId ? t(`common:game_names.${gameId}`, { ns: 'common' }) : '' })}
                ogType="game"
            />
            {/* 统一的游戏 HUD */}
            <GameHUD
                mode={isTutorialRoute ? 'tutorial' : 'online'}
                matchId={matchId}
                gameId={gameId}
                isHost={matchStatus.isHost}
                credentials={credentials}
                myPlayerId={effectivePlayerID}
                opponentName={matchStatus.opponentName}
                opponentConnected={matchStatus.opponentConnected}
                players={matchStatus.players}
                onLeave={handleLeaveRoom}
                onDestroy={handleDestroyRoom}
                onForceExit={handleForceExitLocal}
                isLoading={isLeaving}
            />

            {isSpectatorRoute && !isTutorialRoute && (
                <div
                    className="absolute inset-0 z-[1500] bg-transparent pointer-events-auto"
                    aria-hidden="true"
                />
            )}

            {/* 游戏棋盘 - 全屏 */}
            <div className={`w-full h-full ${isUgcGame ? 'ugc-preview-container' : ''}`}>
                {isTutorialRoute ? (
                    <GameModeProvider mode="tutorial">
                        {TutorialClient ? <TutorialClient playerID={tutorialPlayerID} /> : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">
                                {t('matchRoom.noTutorial')}
                            </div>
                        )}
                    </GameModeProvider>
                ) : (
                    isUgcGame && ugcLoading ? (
                        <LoadingScreen fullScreen={false} description="UGC 运行态加载中…" />
                    ) : isUgcGame && ugcError ? (
                        <div className="w-full h-full flex items-center justify-center text-red-300 text-sm">
                            {`UGC 运行态加载失败: ${ugcError}`}
                        </div>
                    ) : ResolvedGameClient ? (
                        <GameModeProvider mode="online" isSpectator={isSpectatorRoute}>
                            <RematchProvider
                                matchId={matchId}
                                playerId={effectivePlayerID ?? undefined}
                                isMultiplayer={true}
                            >
                                <ResolvedGameClient
                                    key={`${matchId}-${isSpectatorRoute ? 'spectate' : (effectivePlayerID ?? 'player')}`}
                                    playerID={isSpectatorRoute ? undefined : (effectivePlayerID ?? undefined)}
                                    matchID={matchId}
                                    credentials={credentials}
                                />
                            </RematchProvider>
                        </GameModeProvider>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/50">
                            {t('matchRoom.noClient')}
                        </div>
                    )
                )}
            </div>

        </div>
    );
};
