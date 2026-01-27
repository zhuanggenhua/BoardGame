import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CategoryPills, type Category } from '../components/layout/CategoryPills';
import { GameDetailsModal } from '../components/lobby/GameDetailsModal';
import { GameList } from '../components/lobby/GameList';
import { getGamesByCategory, getGameById } from '../config/games.config';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';
import { EmailBindModal } from '../components/auth/EmailBindModal';
import { useNavigate } from 'react-router-dom';
import { clearMatchCredentials, exitMatch, getOwnerActiveMatch, clearOwnerActiveMatch, rejoinMatch, getLatestStoredMatchCredentials, pruneStoredMatchCredentials } from '../hooks/match/useMatchStatus';
import { ConfirmModal } from '../components/common/overlays/ConfirmModal';
import { LanguageSwitcher } from '../components/common/i18n/LanguageSwitcher';
import { UserMenu } from '../components/social/UserMenu';
import { useModalStack } from '../contexts/ModalStackContext';
import { useUrlModal } from '../hooks/routing/useUrlModal';
import clsx from 'clsx';
import { LobbyClient } from 'boardgame.io/client';
import { GAME_SERVER_URL } from '../config/server';

const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });

export const Home = () => {
    const [activeCategory, setActiveCategory] = useState<Category>('All');
    const [, setSearchParams] = useSearchParams();
    const navigate = useNavigate();

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

    const { user, logout } = useAuth();
    const { openModal, closeModal } = useModalStack();
    const { t } = useTranslation(['lobby', 'auth']);
    const filteredGames = useMemo(() => getGamesByCategory(activeCategory), [activeCategory]);
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

    const handleGameClick = (id: string) => {
        if (id === 'assetslicer') {
            navigate('/dev/slicer');
            return;
        }
        setSearchParams({ game: id });
    };

    const getGuestId = () => {
        const key = 'guest_id';
        const stored = localStorage.getItem(key);
        if (stored) return stored;
        const id = String(Math.floor(Math.random() * 9000) + 1000);
        localStorage.setItem(key, id);
        return id;
    };

    const getGuestName = () => t('lobby:player.guest', { id: getGuestId() });

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

    // 检查是否有活跃对局（基于 localStorage，跨游戏）
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
            if (ownerActive?.matchID && (!ownerActive.ownerKey || ownerActive.ownerKey === (user?.id ? `user:${user.id}` : `guest:${localStorage.getItem('guest_id') || ''}`))) {
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

        // 优先使用 myMatchRole 中保存的 gameName，否则回退到 activeMatch 中的 gameName，最后默认 tictactoe
        const gameId = myMatchRole.gameName || activeMatch.gameName || 'tictactoe';

        // 有凭证：直接进入
        if (myMatchRole.credentials) {
            navigate(`/play/${gameId}/match/${activeMatch.matchID}?playerID=${myMatchRole.playerID}`);
            return;
        }

        // 无凭证：尝试重新加入空位
        void (async () => {
            try {
                const matchInfo = await lobbyClient.getMatch(gameId, activeMatch.matchID);
                const player0 = matchInfo.players.find(p => p.id === 0);
                const player1 = matchInfo.players.find(p => p.id === 1);
                let targetPlayerID = '';
                if (!player0?.name) targetPlayerID = '0';
                else if (!player1?.name) targetPlayerID = '1';
                else return;

                const playerName = user?.username || getGuestName();
                const { success } = await rejoinMatch(gameId, activeMatch.matchID, targetPlayerID, playerName);
                if (success) {
                    navigate(`/play/${gameId}/match/${activeMatch.matchID}?playerID=${targetPlayerID}`);
                }
            } catch {
                // ignore
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

    const handleConfirmAction = async () => {
        if (!pendingAction) return;

        let gameName = 'tictactoe';
        // 尝试获取正确的 gameName
        if (myMatchRole && myMatchRole.gameName) {
            gameName = myMatchRole.gameName;
        } else if (activeMatch && activeMatch.gameName) {
            gameName = activeMatch.gameName;
        }

        const success = await exitMatch(
            gameName,
            pendingAction.matchID,
            pendingAction.playerID,
            pendingAction.credentials,
            pendingAction.isHost
        );
        if (!success) {
            // Keep state as-is so the user can retry or decide what to do next.
            return;
        }

        // On success, the backend has released the slot; update local state to match.
        clearMatchCredentials(pendingAction.matchID);
        setPendingAction(null);
        setLocalStorageTick(t => t + 1);
    };

    const handleCancelAction = () => {
        setPendingAction(null);
    };

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
                        open
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
        <div className="min-h-screen bg-[#f3f0e6] text-[#433422] font-serif overflow-y-scroll flex flex-col items-center">
            <header className="w-full relative px-6 md:px-12 pt-5 md:pt-8 pb-4">
                {/* 顶级操作区域 - 改为标准导航条逻辑，中大屏锁定右侧，小屏居中 */}
                <div className="md:absolute md:top-10 md:right-12 flex items-center justify-center md:justify-end gap-4 mb-8 md:mb-0">
                    {user ? (
                        <UserMenu onLogout={handleLogout} onBindEmail={openEmailBind} />
                    ) : (
                        <div className="flex items-center gap-6">
                            <button onClick={() => openAuth('login')} className="group relative hover:text-[#2c2216] cursor-pointer font-bold text-sm tracking-wider py-1">
                                {t('auth:menu.login')}
                                <span className="underline-center" />
                            </button>
                            <div className="w-[1px] h-3 bg-[#c0a080] opacity-30" />
                            <button onClick={() => openAuth('register')} className="group relative hover:text-[#2c2216] cursor-pointer font-bold text-sm tracking-wider py-1">
                                {t('auth:menu.register')}
                                <span className="underline-center" />
                            </button>
                        </div>
                    )}
                    <LanguageSwitcher />
                </div>

                {/* 居中大标题 - 使用 clamp 保证响应式大小 */}
                <div className="flex flex-col items-center">
                    <h1 className="text-[clamp(1.75rem,5vw,2.5rem)] font-bold tracking-[0.15em] text-[#433422] mb-1.5 text-center leading-tight">
                        {t('lobby:home.title')}
                    </h1>
                    <div className="flex items-center gap-4">
                        <div className="h-px w-[115px] md:w-44 bg-[#433422] opacity-25" />
                        <img src="/logos/logo_1_grid.svg" alt="logo" className="w-5 md:w-6 opacity-60" />
                        <div className="h-px w-[115px] md:w-44 bg-[#433422] opacity-25" />
                    </div>
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
                    <GameList games={filteredGames} onGameClick={handleGameClick} />
                </section>
            </main>

            {/* 活跃对局指示器 */}
            {activeMatch && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="bg-[#433422] text-[#fcfbf9] px-6 py-3 rounded shadow-xl border border-[#5c4a35] flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-[#c0a080] uppercase tracking-wider font-bold">{t('lobby:home.activeMatch.status')}</span>
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
                                className="bg-[#c0a080] hover:bg-[#a08060] text-white px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm border border-[#c0a080]"
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
