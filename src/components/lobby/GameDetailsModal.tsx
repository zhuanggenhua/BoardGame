import { useRef, useState, useEffect, useMemo, useCallback, useEffectEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { AlertTriangle, Download, HardDriveDownload, Info, LoaderCircle, RefreshCw, TableProperties, X } from 'lucide-react';
import * as matchApi from '../../services/matchApi';
import { getLocalMatchPreferences, updateLocalMatchPreferences } from '../../api/user-settings';
import { useAuth } from '../../contexts/AuthContext';
import { lobbySocket, type LobbyMatch } from '../../services/lobbySocket';
import { claimSeat, exitMatch, getOwnerActiveMatch, setOwnerActiveMatch, clearOwnerActiveMatch, isOwnerActiveMatchSuppressed, suppressOwnerActiveMatch, clearMatchCredentials, readStoredMatchCredentials, listStoredMatchCredentials, getLatestStoredMatchCredentials, pruneStoredMatchCredentials, persistAiSeatCredentials, persistMatchCredentials, isMatchNotFoundError } from '../../hooks/match/useMatchStatus';
import { getOrCreateGuestId, getGuestName as resolveGuestName, getOwnerKey as resolveOwnerKey, getOwnerType as resolveOwnerType } from '../../hooks/match/ownerIdentity';
import { ConfirmModal } from '../common/overlays/ConfirmModal';
import { ModalBase } from '../common/overlays/ModalBase';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useToast } from '../../contexts/ToastContext';
import { GAME_SERVER_URL } from '../../config/server';
import { getGameById } from '../../config/games.config';
import { getGameConfigReviewPath, hasGameConfigReview } from '../../config/gameConfigReviewRoutes';
import { CreateRoomModal, type RoomConfig } from './CreateRoomModal';
import { GameReviews } from '../review/GameReviewSection';
import { PasswordEntryModal } from '../common/overlays/PasswordEntryModal';
import { normalizeGameName, shouldPromptExitActiveMatch, resolveActiveMatchExitPayload, notifyExitMatchErrorToast, buildCreateRoomErrorTip, resolveCreateRoomErrorCode, resolveCreateRoomErrorStatus, type Room } from './roomActions';
import { RoomList } from './RoomList';
import { LeaderboardTab } from './LeaderboardTab';
import type { LeaderboardEntry } from './leaderboardTypes';
import { GameDetailsChangelogSection } from './GameDetailsChangelogSection';
import { GameDetailsMobilePackageCard } from './GameDetailsMobilePackageCard';
import { GamePackageInstallConfirmModal } from './GamePackageInstallConfirmModal';
import { resolveGameAuthorName, resolveGameDescription, resolveGameDisplayName } from './gameDetailsContent';
import { logger } from '../../lib/logger';
import { logMobileRuntimeCritical } from '../../lib/mobile/mobileRuntimeDebug';
import { appendMatchLoadTrace, startMatchLoadTrace } from '../../lib/matchLoadTrace';
import { UI_Z_INDEX, preloadWarmImages, resolveCriticalImages } from '../../core';
import { ensureGameCriticalImageResolverLoaded, hasGameTutorialLoader, prefetchGameImplementation } from '../../games/registry';
import {
    normalizeLocalMatchPreferences,
    readStoredLocalMatchPreferences,
    stripAiSeatsFromLocalMatchPreferences,
    writeLocalMatchPreferences,
    type LocalMatchPreferences,
} from '../../engine/ai';
import { LoadingScreen } from '../system/LoadingScreen';
import { useGamePackageState } from '../../features/mobile-packages/useGamePackageState';
import {
    hasUsableInstalledGamePackageState,
    hasUsableInstalledGamePackageVersion,
} from '../../features/mobile-packages/types';
import { isNativeAndroidRuntime } from '../../lib/mobile/androidRuntime';
import { requestAndroidNativeUpdateCheck } from '../../lib/mobile/androidNativeUpdates';
import { prefetchOnlineMatchRoute } from '../../lib/prefetchPlayRoute';


interface GameDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
    titleKey: string;
    descriptionKey: string;
    thumbnail: ReactNode;
    closeOnBackdrop?: boolean;
    /** 导航前调用，通知父组件不要清理地址参数 */
    onNavigate?: () => void;
}

type PendingRoomAction = {
    matchID: string;
    myPlayerID: string;
    myCredentials: string | undefined;
    isHost: boolean;
};

type PendingForceReplaceCreate = {
    config: RoomConfig;
    existingMatchID: string;
    existingGameName: string;
};

type MatchEntryLoadingPhase = 'creating' | 'joining';
const LOBBY_CONNECT_ERROR_TOAST_DELAY_MS = 1500;
const lastLoggedPackageStateByGame = new Map<string, string>();

export function __resetGameDetailsModalPackageStateLogForTests(): void {
    lastLoggedPackageStateByGame.clear();
}

const formatInstalledPackageVersionForTitle = (value: string | undefined): string => {
    const normalized = value?.trim() ?? '';
    if (!normalized) return '';

    const semverMatch = normalized.match(/\d+\.\d+\.\d+/);
    if (semverMatch) {
        return semverMatch[0];
    }

    const dateVersionMatch = normalized.match(/\d{4}\.\d{2}\.\d{2}/);
    if (dateVersionMatch) {
        return dateVersionMatch[0];
    }

    const genericVersionMatch = normalized.match(/v?\d+(?:\.\d+){0,2}/i);
    if (genericVersionMatch) {
        return genericVersionMatch[0];
    }

    return normalized.length > 8 ? `${normalized.slice(0, 8)}…` : normalized;
};

export const GameDetailsModal = ({ isOpen, onClose, gameId, titleKey, descriptionKey, thumbnail, closeOnBackdrop, onNavigate }: GameDetailsModalProps) => {
    const navigate = useNavigate();
    const modalRef = useRef<HTMLDivElement>(null);
    const activeMatchCheckRef = useRef<string | null>(null);
    const { user, token } = useAuth();
    const { t, i18n } = useTranslation(['lobby', 'common']);
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const confirmModalIdRef = useRef<string | null>(null);
    const confirmJoinModalIdRef = useRef<string | null>(null);
    const forceReplaceCreateModalIdRef = useRef<string | null>(null);
    const normalizedGameId = normalizeGameName(gameId);
    const gameManifest = getGameById(gameId);
    const gameDisplayName = resolveGameDisplayName(gameManifest ?? { id: gameId, titleKey }, t, gameId);
    const gameDescription = resolveGameDescription(gameManifest ?? { descriptionKey }, t, descriptionKey);
    const gameAuthorName = resolveGameAuthorName(gameManifest);
    const gameAuthorLabel = t('authorInfo.button', { author: gameAuthorName });
    const gameAuthorMobileLabel = t('authorInfo.mobileButton', { author: gameAuthorName });
    const gameAuthorButtonHint = t('authorInfo.buttonHint');
    const isNativeAndroidCapacitorRuntime = isNativeAndroidRuntime();
    const {
        isPackageManaged: isPackageManagedMobileGame,
        cardState: packageInstallCardState,
        pendingInstall: pendingPackageInstall,
        isConfirmingInstall: isConfirmingPackageInstall,
        requestInstall: requestGamePackageInstall,
        dismissInstall: dismissGamePackageInstall,
        cancelInstall: cancelGamePackageInstall,
        uninstallInstall: uninstallGamePackageInstall,
        confirmInstall: confirmGamePackageInstall,
        retryInstall: retryGamePackageInstall,
        notificationPermissionAction: packageNotificationPermissionAction,
        openNotificationSettings: openGamePackageNotificationSettings,
    } = useGamePackageState({
        gameId,
        gameName: gameDisplayName,
        delivery: gameManifest?.mobileDelivery,
        enabled: isNativeAndroidCapacitorRuntime,
    });
    const isAppUpdateRequiredForMobileGame = isPackageManagedMobileGame && gameManifest?.mobileDelivery?.requiresAppUpdate === true;
    const hasInstalledPackageForMobileGame = hasUsableInstalledGamePackageState(packageInstallCardState);
    const hasMobilePackageUpdateAvailable = hasInstalledPackageForMobileGame
        && packageInstallCardState.isUpdateAvailable === true;
    const installedPackageVersionLabel = hasInstalledPackageForMobileGame
        ? formatInstalledPackageVersionForTitle(packageInstallCardState.installedVersion)
        : '';
    const shouldShowInstalledPackageVersionBadge = hasInstalledPackageForMobileGame
        && !hasMobilePackageUpdateAvailable
        && !isAppUpdateRequiredForMobileGame;
    const packageInstallFailedActionLabel = packageInstallCardState.errorCode === 'notification-permission-required'
        && packageNotificationPermissionAction === 'settings'
        ? t('packageManager.notificationSettingsAction')
        : undefined;
    const mobilePackageCardDisplayState = (
        (!hasInstalledPackageForMobileGame || hasMobilePackageUpdateAvailable)
        && packageInstallCardState.status === 'installed'
    )
        ? {
            ...packageInstallCardState,
            status: 'not-installed' as const,
        }
        : packageInstallCardState;
    const shouldShowMobilePackageCard = isPackageManagedMobileGame;
    const [isMobilePackageCardExpanded, setIsMobilePackageCardExpanded] = useState(false);
    const shouldAutoExpandMobilePackageCard = hasMobilePackageUpdateAvailable
        || isAppUpdateRequiredForMobileGame
        || packageInstallCardState.status === 'queued'
        || packageInstallCardState.status === 'manifest'
        || packageInstallCardState.status === 'downloading'
        || packageInstallCardState.status === 'verifying';
    const detailTabs = useMemo(() => ([
        {
            id: 'lobby' as const,
            label: t('tabs.lobby'),
            mobileLabel: t('tabs.lobbyCompact', { defaultValue: t('tabs.lobby') }),
        },
        {
            id: 'changelog' as const,
            label: t('tabs.changelog'),
            mobileLabel: t('tabs.changelogCompact', { defaultValue: t('tabs.changelog') }),
        },
        {
            id: 'reviews' as const,
            label: t('tabs.reviews'),
            mobileLabel: t('tabs.reviewsCompact', { defaultValue: t('tabs.reviews') }),
        },
        {
            id: 'leaderboard' as const,
            label: t('tabs.leaderboard'),
            mobileLabel: t('tabs.leaderboardCompact', { defaultValue: t('tabs.leaderboard') }),
        },
    ]), [t]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const namespace = `game-${gameId}`;
        void ensureGameCriticalImageResolverLoaded(gameId).catch((error: unknown) => {
            logger.warn('[GameDetailsModal] 详情弹窗预热 critical image resolver 失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void prefetchGameImplementation(gameId, { includeTutorial: false }).catch((error: unknown) => {
            logger.warn('[GameDetailsModal] 详情弹窗预热游戏 runtime 失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void prefetchOnlineMatchRoute().catch((error: unknown) => {
            logger.warn('[GameDetailsModal] 详情弹窗预热联机房间路由失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        if (!i18n.hasLoadedNamespace(namespace)) {
            void i18n.loadNamespaces(namespace).catch((error: unknown) => {
                logger.warn('[GameDetailsModal] 详情弹窗预热游戏 namespace 失败', {
                    gameId,
                    namespace,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        }
    }, [gameId, i18n, isOpen]);

    const mobilePackageToggleMeta = useMemo(() => {
        if (isAppUpdateRequiredForMobileGame) {
            return {
                icon: AlertTriangle,
                iconClassName: '',
                buttonClassName: 'border-amber-800/20 bg-amber-50/92 text-amber-900 hover:bg-amber-100',
                label: t('packageManager.updateRequiredTitle'),
            };
        }

        switch (mobilePackageCardDisplayState.status) {
            case 'queued':
            case 'verifying':
                return {
                    icon: LoaderCircle,
                    iconClassName: 'animate-spin',
                    buttonClassName: 'border-parchment-card-border/45 bg-parchment-card-bg/96 text-parchment-base-text hover:bg-parchment-base-bg',
                    label: t('packageManager.progress.label'),
                };
            case 'manifest':
            case 'downloading':
                return {
                    icon: Download,
                    iconClassName: '',
                    buttonClassName: 'border-parchment-card-border/45 bg-parchment-card-bg/96 text-parchment-base-text hover:bg-parchment-base-bg',
                    label: t('packageManager.progress.label'),
                };
            case 'failed':
                return {
                    icon: RefreshCw,
                    iconClassName: '',
                    buttonClassName: 'border-amber-800/20 bg-amber-50/92 text-amber-900 hover:bg-amber-100',
                    label: packageInstallFailedActionLabel,
                };
            case 'installed':
                return {
                    icon: HardDriveDownload,
                    iconClassName: '',
                    buttonClassName: 'border-emerald-700/20 bg-emerald-50/92 text-emerald-900 hover:bg-emerald-100',
                    label: hasUsableInstalledGamePackageVersion(mobilePackageCardDisplayState.installedVersion)
                        ? t('packageManager.installedVersionBadge', { version: mobilePackageCardDisplayState.installedVersion?.trim() })
                        : t('packageManager.installedCompletedBadge'),
                };
            case 'not-installed':
            default:
                return {
                    icon: Download,
                    iconClassName: '',
                    buttonClassName: 'border-parchment-base-text/15 bg-parchment-base-text text-parchment-card-bg hover:bg-parchment-brown',
                    label: t('packageManager.installAction'),
                };
        }
    }, [
        mobilePackageCardDisplayState.installedVersion,
        mobilePackageCardDisplayState.status,
        isAppUpdateRequiredForMobileGame,
        packageInstallFailedActionLabel,
        t,
    ]);
    const MobilePackageToggleIcon = mobilePackageToggleMeta.icon;

    // 房间列表状态
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLobbyLoading, setIsLobbyLoading] = useState(false);
    const [_localStorageTick, setLocalStorageTick] = useState(0);
    const [pendingAction, setPendingAction] = useState<PendingRoomAction | null>(null);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [pendingJoin, setPendingJoin] = useState<{
        matchID: string;
        gameName?: string;
    } | null>(null);
    const [pendingForceReplaceCreate, setPendingForceReplaceCreate] = useState<PendingForceReplaceCreate | null>(null);
    const pendingActionRef = useRef<PendingRoomAction | null>(null);
    const isConfirmingActionRef = useRef(false);
    const roomsRef = useRef<Room[]>([]);
    const createRoomInFlightRef = useRef(false);

    // 排行榜状态
    const [activeTab, setActiveTab] = useState<'lobby' | 'leaderboard' | 'changelog' | 'reviews'>('lobby');
    const [leaderboardData, setLeaderboardData] = useState<{
        leaderboard: LeaderboardEntry[];
    } | null>(null);
    const [leaderboardError, setLeaderboardError] = useState(false);
    // 创建房间弹窗状态
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [isPreparingCreateRoom, setIsPreparingCreateRoom] = useState(false);
    const [initialCreateRoomPreferences, setInitialCreateRoomPreferences] = useState<LocalMatchPreferences | null>(null);
    const [showAuthorInfoModal, setShowAuthorInfoModal] = useState(false);
    const [matchEntryLoadingPhase, setMatchEntryLoadingPhase] = useState<MatchEntryLoadingPhase | null>(null);
    const passwordModalIdRef = useRef<string | null>(null);

    const getGuestId = useCallback(() => getOrCreateGuestId(), []);
    const getGuestName = useCallback(() => resolveGuestName(t, getGuestId()), [getGuestId, t]);
    const getOwnerKey = useCallback(() => resolveOwnerKey(user?.id, getGuestId()), [getGuestId, user?.id]);
    const getOwnerType = useCallback(() => resolveOwnerType(user?.id), [user?.id]);
    const matchEntryLoadingTitle = matchEntryLoadingPhase === 'creating'
        ? t('matchRoom.title.creating')
        : t('matchRoom.title.joining');
    const matchEntryLoadingDescription = matchEntryLoadingPhase === 'creating'
        ? t('matchRoom.creatingRoom')
        : t('matchRoom.joiningRoom');
    const matchEntryLoadingProgressText = matchEntryLoadingPhase === 'creating'
        ? t('matchRoom.loadingProgress.preparingRoom')
        : t('matchRoom.loadingProgress.joiningRoom');
    useEffect(() => {
        pendingActionRef.current = pendingAction;
    }, [pendingAction]);

    useEffect(() => {
        isConfirmingActionRef.current = isConfirmingAction;
    }, [isConfirmingAction]);

    useEffect(() => {
        roomsRef.current = rooms;
    }, [rooms]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (!shouldShowMobilePackageCard) {
            setIsMobilePackageCardExpanded(false);
            return;
        }

        if (shouldAutoExpandMobilePackageCard) {
            setIsMobilePackageCardExpanded(true);
        }
    }, [isOpen, shouldAutoExpandMobilePackageCard, shouldShowMobilePackageCard]);

    useEffect(() => {
        if (isOpen) {
            return;
        }
        setIsMobilePackageCardExpanded(false);
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && activeTab === 'leaderboard') {
            setLeaderboardError(false);
            setLeaderboardData(null);
            fetch(`${GAME_SERVER_URL}/games/${normalizedGameId}/leaderboard`)
                .then(res => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    if (data && !data.error) {
                        setLeaderboardData(data);
                        return;
                    }
                    setLeaderboardError(true);
                })
                .catch(err => {
                    logger.error('[GameDetailsModal] 获取排行榜失败', {
                        gameId: normalizedGameId,
                        error: err,
                    });
                    setLeaderboardError(true);
                });
        }

    }, [isOpen, activeTab, normalizedGameId]);

    useEffect(() => {
        if (!isOpen) return;
        pruneStoredMatchCredentials();
    }, [isOpen]);

    // 使用 socket 订阅房间列表更新（替代轮询）
    useEffect(() => {
        if (!isOpen) {
            setIsLobbyLoading(false);
            return;
        }

        let storageTimeout: NodeJS.Timeout;
        const handleStorage = () => {
            clearTimeout(storageTimeout);
            storageTimeout = setTimeout(() => {
                setLocalStorageTick(t => t + 1);
            }, 150);
        };

        setRooms([]);
        setIsLobbyLoading(true);
        window.addEventListener('storage', handleStorage);
        const handleOwnerActive = () => handleStorage();
        window.addEventListener('owner-active-match-changed', handleOwnerActive);
        window.addEventListener('match-credentials-changed', handleStorage);
        let connectErrorToastTimer: number | null = null;

        // 订阅大厅更新（仅当前游戏）
        const unsubscribeMatches = lobbySocket.subscribe(normalizedGameId, (matches: LobbyMatch[]) => {
            // 转换为房间格式
            const roomList: Room[] = matches.map(m => ({
                matchID: m.matchID,
                players: m.players,
                totalSeats: m.totalSeats,
                gameName: m.gameName,
                roomName: m.roomName,
                ownerKey: m.ownerKey,
                ownerType: m.ownerType,
                isLocked: m.isLocked,
                publicSetupSummary: m.publicSetupSummary,
            }));
            setRooms(roomList);
            setIsLobbyLoading(false);
        });

        // 订阅连接状态
        const unsubscribeStatus = lobbySocket.subscribeStatus((status) => {
            if (status.connected) {
                if (connectErrorToastTimer !== null) {
                    window.clearTimeout(connectErrorToastTimer);
                    connectErrorToastTimer = null;
                }
                return;
            }

            if (status.lastError) {
                if (connectErrorToastTimer !== null) {
                    window.clearTimeout(connectErrorToastTimer);
                }
                connectErrorToastTimer = window.setTimeout(() => {
                    toast.error(
                        { kind: 'i18n', key: 'error.serviceUnavailable.desc', ns: 'lobby' },
                        { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
                        { dedupeKey: 'lobbySocket.connectError' }
                    );
                    connectErrorToastTimer = null;
                }, LOBBY_CONNECT_ERROR_TOAST_DELAY_MS);
            }
        });

        // subscribe() 已自动向服务端发送订阅请求并获取快照，无需额外 requestRefresh

        return () => {
            clearTimeout(storageTimeout);
            setIsLobbyLoading(false);
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('owner-active-match-changed', handleOwnerActive);
            window.removeEventListener('match-credentials-changed', handleStorage);
            if (connectErrorToastTimer !== null) {
                window.clearTimeout(connectErrorToastTimer);
                connectErrorToastTimer = null;
            }
            unsubscribeMatches();
            unsubscribeStatus();
        };
    }, [isOpen, normalizedGameId, toast]);

    const storedMatchCredentials = listStoredMatchCredentials();
    const latestStoredMatchCredentials = getLatestStoredMatchCredentials();

    // 检测用户当前活跃的房间（本地存有凭证的任意房间，可能跨游戏）
    const myActiveRoomMatchID = useMemo(() => {
        const latestCreds = latestStoredMatchCredentials;
        if (latestCreds?.matchID) return latestCreds.matchID;
        const ownerActive = getOwnerActiveMatch();
        const ownerKey = getOwnerKey();
        if (ownerActive?.matchID && isOwnerActiveMatchSuppressed(ownerActive.matchID)) {
            clearOwnerActiveMatch(ownerActive.matchID);
            return null;
        }
        if (ownerActive?.matchID && (!ownerActive.ownerKey || ownerActive.ownerKey === ownerKey)) {
            return ownerActive.matchID;
        }
        return null;
    }, [latestStoredMatchCredentials, getOwnerKey]);

    // 同步房主激活对局与房间列表（避免状态滞后或丢失）
    useEffect(() => {
        const ownerKey = getOwnerKey();
        if (!ownerKey) return;
        const ownerActive = getOwnerActiveMatch();
        const matchedRoom = rooms.find(r => r.ownerKey === ownerKey);
        if (matchedRoom) {
            if (isOwnerActiveMatchSuppressed(matchedRoom.matchID)) {
                if (ownerActive?.matchID === matchedRoom.matchID) {
                    clearOwnerActiveMatch(matchedRoom.matchID);
                }
                return;
            }
            if (!ownerActive || ownerActive.matchID !== matchedRoom.matchID) {
                setOwnerActiveMatch({
                    matchID: matchedRoom.matchID,
                    gameName: matchedRoom.gameName || gameId,
                    ownerKey,
                    ownerType: matchedRoom.ownerType || getOwnerType(),
                });
            }
            return;
        }
        if (ownerActive?.matchID && ownerActive.ownerKey === ownerKey) {
            clearOwnerActiveMatch(ownerActive.matchID);
        }
    }, [rooms, gameId, getOwnerKey, getOwnerType]);


    const handleOpenMobilePackageInstall = useCallback(() => {
        logMobileRuntimeCritical('GameDetailsModal', 'open-package-install-clicked', {
            gameId,
            gameName: gameDisplayName,
            isPackageManagedMobileGame,
            isAppUpdateRequiredForMobileGame,
            status: packageInstallCardState.status,
            hasPendingInstall: Boolean(pendingPackageInstall),
        });
        if (!isPackageManagedMobileGame || isAppUpdateRequiredForMobileGame) {
            return;
        }
        logger.info('[GameDetailsModal] 请求安装游戏包', {
            gameId,
            gameName: gameDisplayName,
            status: packageInstallCardState.status,
        });
        requestGamePackageInstall();
    }, [
        gameDisplayName,
        gameId,
        isAppUpdateRequiredForMobileGame,
        isPackageManagedMobileGame,
        pendingPackageInstall,
        packageInstallCardState.status,
        requestGamePackageInstall,
    ]);

    const handleRequestAndroidNativeUpdate = useCallback(() => {
        logMobileRuntimeCritical('GameDetailsModal', 'native-update-clicked', {
            gameId,
            gameName: gameDisplayName,
            requiredAppVersion: gameManifest?.mobileDelivery?.requiredAppVersion,
        });
        requestAndroidNativeUpdateCheck({ interactive: true });
    }, [
        gameDisplayName,
        gameId,
        gameManifest?.mobileDelivery?.requiredAppVersion,
    ]);

    const handleDismissPackageInstall = useCallback(() => {
        logger.info('[GameDetailsModal] 关闭安装游戏包弹窗', {
            gameId,
            gameName: gameDisplayName,
            status: packageInstallCardState.status,
        });
        dismissGamePackageInstall();
    }, [
        dismissGamePackageInstall,
        gameDisplayName,
        gameId,
        packageInstallCardState.status,
    ]);

    const handleCancelPackageInstall = useCallback(() => {
        logger.info('[GameDetailsModal] 取消安装游戏包', {
            gameId,
            gameName: gameDisplayName,
            status: packageInstallCardState.status,
        });
        void Promise.resolve(cancelGamePackageInstall()).catch((error) => {
            logMobileRuntimeCritical('GameDetailsModal', 'cancel-package-install-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }, [
        cancelGamePackageInstall,
        gameDisplayName,
        gameId,
        packageInstallCardState.status,
    ]);

    const handleUninstallPackageInstall = useCallback(() => {
        logger.info('[GameDetailsModal] 卸载游戏素材包', {
            gameId,
            gameName: gameDisplayName,
            status: packageInstallCardState.status,
        });
        void Promise.resolve(uninstallGamePackageInstall()).catch((error) => {
            logMobileRuntimeCritical('GameDetailsModal', 'uninstall-package-install-failed', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
    }, [
        gameDisplayName,
        gameId,
        packageInstallCardState.status,
        uninstallGamePackageInstall,
    ]);

    const handleConfirmPackageInstall = useCallback(async () => {
        logger.info('[GameDetailsModal] 确认安装游戏包', {
            gameId,
            gameName: gameDisplayName,
            pendingInstall: pendingPackageInstall ? 'yes' : 'no',
            status: packageInstallCardState.status,
        });
        logMobileRuntimeCritical('GameDetailsModal', 'confirm-package-install-clicked', {
            gameId,
            gameName: gameDisplayName,
            status: packageInstallCardState.status,
            hasPendingInstall: Boolean(pendingPackageInstall),
            isConfirmingPackageInstall,
        });
        if (isConfirmingPackageInstall) {
            logMobileRuntimeCritical('GameDetailsModal', 'confirm-package-install-ignored', {
                gameId,
                reason: 'already-confirming',
            });
            return;
        }
        await confirmGamePackageInstall();
    }, [
        confirmGamePackageInstall,
        gameDisplayName,
        gameId,
        isConfirmingPackageInstall,
        packageInstallCardState.status,
        pendingPackageInstall,
    ]);

    const handleRetryPackageInstall = useCallback(() => {
        logger.info('[GameDetailsModal] 重试安装游戏包', {
            gameId,
            gameName: gameDisplayName,
            status: packageInstallCardState.status,
            errorMessage: packageInstallCardState.errorMessage,
        });
        if (
            packageInstallCardState.errorCode === 'notification-permission-required'
            && packageNotificationPermissionAction === 'settings'
        ) {
            void openGamePackageNotificationSettings();
            return;
        }
        retryGamePackageInstall();
    }, [
        gameDisplayName,
        gameId,
        openGamePackageNotificationSettings,
        packageInstallCardState.errorMessage,
        packageInstallCardState.errorCode,
        packageInstallCardState.status,
        packageNotificationPermissionAction,
        retryGamePackageInstall,
    ]);

    useEffect(() => {
        if (!isPackageManagedMobileGame) {
            return;
        }

        const packageStateSnapshot = JSON.stringify({
            pendingInstall: pendingPackageInstall ? 'yes' : 'no',
            pendingModulePackId: pendingPackageInstall?.modulePackId || '',
            pendingAssetPackId: pendingPackageInstall?.assetPackId || '',
            status: packageInstallCardState.status,
            progressMode: packageInstallCardState.progressMode || '',
            progressPercent: packageInstallCardState.progressPercent ?? '',
            errorMessage: packageInstallCardState.errorMessage || '',
        });

        if (lastLoggedPackageStateByGame.get(gameId) === packageStateSnapshot) {
            return;
        }

        lastLoggedPackageStateByGame.set(gameId, packageStateSnapshot);

        logger.info('[GameDetailsModal] 游戏包状态变化', {
            gameId,
            gameName: gameDisplayName,
            pendingInstall: pendingPackageInstall ? 'yes' : 'no',
            pendingModulePackId: pendingPackageInstall?.modulePackId || '',
            pendingAssetPackId: pendingPackageInstall?.assetPackId || '',
            status: packageInstallCardState.status,
            progressMode: packageInstallCardState.progressMode || '',
            progressPercent: packageInstallCardState.progressPercent ?? '',
            errorMessage: packageInstallCardState.errorMessage || '',
        });
    }, [
        gameDisplayName,
        gameId,
        isPackageManagedMobileGame,
        packageInstallCardState.errorMessage,
        packageInstallCardState.progressMode,
        packageInstallCardState.progressPercent,
        packageInstallCardState.status,
        pendingPackageInstall,
    ]);

    const handleTutorial = () => {
        void ensureGameCriticalImageResolverLoaded(gameId).catch(() => {
            // 具体失败链路由加载器日志记录，这里保持教程入口可继续跳转。
        });
        void prefetchGameImplementation(gameId, { includeTutorial: true }).catch(() => {
            // 预加载失败时仍允许进入教程页，由路由页继续走兜底加载/报错链路。
        });
        onNavigate?.();
        navigate(`/play/${gameId}/tutorial`);
    };
    const hasTutorialEntry = useMemo(() => hasGameTutorialLoader(gameId), [gameId]);
    const hasConfigReview = hasGameConfigReview(normalizedGameId);
    const handleConfigReview = () => {
        onNavigate?.();
        navigate(getGameConfigReviewPath(normalizedGameId));
    };
    const loadCreateRoomPreferences = async (): Promise<LocalMatchPreferences | null> => {
        if (!gameManifest) {
            return null;
        }

        const localFallback = readStoredLocalMatchPreferences(gameManifest);
        const sanitizedLocalFallback = localFallback
            ? stripAiSeatsFromLocalMatchPreferences(localFallback)
            : null;

        if (!token) {
            return sanitizedLocalFallback;
        }

        try {
            const result = await getLocalMatchPreferences(token, gameManifest.id);
            if (result.empty || !result.settings) {
                return sanitizedLocalFallback;
            }
            return stripAiSeatsFromLocalMatchPreferences(normalizeLocalMatchPreferences(
                gameManifest,
                result.settings as unknown as Record<string, unknown>,
            ));
        } catch (error) {
            logger.error('[GameDetailsModal] 读取创建房间 AI 偏好失败，回退到本地设置', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
            return sanitizedLocalFallback;
        }
    };

    const persistCreateRoomPreferences = async (preferences: LocalMatchPreferences) => {
        if (!gameManifest) return;
        const sanitizedPreferences = stripAiSeatsFromLocalMatchPreferences(preferences);

        if (!token) {
            writeLocalMatchPreferences(gameManifest, sanitizedPreferences);
            return;
        }

        try {
            await updateLocalMatchPreferences(token, gameManifest.id, sanitizedPreferences);
        } catch (error) {
            logger.error('[GameDetailsModal] 保存创建房间 AI 偏好失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    };

    const clearLocalActiveMatchState = (matchID: string) => {
        clearMatchCredentials(matchID);
        clearOwnerActiveMatch(matchID);
        setLocalStorageTick((t) => t + 1);
    };

    const openCreateRoomModal = async () => {
        if (isPreparingCreateRoom) return;
        const namespace = `game-${gameId}`;
        setIsPreparingCreateRoom(true);
        void ensureGameCriticalImageResolverLoaded(gameId).catch((error: unknown) => {
            logger.warn('[GameDetailsModal] 提前加载 critical image resolver 失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void prefetchGameImplementation(gameId, { includeTutorial: false }).catch((error: unknown) => {
            logger.warn('[GameDetailsModal] 提前加载游戏 runtime 失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        void prefetchOnlineMatchRoute().catch((error: unknown) => {
            logger.warn('[GameDetailsModal] 提前加载房间页路由失败', {
                gameId,
                error: error instanceof Error ? error.message : String(error),
            });
        });
        try {
            if (!i18n.hasLoadedNamespace(namespace)) {
                await i18n.loadNamespaces(namespace);
            }
            setInitialCreateRoomPreferences(await loadCreateRoomPreferences());
        } catch (error) {
            logger.error('[GameDetailsModal] 预加载创建房间 namespace 失败', {
                gameId,
                namespace,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setIsPreparingCreateRoom(false);
        }

        setShowCreateRoomModal(true);
    };

    const tryClaimSeat = async (
        matchID: string,
        gameName: string,
        options?: { navigateOnSuccess?: boolean },
    ) => {
        setMatchEntryLoadingPhase('joining');
        const claimResult = user?.id && token
            ? await claimSeat(gameName, matchID, '0', { token, playerName: user.username })
            : await claimSeat(gameName, matchID, '0', { guestId: getGuestId(), playerName: getGuestName() });
        if (!claimResult.success) {
            if (claimResult.error === 'unauthorized' || claimResult.error === 'forbidden' || claimResult.error === 'not_found') {
                clearMatchCredentials(matchID);
                clearOwnerActiveMatch(matchID);
                setLocalStorageTick((t) => t + 1);
            }
            return { success: false, error: claimResult.error };
        }
        setOwnerActiveMatch({
            matchID,
            gameName,
            ownerKey: getOwnerKey(),
            ownerType: getOwnerType(),
        });
        setLocalStorageTick(t => t + 1);
        setShowCreateRoomModal(false);
        // 通知大厅刷新，确保其他玩家能看到房间状态更新
        lobbySocket.requestRefresh(normalizedGameId);
        if (options?.navigateOnSuccess !== false) {
            void prefetchOnlineMatchRoute().catch(() => {
                // 失败不阻塞进房
            });
            onNavigate?.();
            navigate(`/play/${gameName}/match/${matchID}?playerID=0`);
        }
        return { success: true, credentials: claimResult.credentials };
    };

    const handleRoomCreatedButEnterFailed = useCallback((params: {
        matchID: string;
        messageKind: 'claim-failed' | 'enter-failed';
        reason: string;
        error?: unknown;
    }) => {
        const errorMessage = params.error instanceof Error
            ? params.error.message
            : params.error
                ? String(params.error)
                : null;

        logger.error('[GameDetailsModal] 房间已创建，但自动进入流程失败', {
            gameId,
            matchID: params.matchID,
            reason: params.reason,
            error: errorMessage,
        });
        logMobileRuntimeCritical('GameDetailsModal', 'create-room-post-success-failed', {
            gameId,
            matchID: params.matchID,
            reason: params.reason,
            error: errorMessage,
        });
        appendMatchLoadTrace({
            stage: 'create-room-post-success-failed',
            gameId,
            matchId: params.matchID,
            payload: {
                reason: params.reason,
                error: errorMessage,
            },
        });

        setShowCreateRoomModal(false);
        setLocalStorageTick((t) => t + 1);
        lobbySocket.requestRefresh(normalizedGameId);
        if (params.messageKind === 'claim-failed') {
            toast.warning({ kind: 'i18n', key: 'error.roomCreatedButClaimFailed', ns: 'lobby' });
            return;
        }
        toast.warning({ kind: 'i18n', key: 'error.roomCreatedButEnterFailed', ns: 'lobby' });
    }, [gameId, normalizedGameId, toast]);

    // 实际创建房间逻辑
    const handleCreateRoom = async (
        config: RoomConfig,
        options?: {
            forceReplaceOwnerRoom?: boolean;
        },
    ) => {
        if (createRoomInFlightRef.current) {
            logger.warn('[GameDetailsModal] create-room 被重复触发，已忽略');
            return;
        }
        createRoomInFlightRef.current = true;
        let shouldPreserveLoading = false;
        setIsLoading(true);
        setMatchEntryLoadingPhase('creating');
        try {
            const { numPlayers, roomName, ttlSeconds, password, setupSelections, enableAi, seatControllers } = config;
            const ownerKey = getOwnerKey();
            const ownerType = getOwnerType();
            const guestId = user?.id ? undefined : getGuestId();
            const normalizedSetupSelections = Object.fromEntries(
                Object.entries(setupSelections ?? {}).map(([key, value]) => [
                    key,
                    Array.isArray(value) ? [...value] : value,
                ]),
            );
            const hasSetupSelections = Object.keys(normalizedSetupSelections).length > 0;
            const normalizedPreferences = gameManifest
                ? normalizeLocalMatchPreferences(gameManifest, {
                    numPlayers,
                    minimumActionDelayMs: config.minimumActionDelayMs,
                    seatControllers,
                    setupSelections,
                })
                : null;
            const normalizedSeatControllers = enableAi
                ? (normalizedPreferences?.seatControllers ?? seatControllers)
                : {};

            if (normalizedPreferences) {
                await persistCreateRoomPreferences(normalizedPreferences);
            }

            // 使用传入的游戏编号传递房间名
            const setupData = {
                ...(roomName ? { roomName } : {}),
                ttlSeconds,
                ownerKey,
                ownerType,
                ...(guestId ? { guestId } : {}),
                ...(password ? { password } : {}),
                ...(hasSetupSelections ? normalizedSetupSelections : {}),
                ...(hasSetupSelections ? { setupSelections: normalizedSetupSelections } : {}),
                ...(enableAi ? { enableAi: true, seatControllers: normalizedSeatControllers } : {}),
            };
            startMatchLoadTrace({
                source: 'create-room',
                stage: 'create-room-submit',
                gameId,
                payload: {
                    numPlayers,
                    enableAi,
                    hasPassword: Boolean(password),
                    hasSetupSelections,
                    seatControllerCount: Object.keys(normalizedSeatControllers).length,
                },
            });
            const criticalImageResolverReadyPromise = ensureGameCriticalImageResolverLoaded(gameId);
            void criticalImageResolverReadyPromise.catch(() => {
                // 具体失败链路由 ensureGameCriticalImageResolverLoaded 内部日志记录
            });
            void prefetchGameImplementation(gameId, { includeTutorial: false }).catch(() => {
                // 具体失败链路由 prefetchGameImplementation 内部日志记录
            });
            const result = await matchApi.createMatch(
                    gameId,
                    {
                        numPlayers,
                        setupData,
                        playerName: user?.username || getGuestName(),
                        forceReplaceOwnerRoom: options?.forceReplaceOwnerRoom,
                    },
                    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
                );
            const matchID = result.matchID;

            if (!matchID) {
                console.error('[handleCreateRoom] 服务器返回空 matchID');
                toast.error({ kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' });
                return;
            }
            appendMatchLoadTrace({
                stage: 'create-room-api-success',
                gameId,
                matchId: matchID,
                payload: {
                    ownerPlayerID: result.ownerPlayerID ?? '0',
                    hasOwnerCredentials: Boolean(result.ownerCredentials),
                },
            });
            void criticalImageResolverReadyPromise
                .then(() => {
                    const initialResolvedImages = resolveCriticalImages(gameId, undefined, i18n.language);
                    const initialPrewarmPaths = [...new Set(initialResolvedImages.critical)];
                    if (initialPrewarmPaths.length === 0) {
                        appendMatchLoadTrace({
                            stage: 'create-room-asset-prewarm-empty',
                            gameId,
                            matchId: matchID,
                            payload: {
                                locale: i18n.language,
                                phaseKey: initialResolvedImages.phaseKey ?? null,
                            },
                        });
                        return;
                    }

                    preloadWarmImages(initialPrewarmPaths, i18n.language, gameId);
                    appendMatchLoadTrace({
                        stage: 'create-room-asset-prewarm-start',
                        gameId,
                        matchId: matchID,
                        payload: {
                            locale: i18n.language,
                            pathCount: initialPrewarmPaths.length,
                            phaseKey: initialResolvedImages.phaseKey ?? null,
                            samplePaths: initialPrewarmPaths.slice(0, 4),
                        },
                    });
                })
                .catch((prewarmError: unknown) => {
                    appendMatchLoadTrace({
                        stage: 'create-room-asset-prewarm-failed',
                        gameId,
                        matchId: matchID,
                        payload: {
                            locale: i18n.language,
                            error: prewarmError instanceof Error ? prewarmError.message : String(prewarmError),
                        },
                    });
                });

            try {
                const ownerPlayerName = user?.username || getGuestName();
                const ownerCredentials = result.ownerCredentials;
                if (ownerCredentials) {
                    persistMatchCredentials(matchID, {
                        playerID: result.ownerPlayerID || '0',
                        credentials: ownerCredentials,
                        matchID,
                        gameName: gameId,
                        playerName: ownerPlayerName,
                    });
                    setOwnerActiveMatch({
                        matchID,
                        gameName: gameId,
                        ownerKey: getOwnerKey(),
                        ownerType: getOwnerType(),
                    });
                    setLocalStorageTick((t) => t + 1);
                    setShowCreateRoomModal(false);
                    lobbySocket.requestRefresh(normalizedGameId);
                } else {
                    const claimResult = await tryClaimSeat(matchID, gameId, { navigateOnSuccess: false });
                    if (!claimResult.success) {
                        console.error('[handleCreateRoom] claim-seat 失败', { matchID, error: claimResult.error });
                        handleRoomCreatedButEnterFailed({
                            matchID,
                            messageKind: 'claim-failed',
                            reason: 'claim-seat-failed',
                            error: claimResult.error,
                        });
                        return;
                    }
                }

                if (enableAi) {
                    const aiSeatEntries = Object.entries(normalizedSeatControllers).filter(([, controller]) => controller.type !== 'human');
                    persistAiSeatCredentials(matchID, {});

                    if (aiSeatEntries.length > 0) {
                        appendMatchLoadTrace({
                            stage: 'create-room-ai-seat-claim-start',
                            gameId,
                            matchId: matchID,
                            payload: {
                                seatCount: aiSeatEntries.length,
                            },
                        });

                        const aiClaimStartedAt = Date.now();
                        const aiSeatCredentials: Record<string, string> = {};
                        let failureCount = 0;

                        for (const [playerId] of aiSeatEntries) {
                            try {
                                const aiPlayerName = t('createRoom.aiPlayerName', { seat: Number(playerId) + 1 });
                                const claimOptions = ownerType === 'guest'
                                    ? {
                                        guestId: guestId ?? getGuestId(),
                                        playerName: aiPlayerName,
                                    }
                                    : {
                                        token: token ?? undefined,
                                        playerName: aiPlayerName,
                                    };
                                const response = await matchApi.claimSeat(gameId, matchID, playerId, claimOptions);
                                aiSeatCredentials[playerId] = response.playerCredentials;
                                persistAiSeatCredentials(matchID, aiSeatCredentials);
                            } catch (error) {
                                failureCount += 1;
                                logger.error('[GameDetailsModal] AI 座位占座失败', {
                                    gameId,
                                    matchID,
                                    playerId,
                                    error: error instanceof Error ? error.message : String(error),
                                });
                            }
                        }

                        if (failureCount > 0) {
                            toast.error(
                                { kind: 'i18n', key: 'error.aiSeatClaimFailed', ns: 'lobby' },
                                undefined,
                                { dedupeKey: `match.ai-seat-claim-failed.${matchID}` },
                            );
                        }
                        appendMatchLoadTrace({
                            stage: 'create-room-ai-seat-claim-settled',
                            gameId,
                            matchId: matchID,
                            payload: {
                                seatCount: aiSeatEntries.length,
                                successCount: Object.keys(aiSeatCredentials).length,
                                failureCount,
                                durationMs: Date.now() - aiClaimStartedAt,
                            },
                        });
                    }
                } else {
                    persistAiSeatCredentials(matchID, {});
                }

                logMobileRuntimeCritical('GameDetailsModal', 'create-room-navigate-match', {
                    gameId,
                    matchID,
                    enableAi,
                    seatControllerCount: Object.keys(normalizedSeatControllers).length,
                });
                appendMatchLoadTrace({
                    stage: 'create-room-navigate-match',
                    gameId,
                    matchId: matchID,
                    payload: {
                        enableAi,
                        seatControllerCount: Object.keys(normalizedSeatControllers).length,
                        targetPath: `/play/${gameId}/match/${matchID}?playerID=0`,
                    },
                });
                void prefetchOnlineMatchRoute().catch(() => {
                    // 失败不阻塞进房
                });
                onNavigate?.();
                navigate(`/play/${gameId}/match/${matchID}?playerID=0`);
                shouldPreserveLoading = true;
            } catch (postCreateError) {
                handleRoomCreatedButEnterFailed({
                    matchID,
                    messageKind: 'enter-failed',
                    reason: 'post-create-side-effect-failed',
                    error: postCreateError,
                });
                return;
            }
        } catch (error) {
            console.error('Failed to create match:', error);
            logMobileRuntimeCritical('GameDetailsModal', 'create-room-api-failed', {
                gameId,
                gameServerUrl: GAME_SERVER_URL,
                errorName: error instanceof Error ? error.name : typeof error,
                errorMessage: error instanceof Error ? error.message : String(error),
                errorCode: resolveCreateRoomErrorCode(error),
                errorStatus: resolveCreateRoomErrorStatus(error),
            });
            appendMatchLoadTrace({
                stage: 'create-room-api-failed',
                gameId,
                payload: {
                    error: error instanceof Error ? error.message : String(error),
                },
            });
            const message = error instanceof Error ? error.message : String(error);
            // 解析 ACTIVE_MATCH_EXISTS — 支持 JSON 响应和旧的冒号分隔格式
            let existingGameName: string | undefined;
            let existingMatchID: string | undefined;
            let canForceReplace = false;
            // 尝试从 JSON 响应体解析（409 响应）
            const jsonMatch = message.match(/\{.*"error"\s*:\s*"ACTIVE_MATCH_EXISTS".*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]) as { gameName?: string; matchID?: string; canForceReplace?: boolean };
                    existingGameName = parsed.gameName;
                    existingMatchID = parsed.matchID;
                    canForceReplace = parsed.canForceReplace === true;
                } catch { /* 降级到正则 */ }
            }
            // 降级：旧的冒号分隔格式
            if (!existingMatchID) {
                const activeMatchPattern = /ACTIVE_MATCH_EXISTS:([^:]+):([^:]+)/;
                const activeMatch = message.match(activeMatchPattern);
                if (activeMatch) {
                    [, existingGameName, existingMatchID] = activeMatch;
                    canForceReplace = true;
                }
            }
            if (existingGameName && existingMatchID) {
                if (!options?.forceReplaceOwnerRoom && canForceReplace) {
                    setPendingForceReplaceCreate({
                        config,
                        existingGameName,
                        existingMatchID,
                    });
                    return;
                }

                setOwnerActiveMatch({
                    matchID: existingMatchID,
                    gameName: existingGameName,
                    ownerKey: getOwnerKey(),
                    ownerType: getOwnerType(),
                });
                if (options?.forceReplaceOwnerRoom) {
                    lobbySocket.requestRefresh(normalizedGameId);
                    toast.warning({ kind: 'i18n', key: 'error.activeMatchExists', ns: 'lobby' });
                    return;
                }
                const claimResult = await tryClaimSeat(existingMatchID, existingGameName);
                if (claimResult.success) {
                    lobbySocket.requestRefresh(normalizedGameId);
                    shouldPreserveLoading = true;
                    return;
                }
                toast.warning({ kind: 'i18n', key: 'error.activeMatchExists', ns: 'lobby' });
                void handleJoinRoom(existingMatchID, existingGameName);
                lobbySocket.requestRefresh(normalizedGameId);
                setShowCreateRoomModal(false);
                return;
            }
            const friendlyTip = buildCreateRoomErrorTip(error);
            const errorCode = resolveCreateRoomErrorCode(error);
            const errorStatus = resolveCreateRoomErrorStatus(error);
            const errorCodeText = errorStatus
                ? t('error.createRoomErrorCodeWithStatus', { ns: 'lobby', code: errorCode, status: errorStatus })
                : t('error.createRoomErrorCodeOnly', { ns: 'lobby', code: errorCode });
            if (friendlyTip) {
                toast.error(
                    `${t(friendlyTip.messageKey, { ns: 'lobby' })} ${errorCodeText}`,
                    { kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' },
                    { dedupeKey: `create-room-failed.${errorCode}.${errorStatus ?? 'unknown'}` }
                );
                return;
            }
            toast.error(
                `${t('error.createRoomFailed', { ns: 'lobby' })} ${errorCodeText}`,
                undefined,
                { dedupeKey: `create-room-failed.${errorCode}.${errorStatus ?? 'unknown'}` }
            );
        } finally {
            createRoomInFlightRef.current = false;
            setIsLoading(false);
            if (!shouldPreserveLoading) {
                setMatchEntryLoadingPhase(null);
            }
        }
    };

    const handleJoinRoom = async (matchID: string, overrideGameName?: string, password?: string) => {
        let shouldPreserveLoading = false;
        // 检查是否有已保存的凭证（重连场景）
        const savedCreds = localStorage.getItem(`match_creds_${matchID}`);
        if (savedCreds) {
            setMatchEntryLoadingPhase('joining');
            let data: { playerID?: string; gameName?: string; playerName?: string } | null = null;
            try {
                data = JSON.parse(savedCreds);
            } catch {
                data = null;
            }

            if (data?.playerID) {
                const storedGameName = data.gameName;
                const roomGameName = normalizeGameName(overrideGameName || storedGameName) || normalizedGameId || 'tictactoe';
                const storedPlayerName = data.playerName ?? user?.username ?? null;

                try {
                    const matchInfo = await matchApi.getMatch(roomGameName, matchID);
                    const seat = matchInfo.players.find(p => String(p.id) === String(data?.playerID));
                    const seatTakenByOther = !!(seat?.name && storedPlayerName && seat.name !== storedPlayerName);

                    if (!seat || seatTakenByOther) {
                        clearMatchCredentials(matchID);
                    } else {
                        // 直接重连：让服务端/客户端用凭据校验
                        void prefetchOnlineMatchRoute().catch(() => {
                            // 失败不阻塞进房
                        });
                        onNavigate?.();
                        navigate(`/play/${roomGameName}/match/${matchID}?playerID=${data.playerID}`);
                        shouldPreserveLoading = true;
                        return;
                    }
                } catch (error) {
                    console.warn('校验本地凭据失败，改为重新加入', error);
                    clearMatchCredentials(matchID);
                }
            } else {
                clearMatchCredentials(matchID);
            }
        }

        // 新加入逻辑需要从当前大厅列表拿到玩家占位信息
        const match = rooms.find(r => r.matchID === matchID);
        if (!match) {
            setMatchEntryLoadingPhase(null);
            return;
        }

        const roomGameName = normalizeGameName(overrideGameName || match.gameName) || normalizedGameId || 'tictactoe';

        // 检查是否有密码锁
        if (match.isLocked && !password) {
            setMatchEntryLoadingPhase(null);
            if (passwordModalIdRef.current) {
                closeModal(passwordModalIdRef.current);
                passwordModalIdRef.current = null;
            }
            passwordModalIdRef.current = openModal({
                id: `lobby_room_password_${matchID}`,
                closeOnBackdrop: true,
                closeOnEsc: true,
                lockScroll: true,
                onClose: () => {
                    passwordModalIdRef.current = null;
                },
                render: ({ close, closeOnBackdrop: stackCloseOnBackdrop }) => (
                    <PasswordEntryModal
                        open
                        onClose={() => {
                            close();
                        }}
                        onConfirm={(nextPassword) => {
                            close();
                            void handleJoinRoom(matchID, roomGameName, nextPassword);
                        }}
                        closeOnBackdrop={stackCloseOnBackdrop}
                    />
                ),
            });
            return;
        }

        setMatchEntryLoadingPhase('joining');
        const canClaimSeat = !!(match.ownerKey && match.ownerKey === getOwnerKey());
        if (canClaimSeat) {
            const claimResult = await tryClaimSeat(matchID, roomGameName);
            if (claimResult.success) {
                shouldPreserveLoading = true;
                return;
            }
            toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
            setMatchEntryLoadingPhase(null);
            return;
        }
        try {
            // 获取用户名或生成游客名
            const playerName = user?.username || getGuestName();
            const joinData: Record<string, unknown> = {};
            if (password) {
                joinData.password = password;
            }
            if (!user?.id) {
                joinData.guestId = getGuestId();
            }

            const { playerCredentials, playerID } = await matchApi.joinMatch(roomGameName, matchID, {
                playerName,
                data: Object.keys(joinData).length > 0 ? joinData : undefined,
            });
            const joinedPlayerID = playerID;
            if (!joinedPlayerID) {
                throw new Error('join response missing playerID');
            }

            persistMatchCredentials(matchID, {
                playerID: joinedPlayerID,
                credentials: playerCredentials,
                matchID,
                gameName: roomGameName,
                playerName,
            });

            setLocalStorageTick(t => t + 1);

            void prefetchOnlineMatchRoute().catch(() => {
                // 失败不阻塞进房
            });
            onNavigate?.();
            navigate(`/play/${roomGameName}/match/${matchID}?playerID=${joinedPlayerID}`);
            shouldPreserveLoading = true;
        } catch (error) {
            console.error('Join failed:', error);
            if (String(error).includes('Room is full')) {
                toast.warning({ kind: 'i18n', key: 'error.roomFull', ns: 'lobby' });
            } else {
                toast.error({ kind: 'i18n', key: 'error.joinRoomFailed', ns: 'lobby' });
            }
        } finally {
            if (!shouldPreserveLoading) {
                setMatchEntryLoadingPhase(null);
            }
        }
    };

    const handleJoinRequest = (matchID: string, overrideGameName?: string) => {
        if (shouldPromptExitActiveMatch(myActiveRoomMatchID, matchID)) {
            setPendingJoin({ matchID, gameName: overrideGameName });
            return;
        }
        void handleJoinRoom(matchID, overrideGameName);
    };

    const handleConfirmJoin = useEffectEvent(async () => {
        if (!pendingJoin) return;
        const nextJoin = pendingJoin;
        const activeMatchID = myActiveRoomMatchID;

        if (!activeMatchID || activeMatchID === nextJoin.matchID) {
            setPendingJoin(null);
            void handleJoinRoom(nextJoin.matchID, nextJoin.gameName);
            return;
        }

        const storedActive = readStoredMatchCredentials(activeMatchID);
        const ownerActive = getOwnerActiveMatch();
        const exitPayload = resolveActiveMatchExitPayload(activeMatchID, storedActive, ownerActive, normalizedGameId);

        if (!exitPayload) {
            toast.error({ kind: 'i18n', key: 'error.leaveForbidden', ns: 'lobby' });
            setPendingJoin(null);
            return;
        }

        const isHost = exitPayload.playerID === '0';
        const result = await exitMatch(exitPayload.gameName, activeMatchID, exitPayload.playerID, exitPayload.credentials, isHost);
        if (!result.success) {
            notifyExitMatchErrorToast(toast.error, result.error, isHost);
            setPendingJoin(null);
            return;
        }

        setPendingJoin(null);
        void handleJoinRoom(nextJoin.matchID, nextJoin.gameName);
    });

    const handleCancelJoin = useEffectEvent(() => {
        setPendingJoin(null);
    });

    const handleConfirmForceReplaceCreate = useEffectEvent(async () => {
        if (!pendingForceReplaceCreate) return;
        const nextCreate = pendingForceReplaceCreate;
        setPendingForceReplaceCreate(null);
        await handleCreateRoom(nextCreate.config, { forceReplaceOwnerRoom: true });
    });

    const handleCancelForceReplaceCreate = useEffectEvent(() => {
        setPendingForceReplaceCreate(null);
    });

    const handleForceExitLocal = (matchID: string) => {
        suppressOwnerActiveMatch(matchID);
        clearMatchCredentials(matchID);
        clearOwnerActiveMatch(matchID);
        setLocalStorageTick((t) => t + 1);
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    };

    const handleSpectate = async (matchID: string) => {
        const room = roomsRef.current.find((item) => item.matchID === matchID);
        const roomGameName = normalizeGameName(room?.gameName) || normalizedGameId || 'tictactoe';

        try {
            await matchApi.getMatch(roomGameName, matchID);
        } catch (error) {
            if (isMatchNotFoundError(error)) {
                setRooms((prev) => prev.filter((item) => item.matchID !== matchID));
                lobbySocket.requestRefresh(roomGameName);
                toast.warning({ kind: 'i18n', key: 'error.roomDestroyed', ns: 'lobby' });
                return;
            }
            logger.warn('[GameDetailsModal] 观战前校验房间失败，继续尝试进入', {
                matchID,
                gameId: roomGameName,
                error,
            });
        }

        void prefetchOnlineMatchRoute().catch(() => {
            // 失败不阻塞进房
        });
        onNavigate?.();
        navigate(`/play/${roomGameName}/match/${matchID}?spectate=1`);
    };

    const handleAction = (
        matchID: string,
        myPlayerID: string,
        myCredentials: string | undefined,
        isHost: boolean
    ) => {
        console.log('[LobbyModal] 点击销毁/离开', {
            matchID,
            myPlayerID,
            hasCredentials: !!myCredentials,
            isHost,
        });
        setPendingAction({ matchID, myPlayerID, myCredentials, isHost });
    };

    const handleConfirmAction = useCallback(async () => {
        const nextPendingAction = pendingActionRef.current;
        if (!nextPendingAction || isConfirmingActionRef.current) return;
        isConfirmingActionRef.current = true;
        setIsConfirmingAction(true);
        const { matchID, myPlayerID, myCredentials, isHost } = nextPendingAction;
        console.log('[LobbyModal] 确认执行', { matchID, myPlayerID, isHost });

        try {
            // 尝试从本地存储或房间列表获取游戏名
            const saved = localStorage.getItem(`match_creds_${matchID}`);
            let gameName = gameId; // 默认使用当前模态框的游戏编号
            if (saved) {
                const data = JSON.parse(saved);
                if (data.gameName) gameName = data.gameName;
            } else {
                // 如果本地没有，尝试从房间列表查找
                const room = roomsRef.current.find(r => r.matchID === matchID);
                if (room?.gameName) gameName = room.gameName;
            }

            if (!myCredentials) {
                toast.error({ kind: 'i18n', key: 'error.actionFailed', ns: 'lobby' });
                return;
            }

            let result = await exitMatch(gameName, matchID, myPlayerID, myCredentials, isHost);
            console.log('[LobbyModal] 执行完成', { result });

            // 403 forbidden 时尝试 claim-seat 刷新凭证后重试（凭证可能因其他会话被覆盖）
            if (!result.success && result.error === 'forbidden' && isHost) {
                console.log('[LobbyModal] 403 forbidden，尝试 claim-seat 刷新凭证');
                let claimResult: { success: boolean; credentials?: string };
                if (user?.id && token) {
                    claimResult = await claimSeat(gameName, matchID, myPlayerID, { token, playerName: user.username });
                } else {
                    const guestId = getGuestId();
                    const guestName = getGuestName();
                    claimResult = await claimSeat(gameName, matchID, myPlayerID, { guestId, playerName: guestName });
                }
                if (claimResult.success && claimResult.credentials) {
                    console.log('[LobbyModal] claim-seat 成功，重试销毁');
                    result = await exitMatch(gameName, matchID, myPlayerID, claimResult.credentials, isHost);
                    console.log('[LobbyModal] 重试结果', { result });
                }
            }

            if (!result.success) {
                notifyExitMatchErrorToast(toast.error, result.error, isHost);
                return;
            }

            if (result.cleanedLocal) {
                toast.warning({ kind: 'i18n', key: 'error.destroyFailedLocalCleaned', ns: 'lobby' });
            }
            setPendingAction(null);
            setLocalStorageTick(t => t + 1);
            lobbySocket.requestRefresh(normalizedGameId);
        } finally {
            isConfirmingActionRef.current = false;
            setIsConfirmingAction(false);
        }
    }, [gameId, getGuestId, getGuestName, normalizedGameId, toast, token, user?.id, user?.username]);

    const handleCancelAction = useCallback(() => {
        const nextPendingAction = pendingActionRef.current;
        if (nextPendingAction) {
            console.log('[LobbyModal] 取消操作', { matchID: nextPendingAction.matchID });
        }
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
                render: ({ close, closeOnBackdrop: stackCloseOnBackdrop }) => (
                    <ConfirmModal
                        title={pendingAction.isHost ? t('confirm.destroy.title') : t('confirm.leave.title')}
                        description={pendingAction.isHost ? t('confirm.destroy.description') : t('confirm.leave.description')}
                        onConfirm={handleConfirmAction}
                        onCancel={() => {
                            close();
                        }}
                        tone="cool"
                        closeOnBackdrop={stackCloseOnBackdrop}
                        isLoading={isConfirmingAction}
                    />
                ),
            });
        }

        if (!pendingAction && confirmModalIdRef.current) {
            closeModal(confirmModalIdRef.current);
            confirmModalIdRef.current = null;
        }
    }, [closeModal, handleCancelAction, handleConfirmAction, openModal, pendingAction, isConfirmingAction, t]);

    useEffect(() => {
        if (pendingJoin && !confirmJoinModalIdRef.current) {
            confirmJoinModalIdRef.current = openModal({
                closeOnBackdrop: true,
                closeOnEsc: true,
                lockScroll: true,
                onClose: () => {
                    handleCancelJoin();
                    confirmJoinModalIdRef.current = null;
                },
                render: ({ close, closeOnBackdrop: stackCloseOnBackdrop }) => (
                    <ConfirmModal
                        title={t('confirm.exitActiveMatch.title')}
                        description={t('confirm.exitActiveMatch.description')}
                        onConfirm={handleConfirmJoin}
                        onCancel={() => {
                            close();
                        }}
                        tone="cool"
                        closeOnBackdrop={stackCloseOnBackdrop}
                    />
                ),
            });
        }

        if (!pendingJoin && confirmJoinModalIdRef.current) {
            closeModal(confirmJoinModalIdRef.current);
            confirmJoinModalIdRef.current = null;
        }
    }, [closeModal, openModal, pendingJoin, t]);

    useEffect(() => {
        if (pendingForceReplaceCreate && !forceReplaceCreateModalIdRef.current) {
            forceReplaceCreateModalIdRef.current = openModal({
                closeOnBackdrop: true,
                closeOnEsc: true,
                lockScroll: true,
                onClose: () => {
                    handleCancelForceReplaceCreate();
                    forceReplaceCreateModalIdRef.current = null;
                },
                render: ({ close, closeOnBackdrop: stackCloseOnBackdrop }) => (
                    <ConfirmModal
                        title={t('confirm.forceReplaceOwnerRoom.title')}
                        description={t('confirm.forceReplaceOwnerRoom.description', {
                            id: pendingForceReplaceCreate.existingMatchID.slice(0, 4),
                        })}
                        confirmText={t('confirm.forceReplaceOwnerRoom.confirm')}
                        onConfirm={handleConfirmForceReplaceCreate}
                        onCancel={() => {
                            close();
                        }}
                        tone="cool"
                        closeOnBackdrop={stackCloseOnBackdrop}
                    />
                ),
            });
        }

        if (!pendingForceReplaceCreate && forceReplaceCreateModalIdRef.current) {
            closeModal(forceReplaceCreateModalIdRef.current);
            forceReplaceCreateModalIdRef.current = null;
        }
    }, [
        closeModal,
        handleCancelForceReplaceCreate,
        handleConfirmForceReplaceCreate,
        openModal,
        pendingForceReplaceCreate,
        t,
    ]);

    useEffect(() => {
        return () => {
            if (confirmModalIdRef.current) {
                closeModal(confirmModalIdRef.current);
                confirmModalIdRef.current = null;
            }
            if (confirmJoinModalIdRef.current) {
                closeModal(confirmJoinModalIdRef.current);
                confirmJoinModalIdRef.current = null;
            }
            if (forceReplaceCreateModalIdRef.current) {
                closeModal(forceReplaceCreateModalIdRef.current);
                forceReplaceCreateModalIdRef.current = null;
            }
            if (passwordModalIdRef.current) {
                closeModal(passwordModalIdRef.current);
                passwordModalIdRef.current = null;
            }
        };
    }, [closeModal]);

    // 预处理带有凭据元数据的房间列表（全量）
    const allRoomItems = useMemo(() => {
        if (rooms.length === 0) return [];

        // 预先获取缓存凭据索引，避免在映射中反复查询本地存储
        const credsMap = new Map<string, ReturnType<typeof listStoredMatchCredentials>[number]>();
        storedMatchCredentials.forEach((item) => {
            if (item.matchID) {
                credsMap.set(item.matchID, item);
            }
        });

        const ownerKey = getOwnerKey();
        return rooms.map(room => {
            const totalSeats = Math.max(room.totalSeats ?? 0, room.players.length);
            const hasOccupiedSeat = room.players.some(player => Boolean(player.name || player.isConnected));
            const playerCount = room.players.filter(p => p.name).length;
            const isFull = totalSeats > 0 ? playerCount >= totalSeats : true;
            const isEmptyRoom = !hasOccupiedSeat;

            const parsed = credsMap.get(room.matchID);
            let myPlayerID: string | null = null;
            let myCredentials: string | null = null;

            if (parsed && parsed.matchID === room.matchID) {
                myPlayerID = parsed.playerID ?? null;
                myCredentials = parsed.credentials ?? null;
            }

            const canReconnect = !!myCredentials;
            const isOwnerRoom = !!ownerKey && room.ownerKey === ownerKey;
            const isMyRoom = !!myActiveRoomMatchID && room.matchID === myActiveRoomMatchID;
            const isHost = myPlayerID === '0';

            return {
                ...room,
                isFull,
                isEmptyRoom,
                playerCount,
                totalSeats,
                isMyRoom,
                isOwnerRoom,
                canReconnect,
                myPlayerID,
                myCredentials,
                isHost,
                gameKey: normalizeGameName(room.gameName)
            };
        });
    }, [rooms, myActiveRoomMatchID, storedMatchCredentials, getOwnerKey]);

    const roomItems = useMemo(() => {
        return allRoomItems.filter(room => room.gameKey === normalizedGameId);
    }, [allRoomItems, normalizedGameId]);

    const activeMatch = useMemo(() => {
        const latestCreds = latestStoredMatchCredentials;
        if (latestCreds?.matchID) {
            const listMatch = rooms.find(r => r.matchID === latestCreds.matchID);
            const gameName = normalizeGameName(latestCreds.gameName || listMatch?.gameName) || normalizedGameId || 'tictactoe';
            const myPlayerID = latestCreds.playerID as string | undefined;
            const myCredentials = latestCreds.credentials as string | undefined;

            return {
                matchID: latestCreds.matchID,
                gameName,
                canReconnect: !!myCredentials,
                myPlayerID: myPlayerID ?? null,
                myCredentials: myCredentials ?? null,
                isHost: myPlayerID === '0',
            };
        }
        const ownerActive = getOwnerActiveMatch();
        const ownerKey = getOwnerKey();
        if (ownerActive?.matchID && isOwnerActiveMatchSuppressed(ownerActive.matchID)) {
            clearOwnerActiveMatch(ownerActive.matchID);
            return null;
        }
        if (ownerActive?.matchID && (!ownerActive.ownerKey || ownerActive.ownerKey === ownerKey)) {
            const listMatch = rooms.find(r => r.matchID === ownerActive.matchID);
            const gameName = normalizeGameName(ownerActive.gameName || listMatch?.gameName) || normalizedGameId || 'tictactoe';
            return {
                matchID: ownerActive.matchID,
                gameName,
                canReconnect: false,
                myPlayerID: null,
                myCredentials: null,
                isHost: true,
            };
        }
        return null;
    }, [latestStoredMatchCredentials, normalizedGameId, rooms, getOwnerKey]);

    const prepareActiveMatchForCreate = async (): Promise<boolean> => {
        if (!activeMatch?.matchID) {
            return true;
        }

        const matchID = activeMatch.matchID;
        const gameName = activeMatch.gameName;
        let playerID = activeMatch.myPlayerID;
        let credentials = activeMatch.myCredentials;
        const isHost = activeMatch.isHost || playerID === '0';

        if (!playerID || !credentials) {
            try {
                await matchApi.getMatch(gameName, matchID);
            } catch (error) {
                if (isMatchNotFoundError(error)) {
                    clearLocalActiveMatchState(matchID);
                    lobbySocket.requestRefresh(gameName);
                    return true;
                }
                toast.error({ kind: 'i18n', key: 'error.actionFailed', ns: 'lobby' });
                return false;
            }

            const claimResult = await tryClaimSeat(matchID, gameName, { navigateOnSuccess: false });
            if (!claimResult.success) {
                if (claimResult.error === 'unauthorized' || claimResult.error === 'forbidden' || claimResult.error === 'not_found') {
                    clearLocalActiveMatchState(matchID);
                    lobbySocket.requestRefresh(gameName);
                    return true;
                }
                toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
                return false;
            }

            playerID = '0';
            credentials = claimResult.credentials ?? null;
            setMatchEntryLoadingPhase('creating');
        }

        if (!playerID || !credentials) {
            clearLocalActiveMatchState(matchID);
            lobbySocket.requestRefresh(gameName);
            return true;
        }

        const exitResult = await exitMatch(gameName, matchID, playerID, credentials, isHost);
        if (!exitResult.success) {
            notifyExitMatchErrorToast(toast.error, exitResult.error, isHost);
            return false;
        }

        clearLocalActiveMatchState(matchID);
        lobbySocket.requestRefresh(gameName);
        return true;
    };

    const handleOpenCreateRoom = async () => {
        if (isPreparingCreateRoom || isLoading) return;

        if (activeMatch?.matchID) {
            setIsLoading(true);
            setMatchEntryLoadingPhase('creating');
            try {
                const released = await prepareActiveMatchForCreate();
                if (!released) {
                    return;
                }
            } finally {
                setIsLoading(false);
                setMatchEntryLoadingPhase(null);
            }
        }

        await openCreateRoomModal();
    };

    useEffect(() => {
        if (!isOpen) return;
        if (!activeMatch?.matchID) return;
        if (activeMatchCheckRef.current === activeMatch.matchID) return;

        activeMatchCheckRef.current = activeMatch.matchID;

        matchApi.getMatch(activeMatch.gameName, activeMatch.matchID)
            .catch((err) => {
                const status = (err as { status?: number }).status;
                const message = (err as { message?: string }).message ?? '';
                if (status === 404 || message.includes('404')) {
                    clearMatchCredentials(activeMatch.matchID);
                    clearOwnerActiveMatch(activeMatch.matchID);
                    setLocalStorageTick((t) => t + 1);
                    toast.warning({ kind: 'i18n', key: 'error.activeMatchStale', ns: 'lobby' });
                    return;
                }
                activeMatchCheckRef.current = null;
            });
    }, [activeMatch, isOpen, toast]);

    return (
        <>
            <ModalBase
                onClose={onClose}
                closeOnBackdrop={closeOnBackdrop}
                containerClassName="p-4 sm:p-8"
            >
                <div
                    ref={modalRef}
                    data-testid="game-details-modal-root"
                    className="
                        bg-parchment-card-bg pointer-events-auto 
                        w-[96vw] md:w-full max-w-[28.8rem] md:max-w-[50.4rem]
                        h-[60vh] md:h-[33rem] max-h-[60vh] md:max-h-[95vh]
                        rounded-sm shadow-parchment-card-hover 
                        flex flex-col md:flex-row 
                        border border-parchment-card-border/30 relative 
                        overflow-hidden
                    "
                >
                    {shouldShowMobilePackageCard && (
                        <div
                            className="pointer-events-none absolute bottom-3 left-3 z-20"
                        >
                            <button
                                type="button"
                                data-testid="game-details-mobile-package-toggle"
                                onClick={() => setIsMobilePackageCardExpanded((current) => !current)}
                                aria-expanded={isMobilePackageCardExpanded}
                                aria-hidden={isMobilePackageCardExpanded}
                                aria-label={mobilePackageToggleMeta.label}
                                title={mobilePackageToggleMeta.label}
                                tabIndex={isMobilePackageCardExpanded ? -1 : 0}
                                className={clsx(
                                    'pointer-events-auto absolute bottom-0 left-0 inline-flex h-11 w-11 items-center justify-center rounded-full border shadow-[0_14px_28px_rgba(56,41,22,0.18)] backdrop-blur-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-parchment-base-text/25',
                                    mobilePackageToggleMeta.buttonClassName,
                                    isMobilePackageCardExpanded
                                        ? 'pointer-events-none scale-90 opacity-0'
                                        : 'scale-100 opacity-100',
                                )}
                            >
                                <MobilePackageToggleIcon
                                    size={18}
                                    strokeWidth={2.2}
                                    className={mobilePackageToggleMeta.iconClassName}
                                />
                            </button>

                            {isMobilePackageCardExpanded && (
                                <div
                                    className="pointer-events-auto absolute bottom-0 left-0 w-[min(20rem,calc(100vw-5rem))] origin-bottom-left scale-100 opacity-100 transition-all duration-200 ease-out md:w-[18rem]"
                                >
                                    <button
                                        type="button"
                                        data-testid="game-details-mobile-package-card-collapse"
                                        onClick={() => setIsMobilePackageCardExpanded(false)}
                                        className="absolute -right-3 -top-3 z-10 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-parchment-card-border/45 bg-parchment-card-bg text-parchment-base-text shadow-[0_8px_18px_rgba(56,41,22,0.2)] transition-colors hover:bg-parchment-base-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-parchment-base-text/25"
                                        aria-label={t('common:close')}
                                        title={t('common:close')}
                                    >
                                        <X size={16} strokeWidth={2.2} />
                                    </button>
                                    <GameDetailsMobilePackageCard
                                        gameName={gameDisplayName}
                                        state={mobilePackageCardDisplayState}
                                        onInstall={handleOpenMobilePackageInstall}
                                        onUpdateApp={handleRequestAndroidNativeUpdate}
                                        onRetry={handleRetryPackageInstall}
                                        onUninstall={handleUninstallPackageInstall}
                                        failedActionLabel={packageInstallFailedActionLabel}
                                        onCancel={handleCancelPackageInstall}
                                        presentation={isAppUpdateRequiredForMobileGame ? 'update-required' : 'install'}
                                        requiredAppVersion={gameManifest?.mobileDelivery?.requiredAppVersion}
                                        className=""
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* 装饰性边角 */}
                    <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-parchment-card-border/60" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-parchment-card-border/60" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-parchment-card-border/60" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-parchment-card-border/60" />

                    {/* 左侧面板 - 游戏信息 */}
                    <div
                        data-testid="game-details-sidebar"
                        className="relative w-full md:w-2/5 shrink-0 overflow-hidden border-b border-parchment-card-border/30 bg-parchment-base-bg/50 transition-all md:border-b-0 md:border-r"
                    >
                        <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3 text-left font-serif md:items-center md:p-8 md:text-center">
                            {/* 缩略图 - 移动端隐藏，桌面端显示 */}
                            <div className="hidden md:flex w-20 h-20 bg-parchment-card-bg border border-parchment-card-border/30 rounded-[4px] shadow-sm items-center justify-center text-4xl text-parchment-base-text font-bold mb-6 overflow-hidden shrink-0">
                                {thumbnail}
                            </div>

                            {/* 标题 - 固定在顶部 */}
                            <div className="mb-4 flex w-full shrink-0 items-start justify-between gap-3 md:mb-0 md:flex-col md:items-center">
                                <div className="min-w-0 flex-1 md:flex-none md:text-center">
                                    <h2
                                        data-testid="game-details-title"
                                        data-installed-version={shouldShowInstalledPackageVersionBadge ? installedPackageVersionLabel : undefined}
                                        className={clsx(
                                            'inline-block max-w-full align-top text-lg font-bold leading-tight tracking-wide text-parchment-base-text md:mb-2 md:text-2xl',
                                            shouldShowInstalledPackageVersionBadge && installedPackageVersionLabel
                                                ? 'after:ml-1.5 after:inline-block after:max-w-[4.75rem] after:translate-y-[-0.05em] after:overflow-hidden after:text-ellipsis after:whitespace-nowrap after:rounded-full after:border after:border-emerald-700/25 after:bg-emerald-50/92 after:px-2 after:py-[0.1rem] after:text-[10px] after:font-semibold after:leading-none after:text-emerald-800 after:align-middle after:content-[attr(data-installed-version)]'
                                                : '',
                                        )}
                                    >
                                        {gameDisplayName}
                                    </h2>
                                </div>
                                <button
                                    type="button"
                                    data-testid="game-details-author-button-mobile"
                                    onClick={() => setShowAuthorInfoModal(true)}
                                    className="inline-flex shrink-0 self-baseline whitespace-nowrap border-none bg-transparent p-0 text-right text-[10px] font-semibold leading-none tracking-[0.04em] text-parchment-light-text/85 shadow-none transition-colors hover:bg-transparent hover:text-parchment-base-text focus-visible:outline-none cursor-pointer md:hidden"
                                    style={{ borderStyle: 'none' }}
                                    title={gameAuthorButtonHint}
                                    aria-label={gameAuthorButtonHint}
                                >
                                    <span>{gameAuthorMobileLabel}</span>
                                </button>
                                <div className="hidden md:block h-px w-12 bg-parchment-card-border/50 opacity-30 mb-4 mx-auto" />
                            </div>
                            {/* 描述区域 - 可滚动 */}
                            <div
                                data-testid="game-details-description"
                                className="hidden md:block flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-parchment-card-border/30 scrollbar-track-transparent pr-1 mb-3 md:mb-6 min-h-0"
                            >
                                <p className="text-[11px] md:text-sm text-parchment-light-text leading-relaxed italic">
                                    {gameDescription}
                                </p>
                            </div>

                            {/* 人数显示 - 固定在底部上方 */}
                            <div
                                data-testid="game-details-player-recommendation"
                                className="hidden md:block shrink-0 mb-3"
                            >
                                {(() => {
                                    const playerOptions = gameManifest?.playerOptions || [2];
                                    const bestPlayers = gameManifest?.bestPlayers || [];

                                    return (
                                        <div className="flex flex-col items-center gap-1.5">
                                            <div className="flex items-center gap-2">
                                                {playerOptions.map((count) => {
                                                    const isBest = bestPlayers.includes(count);
                                                    return (
                                                        <div
                                                            key={count}
                                                            className={clsx(
                                                                "flex items-center justify-center w-8 h-8 rounded-[4px] text-sm font-bold border transition-all cursor-default select-none",
                                                                isBest
                                                                    ? "bg-parchment-base-text text-parchment-card-bg border-parchment-base-text shadow-sm scale-110"
                                                                    : "bg-transparent text-parchment-light-text border-parchment-card-border/50 opacity-70"
                                                            )}
                                                            title={isBest ? t('common:game_details.best_recommendation') : undefined}
                                                        >
                                                            {count}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {bestPlayers.length > 0 && (
                                                <span className="text-[10px] text-parchment-light-text font-medium opacity-60">
                                                    {t('common:game_details.recommended_players')}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* 操作按钮 - 固定在底部 */}
                            {hasTutorialEntry || hasConfigReview ? (
                                <div className="mt-1 grid shrink-0 w-full gap-2 md:mt-0 md:grid-cols-1">
                                    {hasTutorialEntry ? (
                                        <button
                                            type="button"
                                            onClick={handleTutorial}
                                            className="w-full py-1.5 md:py-2 px-3 md:px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all flex items-center justify-center gap-2 cursor-pointer text-[10px] md:text-xs"
                                        >
                                            {t('actions.tutorial')}
                                        </button>
                                    ) : null}
                                    {hasConfigReview ? (
                                        <button
                                            type="button"
                                            data-testid="game-details-config-review-button"
                                            onClick={handleConfigReview}
                                            className="w-full py-1.5 md:py-2 px-3 md:px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all flex items-center justify-center gap-2 cursor-pointer text-[10px] md:text-xs"
                                        >
                                            <TableProperties aria-hidden="true" className="h-3.5 w-3.5 md:h-4 md:w-4" strokeWidth={2.1} />
                                            {t('actions.configReview')}
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}

                            <div className="hidden shrink-0 w-full justify-center pt-2 md:flex md:pt-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAuthorInfoModal(true)}
                                    className="inline-flex max-w-full items-center gap-3 rounded-full border border-parchment-card-border/40 bg-parchment-card-bg/95 px-3.5 py-1.5 text-[10px] font-medium tracking-[0.08em] text-parchment-light-text shadow-sm transition-all hover:border-parchment-base-text/35 hover:bg-parchment-card-bg hover:text-parchment-base-text cursor-pointer"
                                    title={gameAuthorButtonHint}
                                    aria-label={gameAuthorButtonHint}
                                >
                                    <span className="truncate">{gameAuthorLabel}</span>
                                    <Info size={14} strokeWidth={2.2} className="shrink-0 opacity-90" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 右侧面板 - 大厅/排行 */}
                    <div className="flex-1 p-3 sm:p-8 flex flex-col bg-parchment-card-bg font-serif overflow-hidden">
                        <div className="flex justify-between items-center mb-4 sm:mb-6 gap-2">
                            <div
                                data-testid="game-details-tab-row"
                                className="flex min-w-0 flex-1 items-center justify-between gap-1.5 pr-1 sm:gap-4 sm:overflow-x-auto sm:no-scrollbar sm:mask-linear-fade sm:pr-2 sm:justify-start"
                            >
                                {detailTabs.map((tab, index) => (
                                    <div key={tab.id} className="contents">
                                        {index > 0 && <div className="hidden h-4 w-px shrink-0 bg-[#e5e0d0] sm:block sm:h-6" />}
                                        <button
                                            type="button"
                                            data-testid={`game-details-tab-${tab.id}`}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={clsx(
                                                'min-w-0 shrink whitespace-nowrap border-b-2 border-transparent pb-0.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors sm:shrink-0 sm:text-lg sm:tracking-wider',
                                                activeTab === tab.id
                                                    ? 'border-parchment-base-text text-parchment-base-text'
                                                    : 'text-parchment-light-text hover:text-parchment-base-text',
                                            )}
                                        >
                                            <span className="sm:hidden">{tab.mobileLabel}</span>
                                            <span className="hidden sm:inline">{tab.label}</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                data-testid="game-details-close-button"
                                onClick={onClose}
                                className="p-1.5 hover:bg-parchment-base-bg rounded-full text-parchment-light-text hover:text-parchment-base-text transition-colors cursor-pointer shrink-0"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {activeTab === 'lobby' && (
                            <RoomList
                                roomItems={roomItems}
                                gameManifest={gameManifest}
                                gameTranslationNamespace={`game-${normalizedGameId}`}
                                activeMatch={activeMatch}
                                isActionLoading={isLoading || isPreparingCreateRoom}
                                isLobbyLoading={isLobbyLoading}
                                onJoinRoom={handleJoinRoom}
                                onJoinRequest={handleJoinRequest}
                                onAction={handleAction}
                                onForceExitLocal={handleForceExitLocal}
                                onOpenCreateRoom={handleOpenCreateRoom}
                                onSpectate={handleSpectate}
                            />
                        )}
                        {activeTab === 'leaderboard' && (
                            <LeaderboardTab
                                leaderboardData={leaderboardData}
                                error={leaderboardError}
                            />
                        )}
                        {activeTab === 'changelog' && (
                            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
                                <GameDetailsChangelogSection gameId={normalizedGameId} />
                            </div>
                        )}
                        {activeTab === 'reviews' && (
                            <div className="flex-1 min-h-0 overflow-hidden h-full">
                                <GameReviews gameId={normalizedGameId} />
                            </div>
                        )}
                    </div>
                </div>
            </ModalBase>

            {/* 创建房间配置弹窗 */}
            {gameManifest && (
                <CreateRoomModal
                    isOpen={showCreateRoomModal}
                    onClose={() => setShowCreateRoomModal(false)}
                    onConfirm={handleCreateRoom}
                    gameManifest={gameManifest}
                    initialPreferences={initialCreateRoomPreferences}
                    isLoading={isLoading}
                />
            )}

            {showAuthorInfoModal && (
                <ModalBase
                    onClose={() => setShowAuthorInfoModal(false)}
                    closeOnBackdrop
                    containerClassName="p-4 sm:p-8"
                >
                    <div
                        data-testid="game-details-author-modal"
                        className="pointer-events-auto w-[min(92vw,24rem)] rounded-[8px] border border-parchment-card-border/30 bg-parchment-card-bg p-5 text-parchment-base-text shadow-parchment-card-hover"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-parchment-light-text">
                                    <Info size={14} />
                                    <span>{t('authorInfo.title')}</span>
                                </div>
                                <h3 className="mt-3 text-xl font-bold leading-tight">
                                    {gameAuthorName}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAuthorInfoModal(false)}
                                className="rounded-full p-1.5 text-parchment-light-text transition-colors hover:bg-parchment-base-bg hover:text-parchment-base-text cursor-pointer"
                                title={t('authorInfo.close')}
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="mt-4 rounded-[6px] border border-parchment-card-border/20 bg-parchment-base-bg/40 px-3 py-2 text-sm">
                            {t('authorInfo.game', { game: gameDisplayName })}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-parchment-light-text">
                            {t('authorInfo.hint')}
                        </p>
                    </div>
                </ModalBase>
            )}

            {pendingPackageInstall && (
                <GamePackageInstallConfirmModal
                    gameName={pendingPackageInstall.gameName}
                    state={packageInstallCardState}
                    modulePackId={pendingPackageInstall.modulePackId}
                    assetPackId={pendingPackageInstall.assetPackId}
                    modulePackBytes={pendingPackageInstall.modulePackBytes}
                    assetPackBytes={pendingPackageInstall.assetPackBytes}
                    isLoading={isConfirmingPackageInstall}
                    closeOnBackdrop
                    onConfirm={handleConfirmPackageInstall}
                    onRetry={handleRetryPackageInstall}
                    failedActionLabel={packageInstallFailedActionLabel}
                    onClose={handleDismissPackageInstall}
                    onCancel={handleCancelPackageInstall}
                />
            )}

            {matchEntryLoadingPhase && (
                <div className="fixed inset-0" style={{ zIndex: UI_Z_INDEX.modalTooltip + 1 }}>
                    <LoadingScreen
                        title={matchEntryLoadingTitle}
                        description={matchEntryLoadingDescription}
                        progressText={matchEntryLoadingProgressText}
                        fullScreen={false}
                    />
                </div>
            )}
        </>
    );
};
