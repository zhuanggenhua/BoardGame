import { useRef, useState, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { LobbyClient } from 'boardgame.io/client';
import { useAuth } from '../../contexts/AuthContext';
import { lobbySocket, type LobbyMatch } from '../../services/lobbySocket';
import { exitMatch, getOwnerActiveMatch, setOwnerActiveMatch, clearOwnerActiveMatch, clearMatchCredentials, listStoredMatchCredentials, getLatestStoredMatchCredentials, pruneStoredMatchCredentials, persistMatchCredentials } from '../../hooks/match/useMatchStatus';
import { ConfirmModal } from '../common/overlays/ConfirmModal';
import { ModalBase } from '../common/overlays/ModalBase';
import { useModalStack } from '../../contexts/ModalStackContext';
import { useToast } from '../../contexts/ToastContext';
import { GAME_SERVER_URL } from '../../config/server';
import { getGameById } from '../../config/games.config';
import { CreateRoomModal, type RoomConfig } from './CreateRoomModal';

const lobbyClient = new LobbyClient({ server: GAME_SERVER_URL });

const normalizeGameName = (name?: string) => (name || '').toLowerCase();

interface RoomPlayer {
    id: number;
    name?: string;
}

interface Room {
    matchID: string;
    players: RoomPlayer[];
    gameName?: string;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
}

interface GameDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    gameId: string;
    titleKey: string;
    descriptionKey: string;
    thumbnail: ReactNode;
    closeOnBackdrop?: boolean;
    /** 导航前调用，通知父组件不要清理 URL */
    onNavigate?: () => void;
}

export const GameDetailsModal = ({ isOpen, onClose, gameId, titleKey, descriptionKey, thumbnail, closeOnBackdrop, onNavigate }: GameDetailsModalProps) => {
    const navigate = useNavigate();
    const modalRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();
    const { t } = useTranslation('lobby');
    const { openModal, closeModal } = useModalStack();
    const toast = useToast();
    const confirmModalIdRef = useRef<string | null>(null);
    const normalizedGameId = normalizeGameName(gameId);
    const gameManifest = getGameById(gameId);
    const allowLocalMode = gameManifest?.allowLocalMode !== false;

    // 房间列表状态
    const [rooms, setRooms] = useState<Room[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [localStorageTick, setLocalStorageTick] = useState(0);
    const [pendingAction, setPendingAction] = useState<{
        matchID: string;
        myPlayerID: string;
        myCredentials: string;
        isHost: boolean;
    } | null>(null);

    // 排行榜状态
    const [activeTab, setActiveTab] = useState<'lobby' | 'leaderboard'>('lobby');
    const [leaderboardData, setLeaderboardData] = useState<{
        leaderboard: { name: string; wins: number; matches: number }[];
    } | null>(null);

    // 创建房间弹窗状态
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);

    // Helper functions (must be defined before useMemo)
    const getGuestId = () => {
        const key = 'guest_id';
        const stored = localStorage.getItem(key);
        if (stored) return stored;
        const id = String(Math.floor(Math.random() * 9000) + 1000);
        localStorage.setItem(key, id);
        return id;
    };

    const getGuestName = () => t('player.guest', { id: getGuestId() });
    const getOwnerKey = () => (user?.id ? `user:${user.id}` : `guest:${getGuestId()}`);
    const getOwnerType = () => (user?.id ? 'user' : 'guest');

    useEffect(() => {
        if (isOpen && activeTab === 'leaderboard') {
            fetch(`${GAME_SERVER_URL}/games/${normalizedGameId}/leaderboard`)
                .then(res => res.json())
                .then(data => {
                    if (data && !data.error) {
                        setLeaderboardData(data);
                    }
                })
                .catch(err => console.error('Failed to fetch leaderboard:', err));
        }
    }, [isOpen, activeTab, normalizedGameId]);

    useEffect(() => {
        if (!isOpen) return;
        pruneStoredMatchCredentials();
    }, [isOpen]);

    // 使用 WebSocket 订阅房间列表更新（替代轮询）
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
                // 转换为 Room 格式
                const roomList: Room[] = matches.map(m => ({
                    matchID: m.matchID,
                    players: m.players,
                    gameName: m.gameName,
                    roomName: m.roomName,
                    ownerKey: m.ownerKey,
                    ownerType: m.ownerType,
                }));
                setRooms(roomList);
            });

            // 订阅连接状态
            const unsubscribeStatus = lobbySocket.subscribeStatus((status) => {
                if (status.lastError) {
                    // Surface backend connection issues to the user.
                    toast.error(
                        { kind: 'i18n', key: 'error.serviceUnavailable.desc', ns: 'lobby' },
                        { kind: 'i18n', key: 'error.serviceUnavailable.title', ns: 'lobby' },
                        { dedupeKey: 'lobbySocket.connectError' }
                    );
                }
            });

            // 请求初始数据
            lobbySocket.requestRefresh(normalizedGameId);

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
        if (ownerActive?.matchID && (!ownerActive.ownerKey || ownerActive.ownerKey === ownerKey)) {
            return ownerActive.matchID;
        }
        return null;
    }, [localStorageTick, user]);

    // 同步 ownerActiveMatch 与房间列表（避免状态滞后或丢失）
    useEffect(() => {
        const ownerKey = getOwnerKey();
        if (!ownerKey) return;
        const ownerActive = getOwnerActiveMatch();
        const matchedRoom = rooms.find(r => r.ownerKey === ownerKey);
        if (matchedRoom) {
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

    // 实际创建房间逻辑
    const handleCreateRoom = async (config: RoomConfig) => {
        setIsLoading(true);
        try {
            const { numPlayers, roomName, ttlSeconds } = config;
            // 获取用户名或生成游客名
            const playerName = user?.username || getGuestName();
            const ownerKey = getOwnerKey();
            const ownerType = getOwnerType();

            // 使用传入的 gameId，通过 setupData 传递房间名
            const setupData = {
                ...(roomName ? { roomName } : {}),
                ttlSeconds,
                ownerKey,
                ownerType,
            };
            const { matchID } = await lobbyClient.createMatch(gameId, { numPlayers, setupData });

            // 加入为 0 号玩家
            const { playerCredentials } = await lobbyClient.joinMatch(gameId, matchID, {
                playerID: '0',
                playerName,
            });

            // 保存凭据，以便 MatchRoom 获取
            persistMatchCredentials(matchID, {
                playerID: '0',
                credentials: playerCredentials,
                matchID,
                gameName: gameId, // 保存游戏名称
                playerName,
            });
            setOwnerActiveMatch({ matchID, gameName: gameId, ownerKey, ownerType });

            setLocalStorageTick(t => t + 1);
            setShowCreateRoomModal(false);

            onNavigate?.();
            navigate(`/play/${gameId}/match/${matchID}?playerID=0`);
        } catch (error) {
            console.error('Failed to create match:', error);
            const message = error instanceof Error ? error.message : String(error);
            // 解析 ACTIVE_MATCH_EXISTS:游戏ID:matchID 格式
            const activeMatchPattern = /ACTIVE_MATCH_EXISTS:([^:]+):([^:]+)/;
            const activeMatch = message.match(activeMatchPattern);
            if (activeMatch) {
                const [, existingGameName, existingMatchID] = activeMatch;
                setOwnerActiveMatch({
                    matchID: existingMatchID,
                    gameName: existingGameName,
                    ownerKey: getOwnerKey(),
                    ownerType: getOwnerType(),
                });
                toast.warning(
                    { kind: 'i18n', key: 'error.activeMatchExists', ns: 'lobby' },
                    undefined,
                    {
                        action: {
                            label: t('action.rejoinRoom'),
                            onClick: () => handleJoinRoom(existingMatchID, existingGameName),
                        },
                    }
                );
                lobbySocket.requestRefresh(normalizedGameId);
                setShowCreateRoomModal(false);
                return;
            }
            toast.error({ kind: 'i18n', key: 'error.createRoomFailed', ns: 'lobby' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinRoom = async (matchID: string, overrideGameName?: string) => {
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
                    const matchInfo = await lobbyClient.getMatch(roomGameName, matchID);
                    const seat = matchInfo.players.find(p => String(p.id) === String(data?.playerID));
                    const seatTakenByOther = !!(seat?.name && storedPlayerName && seat.name !== storedPlayerName);

                    if (!seat || seatTakenByOther) {
                        clearMatchCredentials(matchID);
                    } else {
                        // 直接重连：让 server/client 侧用 credentials 校验
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
        let targetPlayerID = '';

        try {
            const matchInfo = await lobbyClient.getMatch(roomGameName, matchID);
            const player0 = matchInfo.players.find(p => p.id === 0);
            const player1 = matchInfo.players.find(p => p.id === 1);

            // 新加入逻辑：找一个空位（以服务器最新数据为准）
            if (!player0?.name) targetPlayerID = '0';
            else if (!player1?.name) targetPlayerID = '1';
            else {
                toast.warning({ kind: 'i18n', key: 'error.roomFull', ns: 'lobby' });
                return;
            }
        } catch (error) {
            console.error('获取房间状态失败:', error);
            toast.error({ kind: 'i18n', key: 'error.joinRoomFailed', ns: 'lobby' });
            return;
        }

        try {
            // 获取用户名或生成游客名
            const playerName = user?.username || getGuestName();

            const { playerCredentials } = await lobbyClient.joinMatch(roomGameName, matchID, {
                playerID: targetPlayerID,
                playerName,
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

    const handleAction = (matchID: string, myPlayerID: string, myCredentials: string, isHost: boolean) => {
        console.log('[LobbyModal] 点击销毁/离开', {
            matchID,
            myPlayerID,
            hasCredentials: !!myCredentials,
            isHost,
        });
        setPendingAction({ matchID, myPlayerID, myCredentials, isHost });
    };

    const handleConfirmAction = async () => {
        if (!pendingAction) return;
        const { matchID, myPlayerID, myCredentials, isHost } = pendingAction;
        console.log('[LobbyModal] 确认执行', { matchID, myPlayerID, isHost });

        // 尝试从本地存储或房间列表获取 gameName
        const saved = localStorage.getItem(`match_creds_${matchID}`);
        let gameName = gameId; // 默认使用当前模态框的 gameId
        if (saved) {
            const data = JSON.parse(saved);
            if (data.gameName) gameName = data.gameName;
        } else {
            // 如果本地没有，尝试从 rooms 列表找
            const room = rooms.find(r => r.matchID === matchID);
            if (room?.gameName) gameName = room.gameName;
        }

        const success = await exitMatch(gameName, matchID, myPlayerID, myCredentials, isHost);
        console.log('[LobbyModal] 执行完成', { success });
        if (!success) {
            toast.error({ kind: 'i18n', key: 'error.actionFailed', ns: 'lobby' });
            return;
        }
        setPendingAction(null);
        setLocalStorageTick(t => t + 1);
        lobbySocket.requestRefresh(normalizedGameId);
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
                        open
                        title={pendingAction.isHost ? t('confirm.destroy.title') : t('confirm.leave.title')}
                        description={pendingAction.isHost ? t('confirm.destroy.description') : t('confirm.leave.description')}
                        onConfirm={() => {
                            handleConfirmAction();
                        }}
                        onCancel={() => {
                            close();
                        }}
                        tone="cool"
                        closeOnBackdrop={stackCloseOnBackdrop}
                    />
                ),
            });
        }

        if (!pendingAction && confirmModalIdRef.current) {
            closeModal(confirmModalIdRef.current);
            confirmModalIdRef.current = null;
        }
    }, [closeModal, handleCancelAction, handleConfirmAction, openModal, pendingAction]);

    useEffect(() => {
        return () => {
            if (confirmModalIdRef.current) {
                closeModal(confirmModalIdRef.current);
                confirmModalIdRef.current = null;
            }
        };
    }, [closeModal]);

    // 预处理带有凭据元数据的房间列表（全量）
    const allRoomItems = useMemo(() => {
        if (rooms.length === 0) return [];

        // 预先获取缓存的 creds 索引，避免在 map 中反复查询 localStorage.getItem
        const credsMap = new Map<string, any>();
        listStoredMatchCredentials().forEach((item) => {
            if (item.matchID) {
                credsMap.set(item.matchID, item);
            }
        });

        const ownerKey = getOwnerKey();
        return rooms.map(room => {
            const p0 = room.players[0]?.name;
            const p1 = room.players[1]?.name;
            const playerCount = (p0 ? 1 : 0) + (p1 ? 1 : 0);
            const isFull = playerCount >= 2;

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
                p0, p1,
                isFull,
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

    return (
        <>
            <ModalBase
                open={isOpen}
                onClose={onClose}
                closeOnBackdrop={closeOnBackdrop}
                containerClassName="p-4 sm:p-8"
            >
                <div
                    ref={modalRef}
                    className="
                        bg-[#fcfbf9] pointer-events-auto 
                        w-full max-w-2xl 
                        h-[27.5rem] max-h-[85vh]
                        rounded-sm shadow-[0_10px_40px_rgba(67,52,34,0.15)] 
                        flex flex-col md:flex-row 
                        border border-[#e5e0d0] relative 
                        overflow-hidden
                    "
                >
                    {/* 装饰性边角 */}
                    <div className="absolute top-2 left-2 w-3 h-3 border-t border-l border-[#c0a080]" />
                    <div className="absolute top-2 right-2 w-3 h-3 border-t border-r border-[#c0a080]" />
                    <div className="absolute bottom-2 left-2 w-3 h-3 border-b border-l border-[#c0a080]" />
                    <div className="absolute bottom-2 right-2 w-3 h-3 border-b border-r border-[#c0a080]" />

                    {/* 左侧面板 - 游戏信息 */}
                    <div className="w-full md:w-2/5 bg-[#f3f0e6]/50 border-b md:border-b-0 md:border-r border-[#e5e0d0] p-6 sm:p-8 flex flex-col items-center text-center font-serif shrink-0">
                        <div className="w-20 h-20 bg-[#fcfbf9] border border-[#e5e0d0] rounded-[4px] shadow-sm flex items-center justify-center text-4xl text-[#433422] font-bold mb-6 overflow-hidden">
                            {thumbnail}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-[#433422] mb-2 tracking-wide">{t(titleKey, { defaultValue: titleKey })}</h2>
                        <div className="h-px w-12 bg-[#c0a080] opacity-30 mb-4" />
                        <p className="text-xs sm:text-sm text-[#8c7b64] mb-8 leading-relaxed italic">
                            {t(descriptionKey, { defaultValue: descriptionKey })}
                        </p>

                        <div className="mt-auto w-full">
                            {allowLocalMode && (
                                <button
                                    type="button"
                                    onClick={handleLocalPlay}
                                    className="w-full py-2 px-4 bg-[#fcfbf9] border border-[#e5e0d0] text-[#433422] font-bold rounded-[4px] hover:bg-[#efede6] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs mb-2"
                                >
                                    {t('actions.localPlay')}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleTutorial}
                                className="w-full py-2 px-4 bg-[#fcfbf9] border border-[#e5e0d0] text-[#433422] font-bold rounded-[4px] hover:bg-[#efede6] transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                            >
                                {t('actions.tutorial')}
                            </button>
                        </div>
                    </div>

                    {/* 右侧面板 - 大厅/排行 */}
                    <div className="flex-1 p-6 sm:p-8 flex flex-col bg-[#fcfbf9] font-serif overflow-hidden">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex gap-4">
                                <button
                                    onClick={() => setActiveTab('lobby')}
                                    className={clsx(
                                        "text-lg font-bold tracking-wider uppercase transition-colors relative",
                                        activeTab === 'lobby' ? "text-[#433422]" : "text-[#8c7b64] hover:text-[#433422]"
                                    )}
                                >
                                    {t('tabs.lobby')}
                                    {activeTab === 'lobby' && <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#433422]" />}
                                </button>
                                <div className="w-px bg-[#e5e0d0] h-6" />
                                <button
                                    onClick={() => setActiveTab('leaderboard')}
                                    className={clsx(
                                        "text-lg font-bold tracking-wider uppercase transition-colors relative",
                                        activeTab === 'leaderboard' ? "text-[#433422]" : "text-[#8c7b64] hover:text-[#433422]"
                                    )}
                                >
                                    {t('tabs.leaderboard')}
                                    {activeTab === 'leaderboard' && <div className="absolute -bottom-1 left-0 w-full h-0.5 bg-[#433422]" />}
                                </button>
                            </div>
                            <button onClick={onClose} className="p-1 hover:bg-[#efede6] rounded-full text-[#8c7b64] hover:text-[#433422] transition-colors cursor-pointer">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {activeTab === 'lobby' ? (
                            <>
                                {/* 创建操作 */}
                                <div className="mb-6">
                                    {(() => {
                                        // 检查用户是否已在对局中
                                        if (activeMatch) {
                                            return (
                                                <div className="w-full py-3 px-4 bg-[#f8f4e8] border border-[#c0a080] rounded-[4px] flex flex-col items-center gap-2">
                                                    <span className="text-xs text-[#8c7b64] font-bold uppercase tracking-wider">
                                                        {t('activeMatch.notice')}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleJoinRoom(activeMatch.matchID, activeMatch.gameName)}
                                                            className="px-4 py-1.5 bg-[#c0a080] text-white text-xs font-bold rounded hover:bg-[#a08060] transition-colors cursor-pointer uppercase tracking-wider"
                                                        >
                                                            {t('activeMatch.return', { id: activeMatch.matchID.slice(0, 4) })}
                                                        </button>
                                                        {activeMatch.canReconnect && activeMatch.myPlayerID && activeMatch.myCredentials && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAction(activeMatch.matchID, activeMatch.myPlayerID!, activeMatch.myCredentials!, activeMatch.isHost);
                                                                }}
                                                                className={clsx(
                                                                    "px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider border",
                                                                    activeMatch.isHost
                                                                        ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                                                        : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                                                )}
                                                            >
                                                                {activeMatch.isHost ? t('actions.destroy') : t('actions.leave')}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <button
                                                onClick={handleOpenCreateRoom}
                                                disabled={isLoading}
                                                className="w-full py-3 bg-[#433422] hover:bg-[#2b2114] text-[#fcfbf9] font-bold rounded-[4px] shadow-md hover:shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm uppercase tracking-widest"
                                            >
                                                {isLoading ? t('button.processing') : t('actions.createRoom')}
                                            </button>
                                        );
                                    })()}
                                </div>

                                {/* 房间列表 */}
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {roomItems.length === 0 ? (
                                        <div className="text-center text-[#8c7b64] py-10 italic text-sm border border-dashed border-[#e5e0d0] rounded-[4px]">
                                            {t('rooms.empty')}
                                        </div>
                                    ) : (
                                        roomItems.map((room) => (
                                            <div
                                                key={room.matchID}
                                                className={clsx(
                                                    "flex items-center justify-between p-3 rounded-[4px] border transition-colors",
                                                    room.isMyRoom
                                                        ? "border-[#c0a080] bg-[#f8f4e8]"
                                                        : "border-[#e5e0d0] bg-[#fcfbf9] hover:bg-[#f3f0e6]/30"
                                                )}
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[#433422] text-sm">
                                                            {room.roomName || t('rooms.matchTitle', { id: room.matchID.slice(0, 4) })}
                                                        </span>
                                                        {room.isMyRoom && (
                                                            <span className="text-[8px] bg-[#c0a080] text-white px-1.5 py-0.5 rounded uppercase font-bold">
                                                                {t('rooms.mine')}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-[#8c7b64] mt-0.5">
                                                        {room.p0 || t('rooms.emptySlot')} vs {room.p1 || t('rooms.emptySlot')}
                                                    </div>
                                                </div>

                                                <div className="flex gap-2">
                                                    {room.canReconnect && room.myPlayerID && room.myCredentials && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAction(room.matchID, room.myPlayerID!, room.myCredentials!, room.isHost);
                                                            }}
                                                            className={clsx(
                                                                "px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider border",
                                                                room.isHost
                                                                    ? "bg-red-50 text-red-600 border-red-200 hover:bg-red-100"
                                                                    : "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100"
                                                            )}
                                                        >
                                                            {room.isHost ? t('actions.destroy') : t('actions.leave')}
                                                        </button>
                                                    )}

                                                    {/* 满员房间：显示观战按钮（眼睛图标） */}
                                                    {room.isFull && !room.canReconnect && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onNavigate?.();
                                                                navigate(`/play/${normalizedGameId}/match/${room.matchID}?spectate=1`);
                                                            }}
                                                            className="p-1.5 rounded-[4px] text-[#8c7b64] hover:text-[#433422] hover:bg-[#f3f0e6] transition-all cursor-pointer border border-[#e5e0d0]"
                                                            title={t('actions.spectate')}
                                                        >
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                            </svg>
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => handleJoinRoom(room.matchID)}
                                                        disabled={(room.isFull && !room.canReconnect) || (!!myActiveRoomMatchID && !room.canReconnect)}
                                                        className={clsx(
                                                            "px-3 py-1.5 rounded-[4px] text-[10px] font-bold transition-all cursor-pointer uppercase tracking-wider",
                                                            room.canReconnect
                                                                ? "bg-[#c0a080] text-white hover:bg-[#a08060]"
                                                                : (room.isFull || (!!myActiveRoomMatchID && !room.canReconnect))
                                                                    ? "bg-[#e5e0d0] text-[#8c7b64] cursor-not-allowed"
                                                                    : "bg-[#433422] text-[#fcfbf9] hover:bg-[#2b2114]"
                                                        )}
                                                        title={myActiveRoomMatchID && !room.canReconnect ? t('rooms.inAnotherMatch') : undefined}
                                                    >
                                                        {room.canReconnect
                                                            ? t('actions.reconnect')
                                                            : (myActiveRoomMatchID && !room.canReconnect)
                                                                ? t('rooms.inProgress')
                                                                : room.isFull
                                                                    ? t('rooms.full')
                                                                    : t('actions.join')}
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                {!leaderboardData ? (
                                    <div className="flex items-center justify-center h-40">
                                        <p className="text-[#8c7b64] italic">{t('leaderboard.loading')}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* 胜场排行 */}
                                        <section>
                                            <h4 className="text-xs font-bold text-[#8c7b64] uppercase tracking-widest mb-3">{t('leaderboard.title')}</h4>
                                            {leaderboardData.leaderboard.length === 0 ? (
                                                <p className="text-sm text-[#433422]/60 italic">{t('leaderboard.empty')}</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {leaderboardData.leaderboard.map((player, idx) => (
                                                        <div key={idx} className="flex justify-between items-center py-2 border-b border-[#e5e0d0]/50 text-sm">
                                                            <div className="flex items-center gap-3">
                                                                <span className={clsx(
                                                                    "w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold",
                                                                    idx === 0 ? "bg-yellow-400 text-yellow-900" :
                                                                        idx === 1 ? "bg-gray-300 text-gray-800" :
                                                                            idx === 2 ? "bg-orange-300 text-orange-900" :
                                                                                "bg-[#f3f0e6] text-[#8c7b64]"
                                                                )}>
                                                                    {idx + 1}
                                                                </span>
                                                                <span className="font-bold text-[#433422]">{player.name}</span>
                                                            </div>
                                                            <span className="text-[#8c7b64] text-xs font-mono">
                                                                {t('leaderboard.record', { wins: player.wins, matches: player.matches })}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </section>
                                    </div>
                                )}
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
        </>
    );
};

