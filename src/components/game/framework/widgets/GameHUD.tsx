import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    LogOut,
    Trash2,
    Monitor,
    Copy,
    Check,
    MessageSquare,
    Send,
    Undo2,
    Settings,
    Maximize,
    Minimize,
    MessageSquareWarning,
    Users,
    ListOrdered
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUndo, useUndoStatus } from '../../../../contexts/UndoContext';
import { UI_Z_INDEX } from '../../../../core';
import { FabMenu, type FabAction } from '../../../system/FabMenu';
import { UNDO_COMMANDS } from '../../../../engine';
import { AudioControlSection } from './AudioControlSection';
import { AboutModal } from '../../../system/AboutModal';
import { FeedbackModal } from '../../../system/FeedbackModal';
import { useToast } from '../../../../contexts/ToastContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { matchSocket, type MatchChatMessage } from '../../../../services/matchSocket';
import { MAX_CHAT_LENGTH, MAX_CHAT_MESSAGES } from '../../../../shared/chat';
import { useModalStack } from '../../../../contexts/ModalStackContext';
import { FriendsChatModal } from '../../../social/FriendsChatModal';
import { useSocial } from '../../../../contexts/SocialContext';
import { buildActionLogRows } from '../../utils/actionLogFormat';
import { ActionLogSegments } from './ActionLogSegments';
import { getCardPreviewGetter, getCardPreviewMaxDim } from '../../registry/cardPreviewRegistry';

interface GameHUDProps {
    mode: 'local' | 'online' | 'tutorial';
    matchId?: string;
    gameId?: string;
    isHost?: boolean;
    credentials?: string;
    myPlayerId?: string | null;
    opponentName?: string | null;
    opponentConnected?: boolean;
    players?: Array<{
        id: number;
        name?: string;
        isConnected?: boolean;
    }>;
    onLeave?: () => void;
    onDestroy?: () => void;
    onForceExit?: () => void;
    isLoading?: boolean;
}

// 判断消息是否来自自己
export const isSelfChatMessage = (
    message: MatchChatMessage,
    myPlayerId?: string | null,
    myDisplayName?: string
) => {
    return message.senderId != null
        ? String(message.senderId) === String(myPlayerId ?? '')
        : message.senderName === myDisplayName;
};

// 获取最近一条非自身消息（用于未读预览）
export const getLatestIncomingMessage = (
    messages: MatchChatMessage[],
    myPlayerId?: string | null,
    myDisplayName?: string
) => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (!isSelfChatMessage(message, myPlayerId, myDisplayName)) return message;
    }
    return null;
};

export const trimChatMessages = (
    messages: MatchChatMessage[],
    maxMessages = MAX_CHAT_MESSAGES
) => {
    if (messages.length <= maxMessages) return messages;
    return messages.slice(messages.length - maxMessages);
};

export const GameHUD = ({
    mode,
    matchId,
    gameId: _gameId,
    isHost,
    credentials,
    myPlayerId,
    players,
    onLeave,
    onDestroy,
    onForceExit,
    isLoading = false,
}: GameHUDProps) => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('game');
    const toast = useToast();
    const { user } = useAuth();

    // 从注册表获取游戏特定的卡牌预览函数
    const getCardPreviewRef = useMemo(() => {
        return _gameId ? getCardPreviewGetter(_gameId) : undefined;
    }, [_gameId]);

    const cardPreviewMaxDim = useMemo(() => {
        return _gameId ? getCardPreviewMaxDim(_gameId) : undefined;
    }, [_gameId]);

    const locale = i18n.language;
    const { openModal, closeModal } = useModalStack();
    const { unreadTotal, requests } = useSocial();
    const [copied, setCopied] = useState(false);

    // 撤回状态
    const undoState = useUndo();
    const { status: undoStatus, hasNotification: _hasUndoNotification } = useUndoStatus();
    const currentPlayerId = (undoState?.G?.core as Record<string, unknown>)?.currentPlayer as string | undefined;

    const isOnline = mode === 'online';
    const isLocal = mode === 'local';
    const isTutorial = mode === 'tutorial';
    const isSpectator = isOnline && (myPlayerId === null || myPlayerId === undefined);

    // 聊天逻辑
    const [chatMessages, setChatMessages] = useState<MatchChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    const isChatReadonly = isSpectator;
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
    const isChatPanelOpenRef = useRef(false);

    const myDisplayName = useMemo(() => {
        if (user?.username) return user.username;
        const matched = players?.find((p) => String(p.id) === String(myPlayerId));
        return matched?.name ?? (myPlayerId != null
            ? t('hud.status.player', { id: myPlayerId })
            : t('hud.status.playerUnknown'));
    }, [myPlayerId, players, user?.username]);

    const playerNameMap = useMemo(() => {
        const map = new Map<string, string>();
        players?.forEach((player) => {
            if (player.name) map.set(String(player.id), player.name);
        });
        return map;
    }, [players]);

    const getActionLogPlayerLabel = useCallback((playerId: string | number) => {
        const normalizedId = String(playerId);
        const knownName = playerNameMap.get(normalizedId);
        if (knownName) return knownName;
        if (myPlayerId != null && normalizedId === String(myPlayerId) && myDisplayName) return myDisplayName;
        return t('hud.status.player', { id: normalizedId });
    }, [myPlayerId, myDisplayName, playerNameMap, t]);

    const actionLogRows = useMemo(() => {
        const entries = undoState?.G?.sys?.actionLog?.entries ?? [];
        return buildActionLogRows(entries, { getPlayerLabel: getActionLogPlayerLabel });
    }, [getActionLogPlayerLabel, undoState?.G?.sys?.actionLog?.entries]);

    const isSelfMessage = useCallback((message: MatchChatMessage) => {
        return isSelfChatMessage(message, myPlayerId, myDisplayName);
    }, [myPlayerId, myDisplayName]);

    const latestIncomingMessage = useMemo(() => {
        return getLatestIncomingMessage(chatMessages, myPlayerId, myDisplayName);
    }, [chatMessages, myPlayerId, myDisplayName]);

    // 临时日志：确认局内聊天面板内容高度/布局是否生效（问题定位后删除）
    const chatPanelRef = useRef<HTMLDivElement>(null);
    // 日志已移除：ChatPanel 布局调试已完成

    useEffect(() => {
        isChatPanelOpenRef.current = isChatPanelOpen;
        if (isChatPanelOpen) {
            setUnreadChatCount(0);
        }
    }, [isChatPanelOpen]);

    useEffect(() => {
        setUnreadChatCount(0);
    }, [matchId]);

    useEffect(() => {
        if (!isOnline || !matchId) return;

        matchSocket.joinChat(matchId);
        const unsubscribe = matchSocket.subscribeChat((message) => {
            if (message.matchId !== matchId) return;
            setChatMessages((prev) => {
                if (prev.some((m) => m.id === message.id)) return prev;
                const next = [...prev, message];
                const trimmed = next.length > MAX_CHAT_MESSAGES;
                const nextMessages = trimChatMessages(next);
                if (trimmed) {
                    console.warn(`[HUD-CHAT] event=trim_messages matchId=${matchId ?? 'unknown'} size=${next.length} max=${MAX_CHAT_MESSAGES}`);
                }
                return nextMessages;
            });
            if (!isSelfMessage(message) && !isChatPanelOpenRef.current) {
                setUnreadChatCount((prev) => prev + 1);
            }
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        });

        return () => {
            unsubscribe();
            matchSocket.leaveChat();
        };
    }, [isOnline, matchId, isSelfMessage]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = chatInput.trim();
        if (!trimmed) return;
        if (trimmed.length > MAX_CHAT_LENGTH) {
            toast.warning(t('hud.chat.tooLong', { count: MAX_CHAT_LENGTH }));
            return;
        }

        if (isOnline) {
            if (isChatReadonly) {
                toast.info(t('hud.chat.readonlyWarning'));
                return;
            }
            const result = matchSocket.sendChat(trimmed, myPlayerId ?? undefined, myDisplayName);
            if (!result.ok) {
                if (result.reason === 'not_connected') {
                    toast.error(t('hud.chat.notConnected'));
                } else {
                    if (matchId) matchSocket.joinChat(matchId);
                    toast.info(t('hud.chat.connecting'));
                }
                return;
            }
        } else {
            const localMessage: MatchChatMessage = {
                id: crypto.randomUUID(),
                matchId: matchId ?? 'local',
                senderId: myPlayerId ?? undefined,
                senderName: myDisplayName,
                text: trimmed,
                createdAt: new Date().toISOString(),
            };
            setChatMessages((prev) => {
                const next = [...prev, localMessage];
                const trimmed = next.length > MAX_CHAT_MESSAGES;
                const nextMessages = trimChatMessages(next);
                if (trimmed) {
                    console.warn(`[HUD-CHAT] event=trim_messages matchId=${matchId ?? 'local'} size=${next.length} max=${MAX_CHAT_MESSAGES}`);
                }
                return nextMessages;
            });
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
        }

        setChatInput('');
    };

    // 全屏状态
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
    const toggleFullscreen = async () => {
        const doc = document as any;
        const elem = document.documentElement as any;

        if (!document.fullscreenElement) {
            try {
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    await elem.msRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    await elem.mozRequestFullScreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen((Element as any).ALLOW_KEYBOARD_INPUT);
                }
                setIsFullscreen(true);
            } catch (error) {
                toast.error(t('hud.fullscreen.enterFailed'));
            }
            return;
        }

        try {
            if (document.exitFullscreen) {
                await document.exitFullscreen();
            } else if (doc.msExitFullscreen) {
                await doc.msExitFullscreen();
            } else if (doc.mozCancelFullScreen) {
                await doc.mozCancelFullScreen();
            } else if (doc.webkitExitFullscreen) {
                await doc.webkitExitFullscreen();
            }
            setIsFullscreen(false);
        } catch (error) {
            toast.error(t('hud.fullscreen.exitFailed'));
        }
    };

    useEffect(() => {
        const handleFS = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFS);
        return () => document.removeEventListener('fullscreenchange', handleFS);
    }, []);

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

    const handleForceExit = () => {
        if (isLoading) return;
        if (onForceExit) onForceExit();
        else navigate('/');
    };

    const handleDestroy = () => {
        if (isLoading) return;
        if (onDestroy) onDestroy();
    };

    // 弹窗
    const [showAbout, setShowAbout] = useState(false);
    const [showFeedback, setShowFeedback] = useState(false);
    const [socialModalId, setSocialModalId] = useState<string | null>(null);

    // --- 操作项构建 ---
    const items: FabAction[] = [];

    const actionLogAction: FabAction = {
        id: 'action-log',
        icon: <ListOrdered size={20} />,
        label: t('hud.actions.actionLog'),
        content: (
            <div className="flex flex-col gap-2 pr-1">
                {actionLogRows.length === 0 ? (
                    <div className="text-xs text-white/40 text-center py-6">
                        {t('hud.actionLog.empty')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {actionLogRows.map((row) => (
                            <div key={row.id} className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
                                <div className="flex items-center justify-between text-[10px] text-white/50">
                                    <span className="font-mono">{row.timeLabel}</span>
                                    <span className="font-semibold text-white/70">{row.playerLabel}</span>
                                </div>
                                <div className="text-xs text-white/90 mt-1 leading-relaxed">
                                    <ActionLogSegments
                                        segments={row.segments}
                                        locale={locale}
                                        getCardPreviewRef={getCardPreviewRef}
                                        cardPreviewMaxDim={cardPreviewMaxDim}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        ),
    };

    // 0. 主按钮逻辑
    // 在线模式：聊天为主按钮
    // 本地模式：设置为主按钮（聊天无效）
    const useChatAsMain = isOnline || isTutorial;

    if (useChatAsMain) {
        // [0] 聊天（主按钮）
        items.push({
            id: 'chat',
            icon: <MessageSquare size={20} />,
            label: t('hud.actions.chat'),
            active: unreadChatCount > 0,
            // 预览：一行展示，格式“用户名：消息”
            preview: unreadChatCount > 0 && latestIncomingMessage ? (
                <div className="text-xs font-semibold text-white/90 truncate max-w-[220px]">
                    {t('hud.chat.preview', {
                        name: latestIncomingMessage.senderName || t('hud.chat.unknownPlayer'),
                        message: latestIncomingMessage.text,
                    })}
                </div>
            ) : undefined,
            onActivate: (isActive) => setIsChatPanelOpen(isActive),
            content: (
                <div ref={chatPanelRef} className="flex flex-col h-80">
                    {isOnline && (
                        <div className="mb-2 space-y-1 text-[10px] text-white/60">
                            <div className="flex items-center gap-2">
                                <span className="uppercase font-bold text-white/40">{t('hud.actions.room')}</span>
                                <span className="font-mono tracking-widest">{matchId ?? '-'}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="uppercase font-bold text-white/40">{t('hud.status.self')}</span>
                                <span className="text-white/80">{myDisplayName}</span>
                            </div>
                        </div>
                    )}
                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-xs">
                        {chatMessages.length === 0 && (
                            <div className="text-white/20 text-center mt-10 italic">{t('hud.chat.empty')}</div>
                        )}
                        {chatMessages.map((msg) => (
                            <div key={msg.id} className="flex flex-col">
                                <span className="text-[10px] text-white/40 mb-0.5 font-bold">{msg.senderName}</span>
                                <div className="bg-white/10 text-white/90 p-2 rounded-lg rounded-tl-none self-start break-words max-w-full">
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <form onSubmit={handleSendMessage} className="shrink-0 mt-2 pt-2 border-t border-white/10 flex items-center gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder={isChatReadonly ? t('hud.chat.readonlyPlaceholder') : t('hud.chat.placeholder')}
                                maxLength={MAX_CHAT_LENGTH}
                                disabled={isChatReadonly}
                                className="w-full bg-white/15 border border-white/35 rounded px-2 py-1.5 pr-16 text-xs text-white placeholder-white/60 focus:outline-none focus:border-neon-blue/70 focus:bg-white/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                            {chatInput.length >= MAX_CHAT_LENGTH && (
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-300">
                                    {t('hud.chat.maxLength', { count: MAX_CHAT_LENGTH })}
                                </span>
                            )}
                        </div>
                        <button
                            type="submit"
                            disabled={isChatReadonly || !chatInput.trim()}
                            className="p-1.5 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 rounded border border-indigo-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={14} />
                        </button>
                    </form>
                </div>
            )
        });
    }

    // 定义设置按钮
    const settingsAction: FabAction = {
        id: 'settings',
        icon: <Settings size={20} />,
        label: t('hud.actions.settings'),
        content: (
            <div>
                {/* 本地同屏模式信息 */}
                {isLocal && (
                    <div className="mb-4 p-3 rounded-lg bg-neon-blue/10 border border-neon-blue/30">
                        <div className="flex items-center gap-2 mb-2">
                            <Monitor size={14} className="text-neon-blue" />
                            <span className="text-neon-blue font-bold text-xs uppercase tracking-wider">
                                {t('hud.mode.local')}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                            <span className="text-white/60">{t('hud.labels.turn')}</span>
                            <span className={`font-bold ${currentPlayerId === '0' ? 'text-amber-400' : 'text-purple-400'}`}>
                                {t('hud.status.playerShort', {
                                    id: String(currentPlayerId) === '0' ? 1 : 2,
                                })}
                            </span>
                        </div>
                    </div>
                )}

                {isOnline && (
                    <div className="space-y-4 mt-3">
                        {matchId && (
                            <div className="space-y-1">
                                <span className="text-[10px] text-white/60 uppercase font-bold">{t('hud.labels.roomId')}</span>
                                <button
                                    onClick={copyRoomId}
                                    className="w-full flex items-center justify-between px-3 py-2 rounded bg-white/5 hover:bg-white/10 transition-colors group border border-white/5"
                                >
                                    <span className="font-mono text-sm tracking-widest">{matchId}</span>
                                    {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-white/40 group-hover:text-white/80" />}
                                </button>
                            </div>
                        )}
                        {players && (
                            <div className="space-y-2 relative">
                                <span className="text-[10px] text-white/60 uppercase font-bold">{t('hud.labels.players')}</span>
                                <div className="space-y-2">
                                    {players.map(p => (
                                        <div key={p.id} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded border border-white/5">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${p.isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
                                                <span className="text-sm font-medium">{p.name || t('hud.status.player', { id: p.id })}</span>
                                            </div>
                                            {String(p.id) === String(myPlayerId) && (
                                                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-white/60">{t('hud.status.self')}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <AudioControlSection isDark={true} />
            </div>
        )
    };

    // ===== 联机模式卫星按钮顺序（push 顺序 = 从上到下显示顺序） =====
    // 目标：退出 → 反馈 → 社交 → 全屏 → 设置 → 撤回 → 操作日志 → 聊天(主按钮)

    const exitAction: FabAction = {
        id: 'exit',
        icon: <LogOut size={20} />,
        label: t('hud.actions.exit'),
        content: (
            <div className="space-y-3">
                {/* 本地模式：只显示返回大厅 */}
                {!isOnline && (
                    <button
                        onClick={() => {
                            if (isLoading) return;
                            navigate('/');
                        }}
                        disabled={isLoading}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 transition-all font-bold text-xs"
                    >
                        <LogOut size={16} />
                        <div className="flex flex-col items-start">
                            <span>{t('hud.actions.backToLobby')}</span>
                            <span className="text-[9px] opacity-60 font-normal">{t('hud.actions.backToLobbyHint')}</span>
                        </div>
                    </button>
                )}

                {/* 在线模式：根据身份显示不同选项 */}
                {isOnline && (
                    <>
                        {/* 有凭证的情况 */}
                        {credentials && (
                            <>
                                {/* 房主：显示销毁房间 */}
                                {isHost && (
                                    <button
                                        onClick={handleDestroy}
                                        disabled={isLoading}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all font-bold text-xs"
                                    >
                                        <Trash2 size={16} />
                                        <div className="flex flex-col items-start">
                                            <span>{t('hud.actions.destroy')}</span>
                                            <span className="text-[9px] opacity-60 font-normal">{t('hud.actions.destroyHint')}</span>
                                        </div>
                                    </button>
                                )}

                                {/* 非房主：显示离开房间 */}
                                {!isHost && (
                                    <button
                                        onClick={handleLeave}
                                        disabled={isLoading}
                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all font-bold text-xs"
                                    >
                                        <LogOut size={16} />
                                        <div className="flex flex-col items-start">
                                            <span>{t('hud.actions.leaveRoom')}</span>
                                            <span className="text-[9px] opacity-60 font-normal">{t('hud.actions.leaveRoomHint')}</span>
                                        </div>
                                    </button>
                                )}

                                {/* 暂时离开（所有有凭证的玩家都可用） */}
                                <button
                                    onClick={() => {
                                        if (isLoading) return;
                                        navigate('/');
                                    }}
                                    disabled={isLoading}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 transition-all font-bold text-xs"
                                >
                                    <LogOut size={16} />
                                    <div className="flex flex-col items-start">
                                        <span>{t('hud.actions.tempLeave')}</span>
                                        <span className="text-[9px] opacity-60 font-normal">{t('hud.actions.tempLeaveHint')}</span>
                                    </div>
                                </button>
                            </>
                        )}

                        {/* 无凭证：只显示强制退出 */}
                        {!credentials && (
                            <button
                                onClick={handleForceExit}
                                disabled={isLoading}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded bg-white/5 hover:bg-white/10 text-white/90 border border-white/10 transition-all font-bold text-xs"
                            >
                                <LogOut size={16} />
                                <div className="flex flex-col items-start">
                                    <span>{t('hud.actions.forceExit')}</span>
                                    <span className="text-[9px] opacity-60 font-normal">{t('hud.actions.forceExitHint')}</span>
                                </div>
                            </button>
                        )}
                    </>
                )}
            </div>
        )
    };

    // 1. 退出
    items.push(exitAction);

    // 2. 反馈
    items.push({
        id: 'feedback',
        icon: <MessageSquareWarning size={20} />,
        label: t('hud.actions.feedback'),
        onClick: () => setShowFeedback(true),
    });

    // 3. 社交（仅登录用户）
    const totalBadge = unreadTotal + requests.length;
    if (user) {
        items.push({
            id: 'social',
            icon: <Users size={20} />,
            label: t('hud.actions.social'),
            active: totalBadge > 0,
            onClick: () => {
                if (socialModalId) {
                    closeModal(socialModalId);
                    return;
                }
                const id = openModal({
                    id: 'game_hud_social',
                    closeOnBackdrop: true,
                    closeOnEsc: true,
                    onClose: () => setSocialModalId(null),
                    render: ({ close }) => (
                        <FriendsChatModal isOpen onClose={close} />
                    ),
                });
                setSocialModalId(id);
            },
        });
    }

    // 4. 全屏
    items.push({
        id: 'fullscreen',
        icon: isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />,
        label: isFullscreen ? t('hud.actions.exitFullscreen') : t('hud.actions.fullscreen'),
        onClick: toggleFullscreen,
    });

    // 5. 设置
    if (useChatAsMain) {
        items.push(settingsAction);
    }

    // 6. 撤回
    if (!isSpectator) {
        if (!undoState) {
            items.push({
                id: 'undo-loading',
                icon: <Undo2 size={20} className="opacity-60" />,
                label: t('controls.undo.title'),
                content: (
                    <div className="space-y-3">
                        <p className="text-xs text-white/60">{t('controls.undo.loading')}</p>
                    </div>
                )
            });
        } else if (!undoState.isGameOver && undoStatus === 'canReview') {
            items.push({
                id: 'undo-review',
                icon: <MessageSquareWarning size={20} className="text-amber-400 animate-pulse" />,
                label: t('controls.undo.opponentRequest'),
                active: true,
                content: (
                    <div className="flex flex-col gap-3">
                        <div className="text-sm font-bold text-amber-400 border-b border-white/10 pb-2">
                            {t('controls.undo.opponentRequest')}
                        </div>
                        <p className="text-xs text-white/80">{t('controls.undo.reviewHint')}</p>
                        <div className="flex gap-2">
                            <button onClick={() => undoState.dispatch(UNDO_COMMANDS.APPROVE_UNDO)} className="flex-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 border border-green-500/50 rounded px-3 py-2 text-xs font-bold transition-colors">
                                {t('controls.undo.approve')}
                            </button>
                            <button onClick={() => undoState.dispatch(UNDO_COMMANDS.REJECT_UNDO)} className="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/50 rounded px-3 py-2 text-xs font-bold transition-colors">
                                {t('controls.undo.reject')}
                            </button>
                        </div>
                    </div>
                )
            });
        } else if (!undoState.isGameOver && (undoStatus === 'canRequest' || undoStatus === 'isRequester')) {
            const isWaiting = undoStatus === 'isRequester';
            items.push({
                id: 'undo-request',
                icon: <Undo2 size={20} className={isWaiting ? 'animate-spin-reverse opacity-50' : ''} />,
                label: isWaiting ? t('controls.undo.waiting') : t('controls.undo.request'),
                color: isWaiting ? 'text-amber-400' : undefined,
                content: (
                    <div className="space-y-3">
                        <p className="text-xs text-white/70">
                            {isWaiting ? t('controls.undo.waiting') : t('controls.undo.requestHint')}
                        </p>
                        <button
                            onClick={() => {
                                if (isWaiting) undoState.dispatch(UNDO_COMMANDS.CANCEL_UNDO);
                                else undoState.dispatch(UNDO_COMMANDS.REQUEST_UNDO);
                            }}
                            className={`w-full py-2 rounded font-bold text-xs transition-colors ${isWaiting
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50 hover:bg-amber-500/40'
                                : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
                                }`}
                        >
                            {isWaiting ? t('controls.undo.cancel') : t('controls.undo.request')}
                        </button>
                    </div>
                )
            });
        } else if (!undoState.isGameOver) {
            items.push({
                id: 'undo-idle',
                icon: <Undo2 size={20} className="opacity-60" />,
                label: t('controls.undo.title'),
                content: (
                    <div className="space-y-3">
                        <p className="text-xs text-white/60">{t('controls.undo.none')}</p>
                    </div>
                )
            });
        }
    }

    // 7. 操作日志
    if (useChatAsMain) {
        items.push(actionLogAction);
    }

    // ===== 本地模式卫星按钮顺序 =====
    if (!useChatAsMain) {
        items.push(settingsAction);
        items.push(actionLogAction);
    }

    return (
        <>
            <FabMenu
                isDark={true}
                items={items}
                position="bottom-right"
                zIndex={UI_Z_INDEX.overlayRaised}
            />

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
            {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
        </>
    );
};
