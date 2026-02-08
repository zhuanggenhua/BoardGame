import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CategoryPills, type Category } from '../components/layout/CategoryPills';
import { GameDetailsModal } from '../components/lobby/GameDetailsModal';
import { GameList } from '../components/lobby/GameList';
import { getGamesByCategory, getGameById, refreshUgcGames, subscribeGameRegistry } from '../config/games.config';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';
import { EmailBindModal } from '../components/auth/EmailBindModal';
import { useNavigate } from 'react-router-dom';
import { claimSeat, clearMatchCredentials, exitMatch, getOwnerActiveMatch, clearOwnerActiveMatch, rejoinMatch, getLatestStoredMatchCredentials, pruneStoredMatchCredentials } from '../hooks/match/useMatchStatus';
import { getOrCreateGuestId, getGuestName as resolveGuestName, getOwnerKey as resolveOwnerKey } from '../hooks/match/ownerIdentity';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { LanguageSwitcher } from '../components/common/i18n/LanguageSwitcher';
import { UserMenu } from '../components/social/UserMenu';
import { useModalStack } from '../contexts/ModalStackContext';
import { useToast } from '../contexts/ToastContext';
import { useUrlModal } from '../hooks/routing/useUrlModal';
import clsx from 'clsx';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_SERVER_URL } from '../config/server';
import { SEO } from '../components/common/SEO';
import { useLobbyStats } from '../hooks/useLobbyStats';

const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });

export const Home = () => {
    const [activeCategory, setActiveCategory] = useState<Category>('All');
    const [, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const [registryVersion, setRegistryVersion] = useState(0);

    // 活跃对局状态
    const [activeMatch, setActiveMatch] = useState<{ matchID: string; gameName: string; players: Array<{ id: number; name?: string; isConnected?: boolean }> } | null>(null);
    const [myMatchRole, setMyMatchRole] = useState<{ playerID: string; credentials?: string; gameName?: string } | null>(null);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const [pendingAction, setPendingAction] = useState<{
        matchID: string;
        playerID: string;
        credentials: string;
        isHost: boolean;
    } | null>(null);

    // Monitoring & Stats
    const { mostPopularGameId } = useLobbyStats();

    const { user, token, logout } = useAuth();
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const { t } = useTranslation(['lobby', 'auth']);
    const filteredGames = useMemo(() => getGamesByCategory(activeCategory), [activeCategory, registryVersion]);
    const activePlayerCount = activeMatch?.players.filter(player => player.name).length ?? 0;

    const confirmModalIdRef = useRef<string | null>(null);
    const authModalIdRef = useRef<string | null>(null);
    const emailBindModalIdRef = useRef<string | null>(null);

    const { navigateAwayRef: gameModalNavigateAwayRef } = useUrlModal({
        paramKey: 'game',
        getModalConfig: useCallback((gameId: string) => {
            const game = getGameById(gameId);
            if (!game) return null;
            return {
                render: ({ close, closeOnBackdrop }: { close: () => void; closeOnBackdrop: boolean }) => (
                    <GameDetailsModal
                        isOpen
                        onClose={close}
                        gameId={game.id}
                        titleKey={game.titleKey}
                        descriptionKey={game.descriptionKey}
                        thumbnail={game.thumbnail}
                        closeOnBackdrop={closeOnBackdrop}
                        onNavigate={() => gameModalNavigateAwayRef.current()}
                    />
                ),
            };
        }, []),
    });

    useEffect(() => {
        const unsubscribe = subscribeGameRegistry(() => {
            setRegistryVersion((version) => version + 1);
        });
        void refreshUgcGames();
        return () => {
            unsubscribe();
        };
    }, []);

    const handleGameClick = (id: string) => {
        if (id === 'assetslicer') {
            navigate('/dev/slicer');
            return;
        }
        if (id === 'fxpreview') {
            navigate('/dev/fx');
            return;
        }
        if (id === 'audiobrowser') {
            navigate('/dev/audio');
            return;
        }
        if (id === 'ugcbuilder') {
            navigate('/dev/ugc');
            return;
        }
        setSearchParams({ game: id });
    };

    const getGuestId = () => getOrCreateGuestId();
    const getGuestName = () => resolveGuestName(t, getGuestId());

    const handleLogout = () => {
        logout();
    };

    const openAuth = (mode: 'login' | 'register') => {
        if (authModalIdRef.current) {
            closeModal(authModalIdRef.current);
            authModalIdRef.current = null;
        }
        authModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                authModalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <AuthModal
                    isOpen
                    onClose={() => {
                        close();
                    }}
                    initialMode={mode}
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
    };

    const openEmailBind = () => {
        if (emailBindModalIdRef.current) {
            closeModal(emailBindModalIdRef.current);
            emailBindModalIdRef.current = null;
        }
        emailBindModalIdRef.current = openModal({
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                emailBindModalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <EmailBindModal
                    isOpen
                    onClose={() => {
                        close();
                    }}
                    closeOnBackdrop={closeOnBackdrop}
                />
            ),
        });
    };

    // 检查是否有活跃对局（基于本地存储，跨游戏）
    useEffect(() => {
        const handleStorage = () => setLocalStorageTick(t => t + 1);
        const handleCredentialsChange = () => setLocalStorageTick(t => t + 1);
        const handleOwnerActive = () => setLocalStorageTick(t => t + 1);
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
        let cancelled = false;

        const findLocalMatch = () => {
            const latestCreds = getLatestStoredMatchCredentials();
            if (latestCreds?.matchID) {
                const gameName = latestCreds.gameName || 'tictactoe';
                return {
                    matchID: latestCreds.matchID,
                    playerID: latestCreds.playerID as string,
                    credentials: latestCreds.credentials as string | undefined,
                    gameName: gameName as string,
                };
            }
            const ownerActive = getOwnerActiveMatch();
            const ownerKey = resolveOwnerKey(user?.id, getGuestId());
            if (ownerActive?.matchID && (!ownerActive.ownerKey || ownerActive.ownerKey === ownerKey)) {
                return {
                    matchID: ownerActive.matchID,
                    playerID: '0',
                    credentials: undefined,
                    gameName: ownerActive.gameName,
                };
            }
            return null;
        };
        pruneStoredMatchCredentials();

        const local = findLocalMatch();
        if (!local) {
            setActiveMatch(null);
            setMyMatchRole(null);
            return;
        }

        setMyMatchRole({
            playerID: local.playerID,
            credentials: local.credentials,
            gameName: local.gameName,
        });

        void lobbyClient.getMatch(local.gameName, local.matchID)
            .then(match => {
                if (cancelled) return;
                setActiveMatch({
                    matchID: local.matchID,
                    gameName: local.gameName,
                    players: match.players.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        isConnected: p.isConnected,
                    })),
                });
            })
            .catch((err) => {
                if (cancelled) return;
                const status = (err as { status?: number }).status;
                const message = (err as { message?: string }).message ?? '';
                if (status === 404 || message.includes('404')) {
                    // 房间已不存在，清理本地凭证避免重复请求
                    clearMatchCredentials(local.matchID);
                    clearOwnerActiveMatch(local.matchID);
                    setActiveMatch(null);
                    setMyMatchRole(null);
                    setLocalStorageTick((t) => t + 1);
                    return;
                }
                setActiveMatch({
                    matchID: local.matchID,
                    gameName: local.gameName,
                    players: [],
                });
            });

        return () => {
            cancelled = true;
        };
    }, [localStorageTick, user]);

    const handleReconnect = () => {
        if (!activeMatch || !myMatchRole) return;

        // 优先使用 myMatchRole 中保存的游戏名，否则回退到 activeMatch 中的游戏名，最后默认 tictactoe
        const gameId = myMatchRole.gameName || activeMatch.gameName || 'tictactoe';

        console.log(
            `[Home] action=reconnect matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID} hasCred=${!!myMatchRole.credentials} gameName=${gameId} userId=${user?.id ?? ''}`
        );

        // 有凭证：直接进入
        if (myMatchRole.credentials) {
            navigate(`/play/${gameId}/match/${activeMatch.matchID}?playerID=${myMatchRole.playerID}`);
            return;
        }

        // 无凭证：登录用户优先走席位认领回归
        void (async () => {
            try {
                if (user?.id && token) {
                    console.log(
                        `[Home] action=claim-seat-start matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID || '0'} userId=${user.id} gameName=${gameId}`
                    );
                    const { success, credentials } = await claimSeat(
                        gameId,
                        activeMatch.matchID,
                        myMatchRole.playerID || '0',
                        { token, playerName: user.username }
                    );
                    if (success) {
                        console.log(
                            `[Home] action=claim-seat-success matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID || '0'} userId=${user.id}`
                        );
                        setMyMatchRole((prev) => (prev ? { ...prev, credentials } : prev));
                        setLocalStorageTick((t) => t + 1);
                        navigate(`/play/${gameId}/match/${activeMatch.matchID}?playerID=${myMatchRole.playerID}`);
                        return;
                    }
                    console.warn(
                        `[Home] action=claim-seat-failed matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID || '0'} userId=${user.id}`
                    );
                } else {
                    const guestId = getGuestId();
                    const guestName = getGuestName();
                    console.log(
                        `[Home] action=claim-seat-guest-start matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID || '0'} guestId=${guestId} gameName=${gameId}`
                    );
                    const { success, credentials } = await claimSeat(
                        gameId,
                        activeMatch.matchID,
                        myMatchRole.playerID || '0',
                        { guestId, playerName: guestName }
                    );
                    if (success) {
                        console.log(
                            `[Home] action=claim-seat-guest-success matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID || '0'} guestId=${guestId}`
                        );
                        setMyMatchRole((prev) => (prev ? { ...prev, credentials } : prev));
                        setLocalStorageTick((t) => t + 1);
                        navigate(`/play/${gameId}/match/${activeMatch.matchID}?playerID=${myMatchRole.playerID}`);
                        return;
                    }
                    console.warn(
                        `[Home] action=claim-seat-guest-failed matchID=${activeMatch.matchID} playerID=${myMatchRole.playerID || '0'} guestId=${guestId}`
                    );
                }

                // 无凭证：尝试重新加入空位
                const matchInfo = await lobbyClient.getMatch(gameId, activeMatch.matchID);
                const player0 = matchInfo.players.find(p => p.id === 0);
                const player1 = matchInfo.players.find(p => p.id === 1);
                let targetPlayerID = '';
                if (!player0?.name) targetPlayerID = '0';
                else if (!player1?.name) targetPlayerID = '1';
                else return;

                const playerName = user?.username || getGuestName();
                const guestId = user?.id ? undefined : getGuestId();
                const { success } = await rejoinMatch(gameId, activeMatch.matchID, targetPlayerID, playerName, { guestId });
                if (success) {
                    navigate(`/play/${gameId}/match/${activeMatch.matchID}?playerID=${targetPlayerID}`);
                }
            } catch {
                // 忽略错误
            }
        })();
    };

    const handleDestroyOrLeave = async () => {
        if (!activeMatch || !myMatchRole) return;

        const { playerID, credentials } = myMatchRole;
        let effectiveCredentials = credentials;

        if (!effectiveCredentials) {
            return;
        }

        const isHost = playerID === '0';
        setPendingAction({
            matchID: activeMatch.matchID,
            playerID,
            credentials: effectiveCredentials,
            isHost,
        });
    };

    const handleConfirmAction = useCallback(async () => {
        if (!pendingAction) return;

        let gameName = 'tictactoe';
        // 尝试获取正确的游戏名
        if (myMatchRole && myMatchRole.gameName) {
            gameName = myMatchRole.gameName;
        } else if (activeMatch && activeMatch.gameName) {
            gameName = activeMatch.gameName;
        }

        const result = await exitMatch(
            gameName,
            pendingAction.matchID,
            pendingAction.playerID,
            pendingAction.credentials,
            pendingAction.isHost
        );
        if (!result.success) {
            const errorKey = result.error === 'forbidden'
                ? 'error.destroyForbidden'
                : result.error === 'network'
                    ? 'error.destroyNetwork'
                    : 'error.actionFailed';
            toast.error({ kind: 'i18n', key: errorKey, ns: 'lobby' });
            return;
        }

        if (result.cleanedLocal) {
            toast.warning({ kind: 'i18n', key: 'error.destroyFailedLocalCleaned', ns: 'lobby' });
        }

        // 成功后后端释放座位，本地状态同步更新
        clearMatchCredentials(pendingAction.matchID);
        clearOwnerActiveMatch(pendingAction.matchID);
        setPendingAction(null);
        setLocalStorageTick(t => t + 1);
    }, [activeMatch, myMatchRole, pendingAction]);

    const handleCancelAction = useCallback(() => {
        setPendingAction(null);
    }, []);

    useEffect(() => {
        if (pendingAction && !confirmModalIdRef.current) {
            confirmModalIdRef.current = openModal({
                closeOnBackdrop: true,
                closeOnEsc: true,
                lockScroll: true,
                onClose: () => {
                    handleCancelAction();
                    confirmModalIdRef.current = null;
                },
                render: ({ close, closeOnBackdrop }) => (
                    <ConfirmModal
                        title={pendingAction.isHost ? t('lobby:confirm.destroy.title') : t('lobby:confirm.leave.title')}
                        description={pendingAction.isHost ? t('lobby:confirm.destroy.description') : t('lobby:confirm.leave.description')}
                        onConfirm={() => {
                            handleConfirmAction();
                        }}
                        onCancel={() => {
                            close();
                        }}
                        tone="warm"
                        closeOnBackdrop={closeOnBackdrop}
                    />
                ),
            });
        }

        if (!pendingAction && confirmModalIdRef.current) {
            closeModal(confirmModalIdRef.current);
            confirmModalIdRef.current = null;
        }
    }, [closeModal, handleCancelAction, handleConfirmAction, openModal, pendingAction]);

    return (
        <div className="min-h-screen bg-parchment-base-bg text-parchment-base-text font-serif overflow-y-scroll flex flex-col items-center">
            <SEO
                title={activeCategory === 'All' ? undefined : t(`common:category.${activeCategory}`)}
                description={t('lobby:home.subtitle')}
            />
            <header className="w-full relative px-6 md:px-12 pt-5 md:pt-8 pb-1">
                {/* 顶级操作区域 - 改为标准导航条逻辑，中大屏锁定右侧，小屏居中 */}
                <div className="md:absolute md:top-8 md:right-12 flex items-center justify-center md:justify-end gap-4 mb-4 md:mb-0">
                    {user ? (
                        <UserMenu onLogout={handleLogout} onBindEmail={openEmailBind} />
                    ) : (
                        <div className="flex items-center gap-6">
                            <button onClick={() => openAuth('login')} className="group relative hover:text-[#2c2216] cursor-pointer font-bold text-sm tracking-wider py-1">
                                {t('auth:menu.login')}
                                <span className="underline-center" />
                            </button>
                            <div className="w-[1px] h-3 bg-parchment-light-text/30" />
                            <button onClick={() => openAuth('register')} className="group relative hover:text-[#2c2216] cursor-pointer font-bold text-sm tracking-wider py-1">
                                {t('auth:menu.register')}
                                <span className="underline-center" />
                            </button>
                        </div>
                    )}
                    <LanguageSwitcher />
                </div>

                {/* 居中大标题 - 极简布局，Logo作为标题点缀 */}
                <div className="flex flex-col items-center justify-center mb-4">
                    {/* 标题行：Logo + H1 */}
                    <div className="flex items-center justify-center gap-3 md:gap-4 mb-2">
                        <img
                            src="/logos/logo_1_grid.svg"
                            alt="logo"
                            className="w-8 md:w-10 opacity-90"
                        />
                        <h1 className="text-[clamp(1.75rem,4vw,2.5rem)] font-bold tracking-[0.1em] text-parchment-base-text leading-none pt-1">
                            {t('lobby:home.title')}
                        </h1>
                    </div>

                    {/* 副标题 */}
                    <p className="text-[10px] md:text-sm text-parchment-light-text tracking-[0.2em] font-bold uppercase opacity-80">
                        {t('lobby:home.subtitle')}
                    </p>
                </div>
            </header>

            {/* 主内容区域 - 商业级容器限制 */}
            <main className="w-full max-w-7xl flex flex-col items-center pt-0 px-6 md:px-8">
                {/* 分类筛选 */}
                <nav className="mb-6 w-full">
                    <CategoryPills activeCategory={activeCategory} onSelect={setActiveCategory} />
                </nav>

                {/* 游戏列表 */}
                <section className="w-full pb-20">
                    <GameList games={filteredGames} onGameClick={handleGameClick} mostPopularGameId={mostPopularGameId} />
                </section>
            </main>

            {/* 活跃对局指示器 */}
            {activeMatch && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="bg-parchment-base-text text-parchment-card-bg px-6 py-3 rounded shadow-xl border border-parchment-brown flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-parchment-light-text uppercase tracking-wider font-bold">{t('lobby:home.activeMatch.status')}</span>
                            <span className="text-sm font-bold">
                                {t('lobby:home.activeMatch.room', { id: activeMatch.matchID.slice(0, 4) })}
                                <span className="mx-2 opacity-50">|</span>
                                <span className={activeMatch.players.some(p => p.name) ? 'opacity-100' : 'opacity-50 italic'}>
                                    {t('lobby:home.activeMatch.players', { count: activePlayerCount })}
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {myMatchRole?.credentials && (
                                <button
                                    onClick={handleDestroyOrLeave}
                                    className={clsx(
                                        "px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border",
                                        myMatchRole.playerID === '0'
                                            ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                            : "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                                    )}
                                >
                                    {myMatchRole.playerID === '0' ? t('lobby:actions.destroy') : t('lobby:actions.leave')}
                                </button>
                            )}
                            <button
                                onClick={handleReconnect}
                                className="bg-parchment-light-text hover:bg-[#a08060] text-white px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm border border-parchment-light-text"
                            >
                                {t('lobby:actions.reconnectEnter')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
