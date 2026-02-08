
import { useState, useEffect } from 'react';
import { Activity, Server, Users, Wifi, AlertTriangle, Zap } from 'lucide-react';
import { lobbySocket } from '@/services/lobbySocket';
import { useLobbyStats } from '@/hooks/useLobbyStats';
import { ADMIN_API_URL } from '@/config/server';
import clsx from 'clsx';

// 模拟后端API
export default function SystemHealthPage() {
    const [socketStatus, setSocketStatus] = useState({ connected: false, reconnectAttempts: 0 });
    const { matches = [] } = useLobbyStats();
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    // 实时更新Socket状态
    useEffect(() => {
        const unsubscribe = lobbySocket.subscribeStatus((status) => {
            setSocketStatus({
                connected: status.connected,
                reconnectAttempts: 0
            });
        });

        setSocketStatus(lobbySocket.getConnectionStatus());

        return () => {
            unsubscribe();
        };
    }, []);

    // 获取真实运营数据
    useEffect(() => {
        let isMounted = true;
        const fetchStats = async () => {
            try {
                // Initial load might fail if token is not ready, rely on retry or user refresh for now
                const token = localStorage.getItem('token');
                if (!token) return;

                const res = await fetch(`${ADMIN_API_URL}/stats`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (res.ok && isMounted) {
                    const data = await res.json();
                    setStats(data);
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('[SystemHealth] Failed to fetch admin stats:', error);
            }
        };

        fetchStats();
        // 每30秒刷新一次运营数据
        const interval = setInterval(fetchStats, 30000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, []);

    // 防御性计算
    const safeMatches = Array.isArray(matches) ? matches : [];
    const totalPlayers = safeMatches.reduce((acc, m) => acc + (m?.players?.length || 0), 0);
    const activeRooms = safeMatches.length;

    // 状态指示器辅助函数
    const getStatusColor = (isHealthy: boolean) => isHealthy ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10';

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-zinc-50 min-h-full">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">系统健康监控</h1>
                <p className="text-sm text-zinc-500 mt-1">
                    实时监控平台用户活跃度、对局状态与核心业务指标 (Real Data)
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* 1. WebSocket 连接状态 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-blue-500/10 rounded-xl">
                            <Wifi size={20} className="text-blue-500" />
                        </div>
                        <span className={clsx("px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider", getStatusColor(socketStatus.connected))}>
                            {socketStatus.connected ? 'Connected' : 'Disconnected'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 font-medium">Lobby Socket</p>
                        <h3 className="text-2xl font-bold text-zinc-900 mt-1">
                            {socketStatus.connected ? '在线' : '离线'}
                        </h3>
                    </div>
                </div>

                {/* 2. 在线用户 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-violet-500/10 rounded-xl">
                            <Users size={20} className="text-violet-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 font-medium">当前活跃玩家</p>
                        <h3 className="text-2xl font-bold text-zinc-900 mt-1">{totalPlayers}</h3>
                        <p className="text-xs text-zinc-400 mt-1">分布在 {activeRooms} 个房间中</p>
                    </div>
                </div>

                {/* 3. 对局数据 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl">
                            <Activity size={20} className="text-amber-500" />
                        </div>
                        <span className="text-xs font-mono font-bold text-zinc-500">
                            Total: {stats?.totalMatches || '-'}
                        </span>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 font-medium">今日对局数</p>
                        <h3 className="text-2xl font-bold text-zinc-900 mt-1">
                            {isLoading ? '...' : (stats?.todayMatches || 0)}
                        </h3>
                    </div>
                </div>

                {/* 4. 实时房间状态 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2.5 bg-rose-500/10 rounded-xl">
                            <Zap size={20} className="text-rose-500" />
                        </div>
                    </div>
                    <div>
                        <p className="text-sm text-zinc-500 font-medium">进行中的房间</p>
                        <h3 className="text-2xl font-bold text-zinc-900 mt-1">
                            {activeRooms}
                        </h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100 lg:col-span-2">
                    <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                        <Zap size={18} className="text-amber-500" />
                        实时房间分布
                    </h3>

                    {safeMatches.length === 0 ? (
                        <div className="h-40 flex items-center justify-center text-zinc-400 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                            暂无活跃房间
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(safeMatches.reduce((acc, m) => {
                                if (m?.gameName) {
                                    acc[m.gameName] = (acc[m.gameName] || 0) + 1;
                                }
                                return acc;
                            }, {} as Record<string, number>)).map(([gameName, count]) => (
                                <div key={gameName} className="flex items-center gap-4">
                                    <div className="w-32 text-sm font-medium text-zinc-600 truncate">{gameName}</div>
                                    <div className="flex-1 h-3 bg-zinc-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-indigo-500 rounded-full"
                                            style={{ width: `${(count / safeMatches.length) * 100}%` }}
                                        />
                                    </div>
                                    <div className="w-12 text-sm font-mono text-zinc-500 text-right">{count}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* 平台概况 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-100">
                    <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
                        <Server size={18} className="text-slate-500" />
                        平台数据概览
                    </h3>

                    <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <Users size={18} className="text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-600">总注册用户</span>
                            </div>
                            <span className="font-mono font-bold text-zinc-900">{stats?.totalUsers || '-'}</span>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-xl">
                            <div className="flex items-center gap-3">
                                <AlertTriangle size={18} className="text-zinc-400" />
                                <span className="text-sm font-medium text-zinc-600">封禁用户</span>
                            </div>
                            <span className="font-mono font-bold text-red-600">{stats?.bannedUsers || 0}</span>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-8 pt-8 border-t border-zinc-200 text-center text-xs text-zinc-400">
                System Health Monitor v1.1.0 • Last updated: {new Date().toLocaleTimeString()}
            </footer>
        </div>
    );
}
