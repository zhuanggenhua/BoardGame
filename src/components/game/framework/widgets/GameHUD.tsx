import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    LogOut,
    Trash2,
    Monitor,
    Copy,
    Check,
    AlertTriangle,
    MessageSquare,
    Undo2,
    Settings,
    Maximize,
    Minimize,
    MessageSquareWarning,
    Users,
    ListOrdered,
    ArrowLeftRight,
    Moon,
    Sun,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUndo, useUndoStatus } from '../../../../contexts/UndoContext';
import { HudPortal } from '../../../../core';
import { FabMenu, type FabAction, type FabMenuPosition } from '../../../system/FabMenu';
import { UNDO_COMMANDS } from '../../../../engine';
import type { ManualForceEndAiPhaseResult } from '../../../../engine/transport/protocol';
import { AudioControlSection } from './AudioControlSection';
import { AboutModal } from '../../../system/AboutModal';
import { FeedbackModal } from '../../../system/FeedbackModal';
import { useToast } from '../../../../contexts/ToastContext';
import { useAuth } from '../../../../contexts/AuthContext';
import { matchSocket, type MatchEmoteEvent } from '../../../../services/matchSocket';
import type { EmoteDefinition } from '../../../../shared/emotes';
import { useModalStack } from '../../../../contexts/ModalStackContext';
import { FriendsChatModal } from '../../../social/FriendsChatModal';
import { useOptionalSocial } from '../../../../contexts/SocialContext';
import {
    buildActionLogRows,
    createStateBackedActionLogPlayerLabel,
} from '../../utils/actionLogFormat';
import { ActionLogSegments } from './ActionLogSegments';
import { getCardPreviewGetter, getCardPreviewMaxDim } from '../../registry/cardPreviewRegistry';
import { copyToClipboard } from '../../../../lib/utils';
import { OpponentOfflineBanner } from './OpponentOfflineBanner';
import { isNativeAndroidRuntime } from '../../../../lib/mobile/androidRuntime';
import { MatchChatPanel } from './MatchChatPanel';
import { useMatchChat } from './useMatchChat';
import { SeatEmoteOverlay } from './SeatEmoteOverlay';
import type { GameOrientationPreference } from '../../../../shared/gameManifest.types';
import { toggleDocumentFullscreen } from '../../../../lib/webFullscreen';
import {
    MAGE_WARS_GAME_HUD_FAB_STORAGE_KEY,
    resolveMageWarsGameHudFabInitialOffset,
} from '../../../../games/mage-wars/layout';
import { useRuntimeViewport } from '../../../../hooks/ui/useRuntimeViewport';
import { MOBILE_MAX_VIEWPORT_WIDTH } from '../../../../shared/mobileSupport';
import {
    applySystemDisplayThemeToDocument,
    persistSystemDisplayThemePreference,
    readSystemDisplayThemePreference,
    subscribeSystemDisplayThemeChange,
    type SystemDisplayTheme,
} from '../../../system/systemDisplayTheme';
import {
    buildGameHudFeedbackActionLog,
    buildGameHudFeedbackStateSnapshot,
    GAME_HUD_FAB_Z_INDEX,
    resolveGameHudPhase,
    type HudPhaseStateLike,
} from './gameHudModel';

interface GameHUDProps {
    mode: 'local' | 'online' | 'tutorial' | 'test';
    matchId?: string;
    gameId?: string;
    localModeLabel?: string;
    isHost?: boolean;
    credentials?: string;
    myPlayerId?: string | null;
    opponentName?: string | null;
    opponentConnected?: boolean;
    presenceReady?: boolean;
    players?: Array<{
        id: number;
        name?: string;
        isConnected?: boolean;
    }>;
    onLeave?: () => void;
    onDestroy?: () => void;
    onForceExit?: () => void;
    showForceEndAiPhase?: boolean;
    onForceEndAiPhase?: () => (
        | boolean
        | void
        | ManualForceEndAiPhaseResult
        | Promise<boolean | void | ManualForceEndAiPhaseResult>
    );
    showForceDismissPopup?: boolean;
    onForceDismissPopup?: () => boolean | void | Promise<boolean | void>;
    showSeatSwap?: boolean;
    seatSwapActionLabel?: string;
    seatSwapActionActive?: boolean;
    seatSwapActionColor?: string;
    onSeatSwapClick?: () => void;
    seatSwapContent?: FabAction['content'];
    isPregameSetupPhase?: boolean;
    isLoading?: boolean;
    preferredFullscreenOrientation?: GameOrientationPreference;
    renderRuntimeSettings?: (t: TFunction) => ReactNode;
    availableEmotes?: readonly EmoteDefinition[];
    resolveEmote?: (emoteId: string) => EmoteDefinition | undefined;
    /**
     * 主 HUD 的坐标归属。固定牌桌必须放在壳内，避免和 board-shell
     * 产生第二套真实视口定位；独立页面默认继续使用 portal。
     */
    hudPlacement?: 'in-shell' | 'portal';
}

const EMPTY_EMOTES: readonly EmoteDefinition[] = [];

const MAGE_WARS_GAME_HUD_FAB_POSITION: FabMenuPosition = 'top-left';
const MAGE_WARS_GAME_HUD_FAB_LEGACY_OFFSET_STORAGE_KEY = 'game_hud_fab_offset:mage-wars';

export const GameHUD = ({
    mode,
    matchId,
    gameId: _gameId,
    localModeLabel,
    isHost,
    credentials,
    myPlayerId,
    opponentName,
    opponentConnected,
    presenceReady,
    players,
    onLeave,
    onDestroy,
    onForceExit,
    showForceEndAiPhase,
    onForceEndAiPhase,
    showForceDismissPopup,
    onForceDismissPopup,
    showSeatSwap,
    seatSwapActionLabel,
    seatSwapActionActive,
    seatSwapActionColor,
    onSeatSwapClick,
    seatSwapContent,
    isPregameSetupPhase,
    isLoading = false,
    preferredFullscreenOrientation,
    renderRuntimeSettings,
    availableEmotes = EMPTY_EMOTES,
    resolveEmote,
    hudPlacement = 'portal',
}: GameHUDProps) => {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation('game');
    const toast = useToast();
    const { user } = useAuth();
    const { width: viewportWidth, height: viewportHeight } = useRuntimeViewport({ syncCssVars: false });

    // 从注册表获取游戏特定的卡牌预览函数
    const getCardPreviewRef = useMemo(() => {
        return _gameId ? getCardPreviewGetter(_gameId) : undefined;
    }, [_gameId]);

    const cardPreviewMaxDim = useMemo(() => {
        return _gameId ? getCardPreviewMaxDim(_gameId) : undefined;
    }, [_gameId]);

    const locale = i18n.language;
    const { stack, openModal, closeModal, closeTop } = useModalStack();
    const optionalSocial = useOptionalSocial();
    const unreadTotal = optionalSocial?.unreadTotal ?? 0;
    const requests = optionalSocial?.requests ?? [];
    const ensureRealtimeConnection = optionalSocial?.ensureRealtimeConnection ?? (() => undefined);
    const [copied, setCopied] = useState(false);
    const [isForceEndingAiPhase, setIsForceEndingAiPhase] = useState(false);
    const [isForceDismissingPopup, setIsForceDismissingPopup] = useState(false);
    const [displayTheme, setDisplayTheme] = useState<SystemDisplayTheme>(() => readSystemDisplayThemePreference());
    const isNightDisplayTheme = displayTheme === 'night';

    // 撤回状态
    const undoState = useUndo();
    const { status: undoStatus, hasNotification: _hasUndoNotification } = useUndoStatus();
    const currentPlayerId = (undoState?.G?.core as Record<string, unknown>)?.currentPlayer as string | undefined;

    const isOnline = mode === 'online';
    const isLocal = mode === 'local';
    const isTutorial = mode === 'tutorial';
    const undoRequestPayload = undoState?.isLocalMode ? { localAutoApprove: true } : undefined;
    const isNativeAndroid = isNativeAndroidRuntime();
    const isSpectator = isOnline && (myPlayerId === null || myPlayerId === undefined);
    const isSetupPhase = isPregameSetupPhase
        ?? resolveGameHudPhase(undoState?.G as HudPhaseStateLike | null | undefined) === 'setup';
    const isBetrayalGame = _gameId === 'betrayal';
    const isTicTacToePortraitMobile = _gameId === 'tictactoe'
        && viewportWidth > 0
        && viewportWidth <= MOBILE_MAX_VIEWPORT_WIDTH
        && viewportHeight > viewportWidth;
    const isBetrayalCharacterSelect = isBetrayalGame &&
        ((undoState?.G as { core?: { phase?: unknown } } | null | undefined)?.core?.phase === 'characterSelect');
    // Betrayal 选角阶段的确认区占用右下角，悬浮菜单必须让位；进入牌桌后恢复右下角基线。
    const fabMenuPosition: FabMenuPosition = _gameId === 'mage-wars'
        ? MAGE_WARS_GAME_HUD_FAB_POSITION
        : isTicTacToePortraitMobile
            ? 'top-right'
        : isBetrayalGame
            ? (isSetupPhase || isBetrayalCharacterSelect ? 'top-right' : 'bottom-right')
            : 'bottom-right';
    const fabMenuStorageKey = _gameId === 'mage-wars'
        ? MAGE_WARS_GAME_HUD_FAB_STORAGE_KEY
        : isTicTacToePortraitMobile
            ? 'game_hud_fab_position:tictactoe:portrait:v1'
        : isBetrayalGame
            ? 'game_hud_fab_position:betrayal:v2'
            : _gameId === 'fate-domination' ? 'game_hud_fab_position:fate-domination:v2' : undefined;
    const fabMenuLegacyOffsetStorageKey = _gameId === 'mage-wars'
        ? MAGE_WARS_GAME_HUD_FAB_LEGACY_OFFSET_STORAGE_KEY
        : undefined;

    const [localChatEmotes, setLocalChatEmotes] = useState<MatchEmoteEvent[]>([]);
    const [seatEmoteEvents, setSeatEmoteEvents] = useState<MatchEmoteEvent[]>([]);
    const canUseSeatEmotes = isOnline && !isSpectator && !isSetupPhase && !!matchId && !!myPlayerId && availableEmotes.length > 0;
    const resolveHudEmote = useCallback((emoteId: string) => (
        resolveEmote?.(emoteId) ?? availableEmotes.find((emote) => emote.id === emoteId)
    ), [availableEmotes, resolveEmote]);

    const myDisplayName = useMemo(() => {
        if (user?.username) return user.username;
        const matched = players?.find((p) => String(p.id) === String(myPlayerId));
        return matched?.name ?? (myPlayerId != null
            ? t('hud.status.player', { id: myPlayerId })
            : t('hud.chat.spectator'));
    }, [myPlayerId, players, t, user?.username]);

    const playerNameMap = useMemo(() => {
        const map = new Map<string, string>();
        players?.forEach((player) => {
            if (player.name) map.set(String(player.id), player.name);
        });
        return map;
    }, [players]);
    const getStateActionLogPlayerLabel = useMemo(
        () => createStateBackedActionLogPlayerLabel(undoState?.G, () => ''),
        [undoState?.G],
    );

    const getActionLogPlayerLabel = useCallback((playerId: string | number) => {
        const normalizedId = String(playerId);
        const knownName = playerNameMap.get(normalizedId);
        if (knownName) return knownName;
        if (myPlayerId != null && normalizedId === String(myPlayerId) && myDisplayName) return myDisplayName;
        const stateName = getStateActionLogPlayerLabel(normalizedId);
        if (stateName) return stateName;
        return t('hud.status.player', { id: normalizedId });
    }, [getStateActionLogPlayerLabel, myPlayerId, myDisplayName, playerNameMap, t]);

    const getActionLogCharacterId = useCallback((playerId: string | number): string | undefined => {
        const state = undoState?.G as { core?: { players?: Record<string, { characterId?: unknown }> } } | null | undefined;
        const rawCharacterId = state?.core?.players?.[String(playerId)]?.characterId;
        return typeof rawCharacterId === 'string' && rawCharacterId !== 'unselected'
            ? rawCharacterId
            : undefined;
    }, [undoState?.G]);

    const actionLogRows = useMemo(() => {
        const entries = undoState?.G?.sys?.actionLog?.entries ?? [];
        return buildActionLogRows(entries, { getPlayerLabel: getActionLogPlayerLabel });
    }, [getActionLogPlayerLabel, undoState?.G?.sys?.actionLog?.entries]);

    const chat = useMatchChat({ isOnline, matchId, playerId: myPlayerId, credentials, displayName: myDisplayName });
    const unreadChatCount = chat.unreadTotal;
    const latestIncomingMessage = chat.latestIncoming;

    useEffect(() => {
        if (!canUseSeatEmotes || !matchId || !myPlayerId) return;

        matchSocket.joinEmotes(matchId, String(myPlayerId));
        const unsubscribe = matchSocket.subscribeEmote((event) => {
            if (event.matchId !== matchId) return;
            if (myPlayerId != null && String(event.playerId) === String(myPlayerId)) return;
            setSeatEmoteEvents((prev) => [...prev.slice(-19), event]);
        });

        return () => {
            unsubscribe();
            matchSocket.leaveEmotes();
        };
    }, [canUseSeatEmotes, matchId, myPlayerId]);

    const handleSendEmote = useCallback((emoteId: string) => {
        const selfEmoteEvent: MatchEmoteEvent | null = matchId && myPlayerId != null
            ? {
                matchId,
                playerId: String(myPlayerId),
                emoteId,
                createdAt: new Date().toISOString(),
            }
            : null;
        const handleRejected = (reason?: string) => {
            if (selfEmoteEvent) {
                setLocalChatEmotes((prev) => prev.filter((event) => event.createdAt !== selfEmoteEvent.createdAt));
            }
            if (reason === 'rate_limited') {
                toast.info(t('hud.emotes.rateLimited'));
            } else if (reason === 'invalid_emote') {
                toast.warning(t('hud.emotes.invalid'));
            } else if (reason && reason !== 'not_connected') {
                toast.info(t('hud.emotes.sendFailed'));
            }
        };
        if (selfEmoteEvent) {
            setLocalChatEmotes((prev) => [...prev.slice(-9), selfEmoteEvent]);
        }
        const result = matchSocket.sendEmote(emoteId, (response) => {
            if (response.ok) return;
            handleRejected(response.reason);
        });
        if (!result.ok) {
            if (selfEmoteEvent) {
                setLocalChatEmotes((prev) => prev.filter((event) => event.createdAt !== selfEmoteEvent.createdAt));
            }
            if (result.reason === 'not_connected') {
                toast.error(t('hud.emotes.notConnected'));
            } else {
                if (matchId && myPlayerId != null) matchSocket.joinEmotes(matchId, String(myPlayerId));
                toast.info(t('hud.emotes.connecting'));
            }
        }
    }, [matchId, myPlayerId, t, toast]);

    // 全屏状态
    const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);

    const toggleDisplayTheme = () => {
        const nextTheme = displayTheme === 'night' ? 'light' : 'night';
        persistSystemDisplayThemePreference(nextTheme);
        setDisplayTheme(nextTheme);
    };

    const toggleFullscreen = async () => {
        const result = await toggleDocumentFullscreen({
            preferredOrientation: preferredFullscreenOrientation,
        });

        if (result.ok) {
            setIsFullscreen(result.state === 'entered');
            if (result.state === 'entered' && preferredFullscreenOrientation && !result.orientationLocked) {
                toast.info(t('hud.fullscreen.orientationLockUnavailable'));
            }
            return;
        }

        if (result.reason === 'ios-web-limited') {
            toast.info(t('hud.fullscreen.iosLimited'));
            return;
        }

        toast.error(t(
            result.reason === 'exit-failed'
                ? 'hud.fullscreen.exitFailed'
                : 'hud.fullscreen.enterFailed',
        ));
    };

    useEffect(() => {
        const handleFS = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFS);
        return () => document.removeEventListener('fullscreenchange', handleFS);
    }, []);

    useEffect(() => {
        applySystemDisplayThemeToDocument(displayTheme);
    }, [displayTheme]);

    useEffect(() => {
        return subscribeSystemDisplayThemeChange((nextTheme) => {
            setDisplayTheme(nextTheme);
        });
    }, []);

    const copyRoomId = () => {
        if (matchId) {
            void copyToClipboard(matchId);
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
        mobilePopoverVerticalAnchor: 'column',
        content: (
            <div className="flex flex-col gap-2 pr-0.5 sm:pr-1">
                {actionLogRows.length === 0 ? (
                    <div className="text-xs text-white/40 text-center py-6">
                        {t('hud.actionLog.empty')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {actionLogRows.map((row) => (
                            <div key={row.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5" data-testid="hud-action-log-row">
                                <div className="flex flex-col gap-1 text-[10px] text-white/50 sm:flex-row sm:items-center sm:justify-between" data-testid="hud-action-log-meta">
                                    <span className="font-mono leading-none">{row.timeLabel}</span>
                                    <span className="font-semibold leading-tight text-white/70 break-words sm:max-w-[10rem] sm:text-right">{row.playerLabel}</span>
                                </div>
                                <div className="mt-1.5 break-words text-xs leading-relaxed text-white/90">
                                    <ActionLogSegments
                                        segments={row.segments}
                                        locale={locale}
                                        playerId={row.actorId}
                                        characterId={getActionLogCharacterId(row.actorId)}
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
    // 在线/教程模式：聊天为主按钮
    // 本地模式：无聊天主按钮，设置按钮应作为离主球最近的第一个卫星按钮
    const useChatAsMain = isOnline || isTutorial;
    const canForceEndAiPhase = Boolean(showForceEndAiPhase && onForceEndAiPhase);
    const topModalId = stack[stack.length - 1]?.id ?? null;
    const hasLocalClosableForegroundUi = Boolean(showAbout || showFeedback || socialModalId || stack.length > 0);
    const canForceDismissPopup = Boolean(showForceDismissPopup || onForceDismissPopup || hasLocalClosableForegroundUi);
    const handleForceEndAiPhaseClick = useCallback(async (closePanel: () => void) => {
        if (!onForceEndAiPhase || isForceEndingAiPhase) {
            return;
        }
        setIsForceEndingAiPhase(true);
        try {
            const result = await onForceEndAiPhase();
            const accepted = typeof result === 'object' && result !== null
                ? result.accepted
                : result !== false;
            if (accepted) {
                closePanel();
                return;
            }

            const reason = typeof result === 'object' && result !== null ? result.reason : undefined;
            const message = reason === 'busy'
                ? t('hud.ai.forceEndPhaseBusy')
                : reason === 'unavailable'
                    ? t('hud.ai.forceEndPhaseUnavailable')
                    : reason === 'unauthorized'
                        ? t('hud.ai.forceEndPhaseUnauthorized')
                        : reason === 'timeout'
                            ? t('hud.ai.forceEndPhaseTimeout')
                            : reason === 'not-connected'
                                ? t('hud.ai.forceEndPhaseNotReady')
                                : reason === 'rejected'
                                    ? t('hud.ai.forceEndPhaseRejected')
                                    : t('hud.ai.forceEndPhaseFailed', {
                                        reason: t('hud.ai.forceEndPhaseNotReady'),
                                    });
            toast.warning(message);
        } finally {
            setIsForceEndingAiPhase(false);
        }
    }, [isForceEndingAiPhase, onForceEndAiPhase, t, toast]);
    const handleForceDismissPopupClick = useCallback(async (closePanel: () => void) => {
        if (isForceDismissingPopup) {
            return;
        }

        setIsForceDismissingPopup(true);
        try {
            let handled = false;
            if (onForceDismissPopup) {
                const result = await onForceDismissPopup();
                handled = result !== false;
            }

            if (!handled) {
                if (topModalId) {
                    if (socialModalId && topModalId === socialModalId) {
                        closeModal(socialModalId);
                    } else {
                        closeTop();
                    }
                    handled = true;
                } else if (showFeedback) {
                    setShowFeedback(false);
                    handled = true;
                } else if (showAbout) {
                    setShowAbout(false);
                    handled = true;
                }
            }

            if (handled) {
                closePanel();
                return;
            }

            toast.info(t('hud.ai.forceDismissPopupUnavailable'));
        } finally {
            setIsForceDismissingPopup(false);
        }
    }, [
        closeModal,
        closeTop,
        isForceDismissingPopup,
        onForceDismissPopup,
        showAbout,
        showFeedback,
        socialModalId,
        topModalId,
        t,
        toast,
    ]);

    if (useChatAsMain) {
        // [0] 聊天（主按钮）
        items.push({
            id: 'chat',
            mobilePopoverVerticalAnchor: viewportHeight < 480 ? 'viewport' : 'button',
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
            onActivate: chat.onOpenChange,
            content: (
                <MatchChatPanel
                    chat={chat} isOnline={isOnline} isSpectator={isSpectator} matchId={matchId}
                    players={players} myPlayerId={myPlayerId} myDisplayName={myDisplayName}
                    emotes={availableEmotes} resolveEmote={resolveHudEmote} canUseEmotes={canUseSeatEmotes}
                    localEmotes={localChatEmotes} onSendEmote={handleSendEmote}
                />
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
                                {localModeLabel ?? t('hud.mode.local')}
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
                    </div>
                )}

                {renderRuntimeSettings?.(t)}

                <AudioControlSection isDark={true} />
            </div>
        )
    };

    // ===== 联机模式卫星按钮顺序 =====
    // 注意：FabMenu 会 reverse(items.slice(1)) 后再渲染卫星按钮，
    // 所以这里的 push 顺序与最终视觉顺序相反。
    // 目标视觉顺序（从外向内）：退出 → 反馈 → 社交 → 全屏(非 App) → 撤回
    // → 强制结束 AI 当前阶段 → 换位 → 操作日志 → 设置 → 聊天(主按钮)

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
                        <div className="min-w-0 flex-1 text-left flex flex-col items-start">
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
                                        <div className="min-w-0 flex-1 text-left flex flex-col items-start">
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
                                        <div className="min-w-0 flex-1 text-left flex flex-col items-start">
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
                                    <div className="min-w-0 flex-1 text-left flex flex-col items-start">
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
                                <div className="min-w-0 flex-1 text-left flex flex-col items-start">
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
                ensureRealtimeConnection();
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

    // 4. 全屏（App 运行时隐藏）
    if (!isNativeAndroid) {
        items.push({
            id: 'fullscreen',
            icon: isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />,
            label: isFullscreen ? t('hud.actions.exitFullscreen') : t('hud.actions.fullscreen'),
            onClick: toggleFullscreen,
        });
    }

    // 4.5 夜间模式
    items.push({
        id: 'display-theme',
        icon: isNightDisplayTheme ? <Sun size={20} /> : <Moon size={20} />,
        label: isNightDisplayTheme ? t('hud.actions.lightMode') : t('hud.actions.nightMode'),
        active: isNightDisplayTheme,
        onClick: toggleDisplayTheme,
    });

    // 5. 撤回：setup/选角阶段不展示，避免移动端 FAB 轨道挤占选角与换位入口。
    if (!isSpectator && !isSetupPhase) {
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
                                else undoState.dispatch(UNDO_COMMANDS.REQUEST_UNDO, undoRequestPayload);
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

    // 5.5 强制操作（将强制结束 AI / 强制去弹窗合并到一个展开面板）
    // 注意：这里要放在撤回之后 push，反转渲染后才会出现在“撤回上面”。
    const canShowForceActionsItem = canForceEndAiPhase || (!isSetupPhase && canForceDismissPopup);
    const forceActionsItem: FabAction | null = canShowForceActionsItem
        ? {
            id: 'force-actions',
            icon: <AlertTriangle size={20} />,
            label: canForceEndAiPhase && canForceDismissPopup
                ? t('hud.ai.forceEndPhase')
                : canForceEndAiPhase
                    ? t('hud.ai.forceEndPhase')
                    : t('hud.ai.forceDismissPopup'),
            color: canForceEndAiPhase ? 'text-amber-400' : 'text-rose-300',
            mobilePanelVariant: canForceEndAiPhase ? 'sheet' : undefined,
            content: ({ closePanel }) => (
                <div className="space-y-3">
                    {canForceEndAiPhase && (
                        <div className="space-y-3 rounded-md border border-amber-500/20 bg-amber-500/5 p-3">
                            <p className="text-xs font-bold text-amber-300">
                                {t('hud.ai.forceEndPhase')}
                            </p>
                            <p className="text-xs text-white/70">
                                {t('hud.ai.forceEndPhaseHint')}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleForceEndAiPhaseClick(closePanel);
                                }}
                                disabled={isForceEndingAiPhase}
                                className={`w-full rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
                                    isForceEndingAiPhase
                                        ? 'cursor-wait border-amber-500/25 bg-amber-500/10 text-amber-200/70'
                                        : 'border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
                                }`}
                                data-testid="hud-force-end-ai-phase"
                            >
                                {isForceEndingAiPhase
                                    ? t('hud.ai.forceEndPhaseSubmitting')
                                    : t('hud.ai.forceEndPhaseConfirm')}
                            </button>
                        </div>
                    )}

                    {canForceDismissPopup && (
                        <div className="space-y-3 rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                            <p className="text-xs font-bold text-rose-200">
                                {t('hud.ai.forceDismissPopup')}
                            </p>
                            <p className="text-xs text-white/70">
                                {t('hud.ai.forceDismissPopupHint')}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    void handleForceDismissPopupClick(closePanel);
                                }}
                                disabled={isForceDismissingPopup}
                                className={`w-full rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
                                    isForceDismissingPopup
                                        ? 'cursor-wait border-rose-500/25 bg-rose-500/10 text-rose-100/70'
                                        : 'border-rose-500/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25'
                                }`}
                                data-testid="hud-force-dismiss-popup"
                            >
                                {isForceDismissingPopup
                                    ? t('hud.ai.forceDismissPopupSubmitting')
                                    : t('hud.ai.forceDismissPopupConfirm')}
                            </button>
                        </div>
                    )}
                </div>
            ),
        }
        : null;
    if (forceActionsItem) {
        items.push(forceActionsItem);
    }

    // 5.6 换位（位于操作日志与强制操作之间）
    if (showSeatSwap && (seatSwapContent || onSeatSwapClick)) {
        items.push({
            id: 'seat-swap',
            icon: <ArrowLeftRight size={20} />,
            label: seatSwapActionLabel ?? t('hud.actions.seatSwap'),
            mobilePopoverVerticalAnchor: 'column',
            active: seatSwapActionActive,
            color: seatSwapActionColor,
            onClick: onSeatSwapClick,
            content: seatSwapContent,
        });
    }

    // 6. 操作日志
    if (useChatAsMain && !isSetupPhase) {
        items.push(actionLogAction);
    }

    // 7. 设置（联机/教程模式中紧贴聊天主按钮）
    if (useChatAsMain) {
        items.push(settingsAction);
    }

    // ===== 本地模式卫星按钮顺序 =====
    if (!useChatAsMain) {
        items.push(actionLogAction);
        items.push(settingsAction);
    }

    const hudContent = (
        <>
            {/* 对手状态提示（仅联机模式，加载完成后） */}
            {isOnline
                && !isSpectator
                && !isLoading
                && (presenceReady ?? opponentConnected !== undefined)
                && opponentConnected !== undefined
                && isSetupPhase && (
                <OpponentOfflineBanner
                    connected={opponentConnected}
                    name={opponentName}
                />
            )}
            <SeatEmoteOverlay events={seatEmoteEvents} resolveEmote={resolveHudEmote} />

            <FabMenu
                isDark={true}
                items={items}
                position={fabMenuPosition}
                initialOffset={_gameId === 'mage-wars'
                    ? resolveMageWarsGameHudFabInitialOffset(viewportHeight)
                    : isTicTacToePortraitMobile
                        // 放在标题与棋盘之间的空档，避免闭合态悬浮球压住棋盘格。
                        ? { top: Math.max(0, Math.min(64, viewportHeight * 0.075)) }
                    : _gameId === 'fate-domination'
                        ? { left: 64, top: -120 }
                        : undefined}                zIndex={GAME_HUD_FAB_Z_INDEX}
                storageKey={fabMenuStorageKey}
                legacyOffsetStorageKey={fabMenuLegacyOffsetStorageKey}
                hudPlacement={hudPlacement}
            />

            {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
            {showFeedback && (
                <FeedbackModal
                    onClose={() => setShowFeedback(false)}
                    runtimeContext={{
                        mode: mode === 'test' ? 'local' : mode,
                        matchId,
                        playerId: myPlayerId,
                        gameId: _gameId,
                    }}
                    actionLogText={(() => {
                        const G = undoState?.G;
                        if (!G) return undefined;
                        return buildGameHudFeedbackActionLog(G, actionLogRows);
                    })()}
                    stateSnapshot={(() => {
                        const G = undoState?.G;
                        if (!G) return undefined;
                        return buildGameHudFeedbackStateSnapshot(G);
                    })()}
                />
            )}
        </>
    );

    return hudPlacement === 'in-shell' ? hudContent : <HudPortal>{hudContent}</HudPortal>;
};
