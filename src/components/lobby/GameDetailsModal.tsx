import { useRef, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Info } from 'lucide-react';
import * as matchApi from '../../services/matchApi';
import { useAuth } from '../../contexts/AuthContext';
import { lobbySocket, type LobbyMatch } from '../../services/lobbySocket';
import { claimSeat, exitMatch, getOwnerActiveMatch, setOwnerActiveMatch, clearOwnerActiveMatch, isOwnerActiveMatchSuppressed, suppressOwnerActiveMatch, clearMatchCredentials, readStoredMatchCredentials, listStoredMatchCredentials, getLatestStoredMatchCredentials, pruneStoredMatchCredentials, persistMatchCredentials } from '../../hooks/match/useMatchStatus';
import { getOrCreateGuestId, getGuestName as resolveGuestName, getOwnerKey as resolveOwnerKey, getOwnerType as resolveOwnerType } from '../../hooks/match/ownerIdentity';
import { ConfirmModal } from '../common/overlays/ConfirmModal';
import { ModalBase } from '../common/overlays/ModalBase';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useToast } from '../../contexts/ToastContext';
import { GAME_SERVER_URL } from '../../config/server';
import { getGameById } from '../../config/games.config';
import { CreateRoomModal, type RoomConfig } from './CreateRoomModal';
import { GameReviews } from '../review/GameReviewSection';
import { PasswordEntryModal } from '../common/overlays/PasswordEntryModal';
import { normalizeGameName, shouldPromptExitActiveMatch, resolveActiveMatchExitPayload, buildCreateRoomErrorTip, type Room } from './roomActions';
import { RoomList } from './RoomList';
import { LeaderboardTab } from './LeaderboardTab';
import { GameChangelogPanel } from './GameChangelogPanel';
import { resolveGameAuthorName } from './gameDetailsContent';
import { logger } from '../../lib/logger';


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

export const GameDetailsModal = ({ isOpen, onClose, gameId, titleKey, descriptionKey, thumbnail, closeOnBackdrop, onNavigate }: GameDetailsModalProps) => {
    const navigate = useNavigate();
    const modalRef = useRef<HTMLDivElement>(null);
    const activeMatchCheckRef = useRef<string | null>(null);
    const { user, token } = useAuth();
    const { t } = useTranslation(['lobby', 'common']);
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const confirmModalIdRef = useRef<string | null>(null);
    const confirmJoinModalIdRef = useRef<string | null>(null);
    const normalizedGameId = normalizeGameName(gameId);
    const gameManifest = getGameById(gameId);
    const gameAuthorName = resolveGameAuthorName(gameManifest);
    const gameAuthorLabel = t('authorInfo.button', { author: gameAuthorName });
    const gameAuthorButtonHint = t('authorInfo.buttonHint');
    const allowLocalMode = gameManifest?.allowLocalMode !== false;

    // 房间列表状态
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const [pendingAction, setPendingAction] = useState<PendingRoomAction | null>(null);
    const [isConfirmingAction, setIsConfirmingAction] = useState(false);
    const [pendingJoin, setPendingJoin] = useState<{
        matchID: string;
        gameName?: string;
    } | null>(null);
    const pendingActionRef = useRef<PendingRoomAction | null>(null);
    const isConfirmingActionRef = useRef(false);
    const roomsRef = useRef<Room[]>([]);

    // 排行榜状态
    const [activeTab, setActiveTab] = useState<'lobby' | 'leaderboard' | 'changelog' | 'reviews'>('lobby');
    const [leaderboardData, setLeaderboardData] = useState<{
        leaderboard: { name: string; wins: number; matches: number }[];
    } | null>(null);
    const [leaderboardError, setLeaderboardError] = useState(false);
    // 创建房间弹窗状态
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [passwordModalConfig, setPasswordModalConfig] = useState<{ matchID: string; gameName: string } | null>(null);
    const [showAuthorInfoModal, setShowAuthorInfoModal] = useState(false);

    const getGuestId = () => getOrCreateGuestId();
    const getGuestName = () => resolveGuestName(t, getGuestId());
    const getOwnerKey = () => resolveOwnerKey(user?.id, getGuestId());
    const getOwnerType = () => resolveOwnerType(user?.id);

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
        if (isOpen) {
            let storageTimeout: NodeJS.Timeout;
            const handleStorage = () => {
                clearTimeout(storageTimeout);
                storageTimeout = setTimeout(() => {
                    setLocalStorageTick(t => t + 1);
                }, 150);
            };
            window.addEventListener('storage', handleStorage);
            const handleOwnerActive = () => handleStorage();
            window.addEventListener('owner-active-match-changed', handleOwnerActive);
            window.addEventListener('match-credentials-changed', handleStorage);

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
                }));
                setRooms(roomList);
            });

            // 订阅连接状态
            const unsubscribeStatus = lobbySocket.subscribeStatus((status) => {
                if (status.lastError) {
                    // 将后端连接问题提示给用户
                    toast.error(
                        { kind: 'i18n', key: 'error.serviceUnavailable.desc', ns: 'lobby' },
                        { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
                        { dedupeKey: 'lobbySocket.connectError' }
                    );
                }
            });

            // subscribe() 已自动向服务端发送订阅请求并获取快照，无需额外 requestRefresh

            return () => {
                clearTimeout(storageTimeout);
                window.removeEventListener('storage', handleStorage);
                window.removeEventListener('owner-active-match-changed', handleOwnerActive);
                window.removeEventListener('match-credentials-changed', handleStorage);
                unsubscribeMatches();
                unsubscribeStatus();
            };
        }
    }, [isOpen, normalizedGameId]);

    // 检测用户当前活跃的房间（本地存有凭证的任意房间，可能跨游戏）
    const myActiveRoomMatchID = useMemo(() => {
        const latestCreds = getLatestStoredMatchCredentials();
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
    }, [localStorageTick, user]);

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
    }, [rooms, user, gameId]);


    const handleTutorial = () => {
        onNavigate?.();
        navigate(`/play/${gameId}/tutorial`);
    };

    const handleLocalPlay = () => {
        onNavigate?.();
        navigate(`/play/${gameId}/local`);
    };

    // 打开创建房间弹窗
    const handleOpenCreateRoom = () => {
        setShowCreateRoomModal(true);
    };

    const tryClaimSeat = async (matchID: string, gameName: string) => {
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
        onNavigate?.();
        navigate(`/play/${gameName}/match/${matchID}?playerID=0`);
        return { success: true };
    };

    // 实际创建房间逻辑
    const handleCreateRoom = async (config: RoomConfig) => {
        setIsLoading(true);
        try {
            const { numPlayers, roomName, ttlSeconds, password } = config;
            const ownerKey = getOwnerKey();
            const ownerType = getOwnerType();
            const guestId = user?.id ? undefined : getGuestId();

            // 使用传入的游戏编号传递房间名
            const setupData = {
                ...(roomName ? { roomName } : {}),
                ttlSeconds,
                ownerKey,
                ownerType,
                ...(guestId ? { guestId } : {}),
                ...(password ? { password } : {}),
            };
            const result = await matchApi.createMatch(
                    gameId,
                    { numPlayers, setupData },
                    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
                );
            const matchID = result.matchID;

            if (!matchID) {
                console.error('[handleCreateRoom] 服务器返回空 matchID');
                toast.error({ kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' });
                return;
            }

            const claimResult = await tryClaimSeat(matchID, gameId);
            if (!claimResult.success) {
                console.error('[handleCreateRoom] claim-seat 失败', { matchID, error: claimResult.error });
                toast.error({ kind: 'i18n', key: 'error.roomCreatedButClaimFailed', ns: 'lobby' });
                // 请求刷新大厅，让用户能看到已创建的房间
                lobbySocket.requestRefresh(normalizedGameId);
                return;
            }
        } catch (error) {
            console.error('Failed to create match:', error);
            const message = error instanceof Error ? error.message : String(error);
            // 解析 ACTIVE_MATCH_EXISTS — 支持 JSON 响应和旧的冒号分隔格式
            let existingGameName: string | undefined;
            let existingMatchID: string | undefined;
            // 尝试从 JSON 响应体解析（409 响应）
            const jsonMatch = message.match(/\{.*"error"\s*:\s*"ACTIVE_MATCH_EXISTS".*\}/);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]) as { gameName?: string; matchID?: string };
                    existingGameName = parsed.gameName;
                    existingMatchID = parsed.matchID;
                } catch { /* 降级到正则 */ }
            }
            // 降级：旧的冒号分隔格式
            if (!existingMatchID) {
                const activeMatchPattern = /ACTIVE_MATCH_EXISTS:([^:]+):([^:]+)/;
                const activeMatch = message.match(activeMatchPattern);
                if (activeMatch) {
                    [, existingGameName, existingMatchID] = activeMatch;
                }
            }
            if (existingGameName && existingMatchID) {
                setOwnerActiveMatch({
                    matchID: existingMatchID,
                    gameName: existingGameName,
                    ownerKey: getOwnerKey(),
                    ownerType: getOwnerType(),
                });
                const claimResult = await tryClaimSeat(existingMatchID, existingGameName);
                if (claimResult.success) {
                    lobbySocket.requestRefresh(normalizedGameId);
                    return;
                }
                toast.warning({ kind: 'i18n', key: 'error.activeMatchExists', ns: 'lobby' });
                void handleJoinRoom(existingMatchID, existingGameName);
                lobbySocket.requestRefresh(normalizedGameId);
                setShowCreateRoomModal(false);
                return;
            }
            const friendlyTip = buildCreateRoomErrorTip(error);
            if (friendlyTip) {
                toast.error(
                    { kind: 'i18n', key: friendlyTip.messageKey, ns: 'lobby' },
                    { kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' }
                );
                return;
            }
            toast.error({ kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async (matchID: string, overrideGameName?: string, password?: string) => {
        // 检查是否有已保存的凭证（重连场景）
        const savedCreds = localStorage.getItem(`match_creds_${matchID}`);
        if (savedCreds) {
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
                        onNavigate?.();
                        navigate(`/play/${roomGameName}/match/${matchID}?playerID=${data.playerID}`);
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
        if (!match) return;

        const roomGameName = normalizeGameName(overrideGameName || match.gameName) || normalizedGameId || 'tictactoe';

        // 检查是否有密码锁
        if (match.isLocked && !password) {
            setPasswordModalConfig({ matchID, gameName: roomGameName });
            return;
        }

        const canClaimSeat = !!(match.ownerKey && match.ownerKey === getOwnerKey());
        if (canClaimSeat) {
            const claimResult = await tryClaimSeat(matchID, roomGameName);
            if (claimResult.success) return;
            toast.error({ kind: 'i18n', key: 'error.ownerClaimFailed', ns: 'lobby' });
            return;
        }
        let targetPlayerID = '';

        try {
            const matchInfo = await matchApi.getMatch(roomGameName, matchID);
            const openSeat = [...matchInfo.players]
                .sort((a, b) => a.id - b.id)
                .find(p => !p.name);

            // 新加入逻辑：找一个空位（以服务器最新数据为准）
            if (!openSeat) {
                toast.warning({ kind: 'i18n', key: 'error.roomFull', ns: 'lobby' });
                return;
            }
            targetPlayerID = String(openSeat.id);
        } catch (error) {
            console.error('获取房间状态失败:', error);
            toast.error({ kind: 'i18n', key: 'error.joinRoomFailed', ns: 'lobby' });
            return;
        }

        try {
            // 获取用户名或生成游客名
            const playerName = user?.username || getGuestName();

            const { playerCredentials } = await matchApi.joinMatch(roomGameName, matchID, {
                playerID: targetPlayerID,
                playerName,
                data: password ? { password } : undefined,
            });

            persistMatchCredentials(matchID, {
                playerID: targetPlayerID,
                credentials: playerCredentials,
                matchID,
                gameName: roomGameName,
                playerName,
            });

            setLocalStorageTick(t => t + 1);

            onNavigate?.();
            navigate(`/play/${roomGameName}/match/${matchID}?playerID=${targetPlayerID}`);
        } catch (error) {
            console.error('Join failed:', error);
            toast.error({ kind: 'i18n', key: 'error.joinRoomFailed', ns: 'lobby' });
        }
    };

    const handlePasswordConfirm = (password: string) => {
        if (!passwordModalConfig) return;
        handleJoinRoom(passwordModalConfig.matchID, passwordModalConfig.gameName, password);
        setPasswordModalConfig(null);
    };

    const handleJoinRequest = (matchID: string, overrideGameName?: string) => {
        if (shouldPromptExitActiveMatch(myActiveRoomMatchID, matchID)) {
            setPendingJoin({ matchID, gameName: overrideGameName });
            return;
        }
        void handleJoinRoom(matchID, overrideGameName);
    };

    const handleConfirmJoin = async () => {
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
            const errorKey = result.error === 'forbidden'
                ? (isHost ? 'error.destroyForbidden' : 'error.leaveForbidden')
                : result.error === 'network'
                    ? (isHost ? 'error.destroyNetwork' : 'error.leaveNetwork')
                    : 'error.actionFailed';
            toast.error({ kind: 'i18n', key: errorKey, ns: 'lobby' });
            setPendingJoin(null);
            return;
        }

        setPendingJoin(null);
        void handleJoinRoom(nextJoin.matchID, nextJoin.gameName);
    };

    const handleCancelJoin = () => {
        setPendingJoin(null);
    };

    const handleForceExitLocal = (matchID: string) => {
        suppressOwnerActiveMatch(matchID);
        clearMatchCredentials(matchID);
        clearOwnerActiveMatch(matchID);
        setLocalStorageTick((t) => t + 1);
        toast.warning({ kind: 'i18n', key: 'error.localStateCleared', ns: 'lobby' });
    };

    const handleSpectate = (matchID: string) => {
        onNavigate?.();
        navigate(`/play/${normalizedGameId}/match/${matchID}?spectate=1`);
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

    const handleConfirmAction = async () => {
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
            setPendingAction(null);
            setLocalStorageTick(t => t + 1);
            lobbySocket.requestRefresh(normalizedGameId);
        } finally {
            isConfirmingActionRef.current = false;
            setIsConfirmingAction(false);
        }
    };

    const handleCancelAction = () => {
        if (pendingAction) {
            console.log('[LobbyModal] 取消操作', { matchID: pendingAction.matchID });
        }
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
    }, [closeModal, handleCancelAction, handleConfirmAction, openModal, pendingAction, isConfirmingAction]);

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
    }, [closeModal, handleCancelJoin, handleConfirmJoin, openModal, pendingJoin, t]);

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
        };
    }, [closeModal]);

    // 预处理带有凭据元数据的房间列表（全量）
    const allRoomItems = useMemo(() => {
        if (rooms.length === 0) return [];

        // 预先获取缓存凭据索引，避免在映射中反复查询本地存储
        const credsMap = new Map<string, any>();
        listStoredMatchCredentials().forEach((item) => {
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
                myPlayerID = parsed.playerID;
                myCredentials = parsed.credentials;
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
    }, [rooms, myActiveRoomMatchID, user, localStorageTick]);

    const roomItems = useMemo(() => {
        return allRoomItems.filter(room => room.gameKey === normalizedGameId);
    }, [allRoomItems, normalizedGameId]);

    const activeMatch = useMemo(() => {
        const latestCreds = getLatestStoredMatchCredentials();
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
    }, [localStorageTick, normalizedGameId, rooms, user]);

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
    }, [activeMatch, isOpen]);

    return (
        <>
            <ModalBase
                onClose={onClose}
                closeOnBackdrop={closeOnBackdrop}
                containerClassName="p-4 sm:p-8"
            >
                <PasswordEntryModal
                    open={!!passwordModalConfig}
                    onClose={() => setPasswordModalConfig(null)}
                    onConfirm={handlePasswordConfirm}
                    closeOnBackdrop
                />
                <div
                    ref={modalRef}
                    className="
                        bg-parchment-card-bg pointer-events-auto 
                        w-[96vw] md:w-full max-w-[28.8rem] md:max-w-[50.4rem]
                        h-[90vh] md:h-[33rem] max-h-[95vh]
                        rounded-sm shadow-parchment-card-hover 
                        flex flex-col md:flex-row 
                        border border-parchment-card-border/30 relative 
                        overflow-hidden
                    "
                >
                    {/* 装饰性边角 */}
                    <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-parchment-card-border/60" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-parchment-card-border/60" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-parchment-card-border/60" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-parchment-card-border/60" />

                    {/* 左侧面板 - 游戏信息 */}
                    <div className="relative w-full md:w-2/5 shrink-0 overflow-hidden border-b border-parchment-card-border/30 bg-parchment-base-bg/50 transition-all md:border-b-0 md:border-r">
                        <div className="flex h-full min-h-0 flex-col overflow-y-auto p-3 text-left font-serif md:items-center md:p-8 md:text-center">
                            {/* 缩略图 - 移动端隐藏，桌面端显示 */}
                            <div className="hidden md:flex w-20 h-20 bg-parchment-card-bg border border-parchment-card-border/30 rounded-[4px] shadow-sm items-center justify-center text-4xl text-parchment-base-text font-bold mb-6 overflow-hidden shrink-0">
                                {thumbnail}
                            </div>

                            {/* 标题 - 固定在顶部 */}
                            <div className="relative mb-4 min-h-[2.5rem] w-full shrink-0 pr-20 md:mb-0 md:block md:min-h-0 md:pr-0">
                                <h2 className="min-w-0 text-lg font-bold leading-tight tracking-wide text-parchment-base-text md:mb-2 md:text-2xl">
                                    {t(titleKey)}
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => setShowAuthorInfoModal(true)}
                                    className="absolute right-0 top-0 inline-flex items-center gap-1 rounded-full border border-parchment-card-border/35 bg-parchment-card-bg/90 px-2 py-1 text-[9px] font-medium leading-none tracking-[0.08em] text-parchment-light-text/85 shadow-[0_1px_0_rgba(255,255,255,0.45)_inset] transition-colors hover:border-parchment-base-text/25 hover:text-parchment-base-text cursor-pointer md:hidden"
                                    title={gameAuthorButtonHint}
                                    aria-label={gameAuthorButtonHint}
                                >
                                    <span>{t('authorInfo.mobileButton')}</span>
                                    <Info size={10} strokeWidth={2.1} className="shrink-0" />
                                </button>
                                <div className="hidden md:block h-px w-12 bg-parchment-card-border/50 opacity-30 mb-4 mx-auto" />
                            </div>

                            {/* 描述区域 - 可滚动 */}
                            <div
                                data-testid="game-details-description"
                                className="hidden md:block flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-parchment-card-border/30 scrollbar-track-transparent pr-1 mb-3 md:mb-6 min-h-0"
                            >
                                <p className="text-[11px] md:text-sm text-parchment-light-text leading-relaxed italic">
                                    {t(descriptionKey)}
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
                            <div className="mt-1 shrink-0 w-full flex flex-row gap-2 md:mt-0 md:flex-col">
                                {allowLocalMode && (
                                    <button
                                        type="button"
                                        onClick={handleLocalPlay}
                                        className="flex-1 md:w-full py-1.5 md:py-2 px-3 md:px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all flex items-center justify-center gap-2 cursor-pointer text-[10px] md:text-xs"
                                    >
                                        {t('actions.localPlay')}
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={handleTutorial}
                                    className="flex-1 md:w-full py-1.5 md:py-2 px-3 md:px-4 bg-parchment-card-bg border border-parchment-card-border/30 text-parchment-base-text font-bold rounded-[4px] hover:bg-parchment-base-bg transition-all flex items-center justify-center gap-2 cursor-pointer text-[10px] md:text-xs"
                                >
                                    {t('actions.tutorial')}
                                </button>
                            </div>

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
                            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto no-scrollbar mask-linear-fade pr-2">
                                <button
                                    onClick={() => setActiveTab('lobby')}
                                    className={clsx(
                                        "text-sm sm:text-lg font-bold tracking-wider uppercase transition-colors relative whitespace-nowrap shrink-0",
                                        activeTab === 'lobby' ? "text-parchment-base-text" : "text-parchment-light-text hover:text-parchment-base-text"
                                    )}
                                >
                                    {t('tabs.lobby')}
                                    {activeTab === 'lobby' && <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-parchment-base-text" />}
                                </button>
                                <div className="w-px bg-[#e5e0d0] h-4 sm:h-6 shrink-0" />
                                <button
                                    onClick={() => setActiveTab('changelog')}
                                    className={clsx(
                                        "text-sm sm:text-lg font-bold tracking-wider uppercase transition-colors relative whitespace-nowrap shrink-0",
                                        activeTab === 'changelog' ? "text-parchment-base-text" : "text-parchment-light-text hover:text-parchment-base-text"
                                    )}
                                >
                                    {t('tabs.changelog')}
                                    {activeTab === 'changelog' && <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-parchment-base-text" />}
                                </button>
                                <div className="w-px bg-[#e5e0d0] h-4 sm:h-6 shrink-0" />
                                <button
                                    onClick={() => setActiveTab('reviews')}
                                    className={clsx(
                                        "text-sm sm:text-lg font-bold tracking-wider uppercase transition-colors relative whitespace-nowrap shrink-0",
                                        activeTab === 'reviews' ? "text-parchment-base-text" : "text-parchment-light-text hover:text-parchment-base-text"
                                    )}
                                >
                                    {t('tabs.reviews')}
                                    {activeTab === 'reviews' && <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-parchment-base-text" />}
                                </button>
                                <div className="w-px bg-[#e5e0d0] h-4 sm:h-6 shrink-0" />
                                <button
                                    onClick={() => setActiveTab('leaderboard')}
                                    className={clsx(
                                        "text-sm sm:text-lg font-bold tracking-wider uppercase transition-colors relative whitespace-nowrap shrink-0",
                                        activeTab === 'leaderboard' ? "text-parchment-base-text" : "text-parchment-light-text hover:text-parchment-base-text"
                                    )}
                                >
                                    {t('tabs.leaderboard')}
                                    {activeTab === 'leaderboard' && <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-parchment-base-text" />}
                                </button>
                            </div>
                            <button onClick={onClose} className="p-1.5 hover:bg-parchment-base-bg rounded-full text-parchment-light-text hover:text-parchment-base-text transition-colors cursor-pointer shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {activeTab === 'lobby' && (
                            <RoomList
                                roomItems={roomItems}
                                activeMatch={activeMatch}
                                isLoading={isLoading}
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
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <GameChangelogPanel gameId={normalizedGameId} />
                            </div>
                        )}
                        {activeTab === 'reviews' && (
                            <div className="flex-1 overflow-hidden h-full">
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
                    isLoading={isLoading}
                />
            )}

            {showAuthorInfoModal && (
                <ModalBase
                    onClose={() => setShowAuthorInfoModal(false)}
                    closeOnBackdrop
                    containerClassName="p-4 sm:p-8"
                >
                    <div className="pointer-events-auto w-[min(92vw,24rem)] rounded-[8px] border border-parchment-card-border/30 bg-parchment-card-bg p-5 text-parchment-base-text shadow-parchment-card-hover">
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
                            {t('authorInfo.game', { game: t(titleKey) })}
                        </div>
                        <p className="mt-3 text-sm leading-6 text-parchment-light-text">
                            {t('authorInfo.hint')}
                        </p>
                    </div>
                </ModalBase>
            )}
        </>
    );
};

