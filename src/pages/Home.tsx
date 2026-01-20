import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CategoryPills, type Category } from '../components/layout/CategoryPills';
import { GameDetailsModal } from '../components/lobby/GameDetailsModal';
import { GameList } from '../components/lobby/GameList';
import { getGamesByCategory, getGameById } from '../config/games.config';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';
import { EmailBindModal } from '../components/auth/EmailBindModal';
import { lobbySocket, type LobbyMatch } from '../services/lobbySocket';
import { useNavigate } from 'react-router-dom';
import { clearMatchCredentials, leaveMatch } from '../hooks/useMatchStatus';
import { ConfirmModal } from '../components/common/ConfirmModal';
import clsx from 'clsx';

export const Home = () => {
    const [activeCategory, setActiveCategory] = useState<Category>('All');
    const [searchParams, setSearchParams] = useSearchParams();
    const [showUserMenu, setShowUserMenu] = useState(false);
    const navigate = useNavigate();

    // Active Match State
    const [activeMatch, setActiveMatch] = useState<LobbyMatch | null>(null);
    const [myMatchRole, setMyMatchRole] = useState<{ playerID: string; credentials?: string } | null>(null);
    const [pendingAction, setPendingAction] = useState<{
        matchID: string;
        playerID: string;
        credentials: string;
        isHost: boolean;
    } | null>(null);

    // Auth Modal State
    const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

    // Email Bind Modal State
    const [isEmailBindModalOpen, setIsEmailBindModalOpen] = useState(false);

    const { user, logout } = useAuth();
    const selectedGameId = searchParams.get('game');
    const selectedGame = useMemo(() => selectedGameId ? getGameById(selectedGameId) : null, [selectedGameId]);
    const filteredGames = useMemo(() => getGamesByCategory(activeCategory), [activeCategory]);

    const handleGameClick = (id: string) => {
        setSearchParams({ game: id });
    };

    const handleCloseModal = () => {
        setSearchParams({});
    };

    const handleLogout = () => {
        logout();
        setShowUserMenu(false);
    };

    const openAuth = (mode: 'login' | 'register') => {
        setAuthMode(mode);
        setIsAuthModalOpen(true);
    };

    // Check for active matches
    useEffect(() => {
        const unsubscribe = lobbySocket.subscribe((matches) => {
            // Priority 1: Check local credentials
            const localMatch = matches.find(m =>
                localStorage.getItem(`match_creds_${m.matchID}`)
            );

            if (localMatch) {
                setActiveMatch(localMatch);
                const saved = localStorage.getItem(`match_creds_${localMatch.matchID}`);
                if (saved) setMyMatchRole(JSON.parse(saved));
                return;
            }

            setActiveMatch(null);
            setMyMatchRole(null);
        });

        // Request initial state
        lobbySocket.requestRefresh();

        return () => unsubscribe();
    }, [user]);

    const handleReconnect = () => {
        if (!activeMatch || !myMatchRole) return;

        // We assume it's TicTacToe for now
        const gameId = 'tictactoe';
        navigate(`/games/${gameId}/match/${activeMatch.matchID}?playerID=${myMatchRole.playerID}`);
    };

    const handleDestroyOrLeave = async () => {
        if (!activeMatch || !myMatchRole) return;

        const { playerID, credentials } = myMatchRole;
        let effectiveCredentials = credentials;

        if (!effectiveCredentials) {
            clearMatchCredentials(activeMatch.matchID);
            setActiveMatch(null);
            setMyMatchRole(null);
            lobbySocket.requestRefresh();
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
        const success = await leaveMatch('TicTacToe', pendingAction.matchID, pendingAction.playerID, pendingAction.credentials);
        if (!success) {
            clearMatchCredentials(pendingAction.matchID);
            setPendingAction(null);
            lobbySocket.requestRefresh();
            return;
        }
        setPendingAction(null);
        lobbySocket.requestRefresh();
    };

    const handleCancelAction = () => {
        setPendingAction(null);
    };

    return (
        <div className="min-h-screen bg-[#f3f0e6] text-[#433422] font-serif overflow-y-scroll">

            {/* Compact Header - Logo integrated into divider */}
            <div className="pt-6 pb-3 flex justify-center">
                <div className="flex flex-col items-center">
                    <h1 className="text-3xl font-bold tracking-[0.2em] text-[#433422] mb-4">
                        桌游教学与联机平台
                    </h1>
                    {/* Divider with embedded logo */}
                    <div className="flex items-center gap-3">
                        <div className="h-px w-16 bg-[#433422] opacity-20" />

                        {/* Logo */}
                        <img
                            src="/logos/logo_1_grid.svg"
                            alt="BoardGame Logo"
                            className="w-6 h-6 opacity-60"
                        />

                        <div className="h-px w-16 bg-[#433422] opacity-20" />
                    </div>
                </div>
            </div>

            {/* Auth Actions - with cursor pointer */}
            <div className="absolute top-4 right-4 text-[10px] font-sans tracking-wide z-50 text-[#8c7b64]">
                {user ? (
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="hover:text-[#2c2216] text-[#433422] flex items-center gap-1 cursor-pointer transition-colors px-2 py-1 rounded hover:bg-[#e8e4db]"
                        >
                            <span className="font-bold text-sm">{user.username}</span>
                        </button>
                        {showUserMenu && (
                            <div className="absolute top-[calc(100%+8px)] right-0 bg-[#fefcf7] shadow-[0_8px_24px_rgba(67,52,34,0.15)] border border-[#d3ccba] rounded-sm py-1.5 px-1.5 z-50 min-w-[100px] animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="absolute -top-1.5 right-4 w-3 h-3 bg-[#fefcf7] border-l border-t border-[#d3ccba] rotate-45" />

                                {/* Bind Email */}
                                <button
                                    onClick={() => { setShowUserMenu(false); setIsEmailBindModalOpen(true); }}
                                    className="relative w-full px-4 py-2 text-center cursor-pointer text-[#433422] whitespace-nowrap font-serif font-bold text-xs tracking-wider transition-colors group"
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-1">
                                        {user?.emailVerified ? '✓' : '📧'}
                                        {user?.emailVerified ? '已绑定邮箱' : '绑定邮箱'}
                                    </span>
                                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-[1.5px] bg-[#433422] transition-all duration-300 group-hover:w-[60%]" />
                                </button>

                                <div className="h-px bg-[#e5e0d0] my-1" />

                                {/* Logout */}
                                <button
                                    onClick={handleLogout}
                                    className="relative w-full px-4 py-2 text-center cursor-pointer text-[#433422] whitespace-nowrap font-serif font-bold text-xs tracking-wider transition-colors group"
                                >
                                    <span className="relative z-10">退出登录</span>
                                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-0 h-[1.5px] bg-[#433422] transition-all duration-300 group-hover:w-[60%]" />
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex gap-4 items-center">
                        <button
                            onClick={() => openAuth('login')}
                            className="relative hover:text-[#2c2216] cursor-pointer transition-colors font-bold text-xs tracking-wider group py-1"
                        >
                            <span className="relative z-10">登录</span>
                            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#433422] transition-all duration-300 group-hover:w-full" />
                        </button>
                        <span className="opacity-30">|</span>
                        <button
                            onClick={() => openAuth('register')}
                            className="relative hover:text-[#2c2216] cursor-pointer transition-colors font-bold text-xs tracking-wider group py-1"
                        >
                            <span className="relative z-10">注册</span>
                            <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#433422] transition-all duration-300 group-hover:w-full" />
                        </button>
                    </div>
                )}
            </div>

            {/* Main Content */}
            <main className="w-full flex flex-col items-center py-4">

                {/* Category Filter */}
                <div className="mb-8">
                    <CategoryPills activeCategory={activeCategory} onSelect={setActiveCategory} />
                </div>

                {/* Game Grid */}
                <div className="w-full flex justify-center px-4">
                    <GameList games={filteredGames} onGameClick={handleGameClick} />
                </div>

            </main>

            {/* Active Match Indicator */}
            {activeMatch && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-300">
                    <div className="bg-[#433422] text-[#fcfbf9] px-6 py-3 rounded shadow-xl border border-[#5c4a35] flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-[#c0a080] uppercase tracking-wider font-bold">当前进行中</span>
                            <span className="text-sm font-bold">
                                房间 #{activeMatch.matchID.slice(0, 4)}
                                <span className="mx-2 opacity-50">|</span>
                                <span className={activeMatch.players.some(p => p.name) ? 'opacity-100' : 'opacity-50 italic'}>
                                    {activeMatch.players.filter(p => p.name).length} 人在席
                                </span>
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {myMatchRole && (
                                <button
                                    onClick={handleDestroyOrLeave}
                                    className={clsx(
                                        "px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border",
                                        myMatchRole.playerID === '0'
                                            ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                                            : "bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20"
                                    )}
                                >
                                    {myMatchRole.playerID === '0' ? '销毁' : '离开'}
                                </button>
                            )}
                            <button
                                onClick={handleReconnect}
                                className="bg-[#c0a080] hover:bg-[#a08060] text-white px-6 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-sm border border-[#c0a080]"
                            >
                                重连进入
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pendingAction && (
                <ConfirmModal
                    open={!!pendingAction}
                    title={pendingAction?.isHost ? '销毁房间' : '离开房间'}
                    description={pendingAction?.isHost ? '确定要销毁房间吗？' : '确定要离开房间吗？'}
                    onConfirm={handleConfirmAction}
                    onCancel={handleCancelAction}
                    tone="warm"
                />
            )}

            {/* Modals */}
            {selectedGame && (
                <GameDetailsModal
                    isOpen={!!selectedGameId}
                    onClose={handleCloseModal}
                    gameId={selectedGame.id}
                    title={selectedGame.title}
                />
            )}
            <AuthModal
                isOpen={isAuthModalOpen}
                onClose={() => setIsAuthModalOpen(false)}
                initialMode={authMode}
            />
            <EmailBindModal
                isOpen={isEmailBindModalOpen}
                onClose={() => setIsEmailBindModalOpen(false)}
            />
        </div>
    );
};
