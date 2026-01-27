import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LogOut,
    Trash2,
    Monitor,
    Users,
    Copy,
    Check,
    MessageSquare,
    Undo2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useSocial } from '../../contexts/SocialContext';
import { useUndo, useUndoStatus } from '../../contexts/UndoContext';
import { FriendsChatModal } from '../social/FriendsChatModal';
import { FabMenu } from '../system/FabMenu';
import { AudioControlSection } from './AudioControlSection';
import { UNDO_COMMANDS } from '../../engine';

interface GameHUDProps {
    mode: 'local' | 'online' | 'tutorial';

    // Online specific props
    matchId?: string;
    gameId?: string;
    isHost?: boolean;
    credentials?: string;

    // Player status (for online)
    myPlayerId?: string | null;
    opponentName?: string | null;
    opponentConnected?: boolean;
    players?: Array<{
        id: number;
        name?: string;
        isConnected?: boolean;
    }>;

    // Actions
    onLeave?: () => void;
    onDestroy?: () => void;
    isLoading?: boolean;
}

export const GameHUD = ({
    mode,
    matchId,
    gameId,
    isHost,
    credentials,
    myPlayerId,
    opponentName,
    opponentConnected,
    players,
    onLeave,
    onDestroy,
    isLoading = false
}: GameHUDProps) => {
    const navigate = useNavigate();
    const { openModal } = useModalStack();
    const { unreadTotal, requests } = useSocial();
    const { t } = useTranslation('game');
    const [copied, setCopied] = useState(false);

    const copyRoomId = () => {
        if (matchId) {
            navigator.clipboard.writeText(matchId);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleLeave = () => {
        if (isLoading) return;
        if (onLeave) onLeave();
        else navigate('/');
    };

    const handleDestroy = () => {
        if (isLoading) return;
        if (onDestroy) onDestroy();
    };

    // Derived states
    const isOnline = mode === 'online';
    const isLocal = mode === 'local';
    const isTutorial = mode === 'tutorial';
    const isSpectator = isOnline && (myPlayerId === null || myPlayerId === undefined);

    const totalBadge = unreadTotal + requests.length;

    // Define Icon based on mode
    const ModeIcon = isOnline ? <Users size={20} /> : isLocal ? <Monitor size={20} /> : <Check size={20} />;
    const activeColor = isOnline ? 'text-indigo-400' : isLocal ? 'text-neon-blue' : 'text-emerald-400';

    // Undo state from Context
    const undoState = useUndo();
    const { status: undoStatus, hasNotification: hasUndoNotification } = useUndoStatus();
    const showUndo = undoState && undoStatus;
    const lastUndoLogRef = useRef<string | null>(null);

    useEffect(() => {
        if (!import.meta.env.DEV) return;
        const snapshot = JSON.stringify({
            showUndo,
            undoStatus,
            hasUndoNotification,
            historyLen: undoState?.G.sys?.undo?.snapshots?.length ?? 0,
            hasRequest: !!undoState?.G.sys?.undo?.pendingRequest,
            playerID: undoState?.playerID ?? null,
            currentPlayer: (undoState?.G.core as { currentPlayer?: string | number } | undefined)?.currentPlayer
                ?? undoState?.ctx?.currentPlayer
                ?? null,
        });
        if (lastUndoLogRef.current === snapshot) return;
        lastUndoLogRef.current = snapshot;
        console.log('[GameHUD][Undo]', JSON.parse(snapshot));
    }, [showUndo, undoStatus, hasUndoNotification, undoState]);

    // Total notification badge (including undo requests)
    const hasAnyNotification = totalBadge > 0 || hasUndoNotification;

    return (
        <FabMenu
            isDark={true}
            icon={
                <div className="relative">
                    {ModeIcon}
                    {hasAnyNotification && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-black/50 animate-pulse" />
                    )}
                </div>
            }
            activeColor={activeColor}
            className="fixed bottom-8 right-8 z-[10000] flex flex-col items-end gap-2 font-sans"
            titleExpand={t('hud.toggle.expand')}
            titleCollapse={t('hud.toggle.collapse')}
        >
            {/* Header Section */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
                <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                    {isLocal ? t('hud.mode.local') : isTutorial ? t('hud.mode.tutorial') : t('hud.mode.online')}
                </span>
                {isOnline && matchId && (
                    <button
                        onClick={copyRoomId}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition-colors group"
                        title={t('hud.copyRoomId')}
                    >
                        <span className="text-white/40 text-[10px] font-mono group-hover:text-white/80 transition-colors">
                            {t('hud.roomId', { id: matchId.slice(0, 4) })}
                        </span>
                        {copied ? <Check size={10} className="text-green-400" /> : <Copy size={10} className="text-white/40 group-hover:text-white/80" />}
                    </button>
                )}
            </div>

            {/* Status Section */}
            <div className="space-y-3">
                {isOnline && (
                    <>
                        {isSpectator ? (
                            [0, 1].map((slotId) => {
                                const player = players?.find(p => p.id === slotId);
                                const name = player?.name;
                                const isConnected = player?.isConnected;
                                const statusDot = name
                                    ? (isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse')
                                    : 'bg-yellow-500 animate-pulse';
                                const rightStatus = name
                                    ? (isConnected ? t('hud.status.connected') : t('hud.status.offline'))
                                    : t('hud.status.searching');
                                return (
                                    <div key={slotId} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${statusDot}`} />
                                            <span className={`${name ? 'text-white/90' : 'text-white/50'} font-medium`}>
                                                {name || t('hud.status.waiting')}
                                            </span>
                                        </div>
                                        <span className="text-white/40 text-xs">
                                            {t('hud.status.player', { id: slotId + 1 })} · {rightStatus}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                        <span className="text-white/90 font-medium">{t('hud.status.self')}</span>
                                    </div>
                                    <span className="text-white/40 text-xs">{t('hud.status.connected')}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${opponentName ? (opponentConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse') : 'bg-yellow-500 animate-pulse'}`} />
                                        <span className={`${opponentName ? 'text-white/90' : 'text-white/50'} font-medium`}>
                                            {opponentName || t('hud.status.waiting')}
                                        </span>
                                    </div>
                                    <span className="text-white/40 text-xs">
                                        {opponentName ? (opponentConnected ? t('hud.status.opponent') : t('hud.status.offline')) : t('hud.status.searching')}
                                    </span>
                                </div>
                            </>
                        )}
                    </>
                )}

                {isLocal && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Monitor size={16} className="text-neon-blue" />
                            <span className="text-neon-blue font-bold text-sm">{t('hud.status.localTitle')}</span>
                        </div>
                        <p className="text-white/40 text-xs leading-relaxed">
                            {t('hud.status.localDescription')}
                        </p>
                    </div>
                )}

                {isTutorial && (
                    <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Check size={16} className="text-green-400" />
                            <span className="text-green-400 font-bold text-sm">{t('hud.status.tutorialTitle')}</span>
                        </div>
                        <p className="text-white/40 text-xs leading-relaxed">
                            {t('hud.status.tutorialDescription')}
                        </p>
                    </div>
                )}
            </div>

            {/* Social Section */}
            <div className="pt-1 pb-1">
                <button
                    onClick={() => {
                        openModal({
                            closeOnBackdrop: true,
                            closeOnEsc: true,
                            render: ({ close }) => (
                                <FriendsChatModal
                                    isOpen
                                    onClose={close}
                                    inviteData={isOnline && matchId && gameId ? { matchId, gameName: gameId } : undefined}
                                />
                            )
                        });
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all font-semibold text-sm group text-white/90"
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare size={16} />
                        <span>{t('hud.actions.social') || 'Social'}</span>
                    </div>
                    {totalBadge > 0 && (
                        <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full text-[10px] text-white font-bold">
                            {totalBadge > 9 ? '9+' : totalBadge}
                        </span>
                    )}
                </button>
            </div>

            {/* Audio Section */}
            <AudioControlSection />

            {/* Undo Section - always show if in game and not spectator */}
            {undoState && !undoState.isGameOver && (
                <div className="pt-2 pb-2 border-t border-white/10">
                    {undoStatus === 'canReview' ? (
                        <div className="space-y-2">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
                                    <span className="text-blue-400 text-xs font-bold">
                                        {t('controls.undo.opponentRequest')}
                                    </span>
                                </div>
                                <p className="text-white/50 text-[10px] leading-relaxed">
                                    {t('controls.undo.reviewHint')}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => undoState.moves[UNDO_COMMANDS.APPROVE_UNDO]()}
                                    className="flex-1 px-3 py-2 rounded-lg bg-green-500/20 hover:bg-green-500 hover:text-white border border-green-500/50 hover:border-green-500 text-green-400 text-xs font-bold transition-all"
                                >
                                    {t('controls.undo.approve')}
                                </button>
                                <button
                                    onClick={() => undoState.moves[UNDO_COMMANDS.REJECT_UNDO]()}
                                    className="flex-1 px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500 hover:text-white border border-red-500/50 hover:border-red-500 text-red-400 text-xs font-bold transition-all"
                                >
                                    {t('controls.undo.reject')}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={() => {
                                if (undoStatus === 'isRequester') {
                                    undoState.moves[UNDO_COMMANDS.CANCEL_UNDO]();
                                } else {
                                    undoState.moves[UNDO_COMMANDS.REQUEST_UNDO]();
                                }
                            }}
                            disabled={undoStatus === null}
                            className={`w-full px-3 py-2.5 rounded-lg font-bold text-xs transition-all group flex items-center justify-center gap-2 ${
                                undoStatus === 'isRequester'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 border'
                                    : undoStatus === 'canRequest'
                                    ? 'bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-500/50 hover:border-amber-500 text-amber-400'
                                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                            }`}
                        >
                            {undoStatus === 'isRequester' ? (
                                <>
                                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                    <span>{t('controls.undo.waiting')}</span>
                                </>
                            ) : (
                                <>
                                    <Undo2 size={14} className="group-hover:-rotate-45 transition-transform" />
                                    <span>{t('controls.undo.request')}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Actions Section */}
            <div className="pt-2 flex flex-col gap-2">
                {isOnline && isHost && (
                    <button
                        onClick={handleDestroy}
                        disabled={!credentials || isLoading}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/40 transition-all font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <Trash2 size={16} className="group-hover:scale-110 transition-transform" />
                        <span>{t('hud.actions.destroy')}</span>
                    </button>
                )}

                <button
                    onClick={handleLeave}
                    disabled={isLoading || (isOnline && !isSpectator && !credentials)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 hover:border-white/20 transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed group"
                >
                    <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span>{isHost ? t('hud.actions.leaveKeep') : t('hud.actions.backToLobby')}</span>
                </button>
            </div>
        </FabMenu>
    );
};

