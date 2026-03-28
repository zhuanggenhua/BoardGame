import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Server, Users, Wifi, Zap } from 'lucide-react';
import clsx from 'clsx';
import { ADMIN_API_URL } from '../../config/server';
import { useAuth } from '../../contexts/AuthContext';
import { useLobbyStats } from '../../hooks/useLobbyStats';
import { lobbySocket } from '../../services/lobbySocket';
import RoomPlayerStatusList, { type RoomPresencePlayer } from './components/RoomPlayerStatusList';
import { summarizeRoomPlayers } from './utils/roomPresence';

type LobbyRoom = {
    matchID: string;
    gameName: string;
    roomName?: string;
    players: RoomPresencePlayer[];
};

type AdminStats = {
    totalUsers: number;
    totalMatches: number;
    todayMatches: number;
    bannedUsers: number;
};

const resolveRoomTitle = (room: LobbyRoom) => room.roomName?.trim() || room.matchID.slice(0, 8);

export default function SystemHealthPage() {
    const { token } = useAuth();
    const [socketStatus, setSocketStatus] = useState({ connected: false, reconnectAttempts: 0 });
    const { matches = [] } = useLobbyStats();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [persistedRoomTotal, setPersistedRoomTotal] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = lobbySocket.subscribeStatus((status) => {
            setSocketStatus({
                connected: status.connected,
                reconnectAttempts: 0,
            });
        });

        setSocketStatus(lobbySocket.getConnectionStatus());
        return () => {
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        const fetchStats = async () => {
            if (!token) {
                if (isMounted) {
                    setStats(null);
                    setPersistedRoomTotal(null);
                    setIsLoading(false);
                }
                return;
            }

            try {
                const [statsRes, roomsRes] = await Promise.all([
                    fetch(`${ADMIN_API_URL}/stats`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                    fetch(`${ADMIN_API_URL}/rooms?page=1&limit=1`, {
                        headers: { Authorization: `Bearer ${token}` },
                    }),
                ]);

                if (!isMounted) {
                    return;
                }

                if (statsRes.ok) {
                    const data = await statsRes.json();
                    setStats(data);
                }

                if (roomsRes.ok) {
                    const roomsData = await roomsRes.json();
                    setPersistedRoomTotal(Number(roomsData?.total ?? 0));
                }
            } catch {
                if (!isMounted) {
                    return;
                }
                setStats(null);
                setPersistedRoomTotal(null);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        void fetchStats();
        const interval = window.setInterval(() => {
            void fetchStats();
        }, 30000);

        return () => {
            isMounted = false;
            window.clearInterval(interval);
        };
    }, [token]);

    const safeMatches = useMemo(() => (
        Array.isArray(matches) ? (matches as LobbyRoom[]) : []
    ), [matches]);
    const groupedRooms = useMemo(() => {
        return safeMatches.reduce<Record<string, LobbyRoom[]>>((acc, room) => {
            const key = room.gameName || 'unknown';
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(room);
            return acc;
        }, {});
    }, [safeMatches]);

    const totalPlayers = safeMatches.reduce((acc, room) => acc + room.players.length, 0);
    const onlinePlayers = safeMatches.reduce((acc, room) => acc + summarizeRoomPlayers(room.players).connected, 0);
    const activeRooms = safeMatches.length;

    const getStatusColor = (isHealthy: boolean) => (
        isHealthy ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
    );

    return (
        <div className="min-h-full flex-1 overflow-y-auto bg-zinc-50 p-8">
            <header className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight text-zinc-900">系统健康监控</h1>
                <p className="mt-1 text-sm text-zinc-500">
                    实时查看平台房间、玩家在线状态与后台核心指标
                </p>
            </header>

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="rounded-xl bg-blue-500/10 p-2.5">
                            <Wifi size={20} className="text-blue-500" />
                        </div>
                        <span className={clsx('rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider', getStatusColor(socketStatus.connected))}>
                            {socketStatus.connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">Lobby Socket</p>
                        <h3 className="mt-1 text-2xl font-bold text-zinc-900">
                            {socketStatus.connected ? '在线' : '离线'}
                        </h3>
                    </div>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="rounded-xl bg-violet-500/10 p-2.5">
                            <Users size={20} className="text-violet-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">实时在线玩家</p>
                        <h3 className="mt-1 text-2xl font-bold text-zinc-900">{onlinePlayers}</h3>
                        <p className="mt-1 text-xs text-zinc-400">总入座 {totalPlayers} 人，分布在 {activeRooms} 个实时房间中</p>
                    </div>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="rounded-xl bg-amber-500/10 p-2.5">
                            <Activity size={20} className="text-amber-500" />
                        </div>
                        <span className="text-xs font-mono font-bold text-zinc-500">
                            Total: {stats?.totalMatches ?? '-'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">今日对局数</p>
                        <h3 className="mt-1 text-2xl font-bold text-zinc-900">
                            {isLoading ? '...' : (stats?.todayMatches ?? 0)}
                        </h3>
                    </div>
                </div>

                <div className="flex flex-col justify-between rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div className="rounded-xl bg-rose-500/10 p-2.5">
                            <Zap size={20} className="text-rose-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-zinc-500">实时房间（含游客）</p>
                        <h3 className="mt-1 text-2xl font-bold text-zinc-900">{activeRooms}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm lg:col-span-2">
                    <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-zinc-900">
                        <Zap size={18} className="text-amber-500" />
                        实时房间分布（含游客）
                    </h3>

                    {safeMatches.length === 0 ? (
                        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50 text-zinc-400">
                            暂无活跃房间
                        </div>
                    ) : (
                        <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
                            {Object.entries(groupedRooms).map(([gameName, rooms]) => (
                                <section key={gameName} className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <div className="font-semibold capitalize text-zinc-900">{gameName}</div>
                                            <div className="text-xs text-zinc-500">{rooms.length} 个实时房间</div>
                                        </div>
                                        <div className="text-xs font-medium text-zinc-500">
                                            {rooms.reduce((sum, room) => sum + summarizeRoomPlayers(room.players).connected, 0)}
                                            /
                                            {rooms.reduce((sum, room) => sum + room.players.length, 0)} 在线
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {rooms.map((room) => {
                                            const summary = summarizeRoomPlayers(room.players);
                                            return (
                                                <article
                                                    key={room.matchID}
                                                    className="rounded-xl border border-zinc-200 bg-white p-3"
                                                >
                                                    <div className="mb-2 flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <div className="truncate text-sm font-semibold text-zinc-900">
                                                                {resolveRoomTitle(room)}
                                                            </div>
                                                            <div className="font-mono text-[11px] text-zinc-400">
                                                                {room.matchID}
                                                            </div>
                                                        </div>
                                                        <div className="whitespace-nowrap text-xs font-medium text-zinc-500">
                                                            {summary.connected}/{summary.total} 在线
                                                        </div>
                                                    </div>
                                                    <RoomPlayerStatusList
                                                        players={room.players}
                                                        compact
                                                        emptyLabel="暂无玩家入座"
                                                    />
                                                </article>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-white p-6 shadow-sm">
                    <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-zinc-900">
                        <Server size={18} className="text-slate-500" />
                        平台数据概览
                    </h3>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4">
                            <div className="flex items-center gap-3">
                                <Users size={18} className="text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-600">总注册用户</span>
                            </div>
                            <span className="font-mono font-bold text-zinc-900">{stats?.totalUsers ?? '-'}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4">
                            <div className="flex items-center gap-3">
                                <Zap size={18} className="text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-600">持久化房间</span>
                            </div>
                            <span className="font-mono font-bold text-zinc-900">{persistedRoomTotal ?? '-'}</span>
                        </div>

                        <div className="flex items-center justify-between rounded-xl bg-zinc-50 p-4">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={18} className="text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-600">封禁用户</span>
                            </div>
                            <span className="font-mono font-bold text-red-600">{stats?.bannedUsers ?? 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-8 border-t border-zinc-200 pt-8 text-center text-xs text-zinc-400">
                System Health Monitor v1.2.0 · Last updated: {new Date().toLocaleTimeString('zh-CN')}
            </footer>
        </div>
    );
}
