import { useEffect, useState, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Client } from 'boardgame.io/react';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_IMPLEMENTATIONS } from '../games/registry';
import { useDebug } from '../contexts/DebugContext';
import { TutorialOverlay } from '../components/tutorial/TutorialOverlay';
import { useTutorial } from '../contexts/TutorialContext';
import { RematchProvider } from '../contexts/RematchContext';
import { useMatchStatus, destroyMatch, leaveMatch, rejoinMatch, persistMatchCredentials } from '../hooks/match/useMatchStatus';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { useModalStack } from '../contexts/ModalStackContext';
import { useToast } from '../contexts/ToastContext';
import { SocketIO } from 'boardgame.io/multiplayer';
import { GAME_SERVER_URL } from '../config/server';
import { GameHUD } from '../components/game/GameHUD';
import { GameModeProvider } from '../contexts/GameModeContext';


export const MatchRoom = () => {
    const { playerID: debugPlayerID, setPlayerID } = useDebug();
    const { gameId, matchId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { startTutorial, closeTutorial, isActive } = useTutorial();
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const { t, i18n } = useTranslation('lobby');

    const GameClient = useMemo(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        const impl = GAME_IMPLEMENTATIONS[gameId];

        // boardgame.io's SocketIO transport connects via socket.io (`/socket.io`).
        // In dev we rely on Vite proxy to forward `/socket.io` to the game-server.
        return Client({
            game: impl.game,
            board: impl.board,
            debug: false,
            multiplayer: SocketIO({ server: GAME_SERVER_URL }),
        });
    }, [gameId]);

    const TutorialClient = useMemo(() => {
        if (!gameId || !GAME_IMPLEMENTATIONS[gameId]) return null;
        const impl = GAME_IMPLEMENTATIONS[gameId];
        return Client({
            game: impl.game,
            board: impl.board,
            debug: false,
            numPlayers: 2,
        }) as React.ComponentType<{ playerID?: string | null }>;
    }, [gameId]);

    const [isLeaving, setIsLeaving] = useState(false);
    const [isGameNamespaceReady, setIsGameNamespaceReady] = useState(true);
    const [autoExitMessage, setAutoExitMessage] = useState<string | null>(null);
    const [destroyModalId, setDestroyModalId] = useState<string | null>(null);
    const tutorialStartedRef = useRef(false);
    const autoExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const autoExitModalIdRef = useRef<string | null>(null);
    const tutorialModalIdRef = useRef<string | null>(null);
    const errorToastRef = useRef<{ key: string; timestamp: number } | null>(null);

    const isTutorialRoute = window.location.pathname.endsWith('/tutorial');

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

    // 从 URL 查询参数中获取 playerID
    const urlPlayerID = searchParams.get('playerID');
    const shouldAutoJoin = searchParams.get('join') === 'true';
    const spectateParam = searchParams.get('spectate');
    const isSpectatorRoute = !isTutorialRoute && !shouldAutoJoin && !urlPlayerID && (spectateParam === null || spectateParam === '1' || spectateParam === 'true');
    useEffect(() => {
        if (!import.meta.env.DEV) return;
        console.info('[Spectate][MatchRoom]', {
            gameId,
            matchId,
            urlPlayerID,
            shouldAutoJoin,
            spectateParam,
            isSpectatorRoute,
            href: window.location.href,
        });
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

        setIsAutoJoining(true);
        const guestId = localStorage.getItem('guest_id') || String(Math.floor(Math.random() * 9000) + 1000);
        if (!localStorage.getItem('guest_id')) {
            localStorage.setItem('guest_id', guestId);
        }
        const playerName = t('player.guest', { id: guestId, ns: 'lobby' });

        // 先查询房间状态，找到可用位置（带重试）
        const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });
        let retryCount = 0;
        const maxRetries = 5;
        
        const tryJoin = async () => {
            try {
                const matchInfo = await lobbyClient.getMatch(gameId, matchId);
                const player0 = matchInfo.players.find(p => p.id === 0);
                const player1 = matchInfo.players.find(p => p.id === 1);
                // 找一个空位
                let targetPlayerID = '';
                if (!player1?.name) targetPlayerID = '1';
                else if (!player0?.name) targetPlayerID = '0';
                else {
                    setIsAutoJoining(false);
                    return;
                }
                const { success } = await rejoinMatch(gameId, matchId, targetPlayerID, playerName);
                if (success) {
                    window.location.href = `/play/${gameId}/match/${matchId}?playerID=${targetPlayerID}`;
                } else {
                    // 加入失败，重试
                    retryCount++;
                    if (retryCount < maxRetries) {
                        setTimeout(tryJoin, 500);
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
                            } catch {}
                        }
                        setIsAutoJoining(false);
                    }
                }
            } catch (err) {
                // 出错也重试
                retryCount++;
                if (retryCount < maxRetries) {
                    setTimeout(tryJoin, 500);
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
                        } catch {}
                    }
                    setIsAutoJoining(false);
                }
            }
        };
        
        // 延迟 1 秒，等待房主完全加入
        setTimeout(tryJoin, 1000);
    }, [shouldAutoJoin, gameId, matchId, isTutorialRoute, isAutoJoining, t]);

    // 获取凭据 (Credentials)
    const credentials = useMemo(() => {
        if (matchId && urlPlayerID) {
            const stored = localStorage.getItem(`match_creds_${matchId}`);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.playerID === urlPlayerID) {
                    return data.credentials;
                }
            }
        }
        return undefined;
    }, [matchId, urlPlayerID]);

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

    // 联机对局优先使用 URL playerID，避免调试默认值覆盖真实身份
    const effectivePlayerID = (isActive || isTutorialRoute)
        ? tutorialPlayerID
        : (urlPlayerID ?? undefined);

    const statusPlayerID = isTutorialRoute
        ? (urlPlayerID ?? debugPlayerID ?? null)
        : (urlPlayerID ?? null);

    // 使用房间状态 Hook（以真实玩家身份为准）
    const matchStatus = useMatchStatus(gameId, matchId, statusPlayerID);
    const hostSlot = matchStatus.players.find(player => player.id === 0);

    useEffect(() => {
        if (!isTutorialRoute) return;
        // 只有当前未激活时才启动，避免重复渲染导致的循环/重置
        if (!isActive) {
            const impl = gameId ? GAME_IMPLEMENTATIONS[gameId] : null;
            if (impl?.tutorial) {
                startTutorial(impl.tutorial);
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
        if (!tutorialStartedRef.current) return;
        if (!isActive) {
            // 返回上一个路由（通常是带游戏参数的首页，会自动打开详情弹窗）
            navigate(-1);
        }
    }, [isTutorialRoute, isActive, navigate]);

    useEffect(() => {
        return () => {
            if (isActive) {
                closeTutorial();
            }
        };
    }, [closeTutorial, isActive]);

    useEffect(() => {
        if (isActive && !tutorialModalIdRef.current) {
            tutorialModalIdRef.current = openModal({
                closeOnBackdrop: false,
                closeOnEsc: true,
                lockScroll: true,
                onClose: () => {
                    tutorialModalIdRef.current = null;
                    closeTutorial();
                },
                render: () => <TutorialOverlay />,
            });
        }

        if (!isActive && tutorialModalIdRef.current) {
            closeModal(tutorialModalIdRef.current);
            tutorialModalIdRef.current = null;
        }
    }, [closeModal, closeTutorial, isActive, openModal]);

    const clearMatchCredentials = () => {
        if (matchId) {
            localStorage.removeItem(`match_creds_${matchId}`);
        }
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
            return;
        }

        clearMatchCredentials();
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
                    open
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

    // 如果房间不存在，显示错误并自动跳转
    useEffect(() => {
        if (matchStatus.error && !isTutorialRoute) {
            const timer = setTimeout(() => {
                navigate('/');
            }, 2500); // 2.5 秒后自动跳转

            return () => clearTimeout(timer);
        }
    }, [matchStatus.error, isTutorialRoute, navigate]);

    // 房主销毁/离开导致座位清空时，非房主自动退出
    useEffect(() => {
        if (isTutorialRoute) return;
        if (matchStatus.isLoading) return;
        if (matchStatus.isHost) return;
        if (!hostSlot || hostSlot.name) return;
        if (autoExitMessage) return;

        clearMatchCredentials();
        if (matchId && statusPlayerID && credentials) {
            void leaveMatch(gameId || 'tictactoe', matchId, statusPlayerID, credentials);
        }
        setAutoExitMessage(t('matchRoom.autoExit.message'));
        autoExitTimerRef.current = setTimeout(() => {
            navigate('/');
        }, 1600);

        return () => {
            if (autoExitTimerRef.current) {
                clearTimeout(autoExitTimerRef.current);
                autoExitTimerRef.current = null;
            }
        };
    }, [autoExitMessage, clearMatchCredentials, credentials, hostSlot, matchId, matchStatus.isHost, matchStatus.isLoading, isTutorialRoute, navigate, statusPlayerID]);

    useEffect(() => {
        if (autoExitMessage && !isTutorialRoute && !autoExitModalIdRef.current) {
            autoExitModalIdRef.current = openModal({
                closeOnBackdrop: false,
                closeOnEsc: false,
                lockScroll: true,
                onClose: () => {
                    autoExitModalIdRef.current = null;
                },
                render: ({ close, closeOnBackdrop }) => (
                    <ConfirmModal
                        open
                        title={t('matchRoom.autoExit.title')}
                        description={autoExitMessage}
                        confirmText={t('matchRoom.autoExit.confirm')}
                        showCancel={false}
                        onConfirm={() => {
                            close();
                            navigate('/');
                        }}
                        onCancel={() => {
                            close();
                        }}
                        tone="cool"
                        panelClassName="bg-black/70 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] font-sans"
                        titleClassName="text-white/80 text-sm font-semibold tracking-wide"
                        descriptionClassName="text-white/70 text-base"
                        actionsClassName="justify-center"
                        confirmClassName="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-white/10 text-white/80 hover:bg-white/20 rounded-full"
                        closeOnBackdrop={closeOnBackdrop}
                    />
                ),
            });
        }

        if ((!autoExitMessage || isTutorialRoute) && autoExitModalIdRef.current) {
            closeModal(autoExitModalIdRef.current);
            autoExitModalIdRef.current = null;
        }
    }, [autoExitMessage, closeModal, isTutorialRoute, navigate, openModal]);

    useEffect(() => {
        return () => {
            if (autoExitModalIdRef.current) {
                closeModal(autoExitModalIdRef.current);
                autoExitModalIdRef.current = null;
            }
            if (destroyModalId) {
                closeModal(destroyModalId);
                setDestroyModalId(null);
            }
            if (tutorialModalIdRef.current) {
                closeModal(tutorialModalIdRef.current);
                tutorialModalIdRef.current = null;
            }
        };
    }, [closeModal, destroyModalId]);

    useEffect(() => {
        if (!matchStatus.error || isTutorialRoute) return;
        const key = `matchRoom.error.${gameId ?? 'unknown'}.${matchId ?? 'unknown'}`;
        const now = Date.now();
        const last = errorToastRef.current;
        if (last && last.key === key && now - last.timestamp < 3000) return;
        errorToastRef.current = { key, timestamp: now };
        toast.error(
            { kind: 'text', text: matchStatus.error },
            { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
            { dedupeKey: key }
        );
    }, [gameId, isTutorialRoute, matchId, matchStatus.error, toast]);

    if (!isGameNamespaceReady) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <div className="text-white/70 text-sm">正在加载对局资源...</div>
            </div>
        );
    }

    // 自动加入过程中显示加载状态
    if (isAutoJoining || (shouldAutoJoin && !credentials)) {
        return (
            <div className="w-full h-screen bg-black flex items-center justify-center">
                <div className="text-white/70 text-sm">正在加入房间...</div>
            </div>
        );
    }

    if (matchStatus.error && !isTutorialRoute) {
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
                isLoading={isLeaving}
            />

            {isSpectatorRoute && !isTutorialRoute && (
                <div
                    className="absolute inset-0 z-[1500] bg-transparent pointer-events-auto"
                    aria-hidden="true"
                />
            )}

            {/* 游戏棋盘 - 全屏 */}
            <div className="w-full h-full">
                {isTutorialRoute ? (
                    <GameModeProvider mode="tutorial">
                        {TutorialClient ? <TutorialClient playerID={null} /> : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">
                                {t('matchRoom.noTutorial')}
                            </div>
                        )}
                    </GameModeProvider>
                ) : (
                    GameClient ? (
                        <GameModeProvider mode="online" isSpectator={isSpectatorRoute}>
                            <RematchProvider
                                matchId={matchId}
                                playerId={urlPlayerID ?? undefined}
                                isMultiplayer={true}
                            >
                                <GameClient
                                    key={`${matchId}-${isSpectatorRoute ? 'spectate' : (effectivePlayerID ?? 'player')}`}
                                    playerID={isSpectatorRoute ? null : (effectivePlayerID ?? null)}
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
