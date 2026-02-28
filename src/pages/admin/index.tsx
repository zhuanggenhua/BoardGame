import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from './components/StatsCard';
import { Users, Gamepad2, Activity, ShieldAlert } from 'lucide-react';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import GlobalTrendChart from './components/GlobalTrendChart';
import GamePopularityChart from './components/GamePopularityChart';
import UserCompositionChart from './components/UserCompositionChart';

interface DashboardStats {
    totalUsers: number;
    totalMatches: number;
    activeUsers24h: number;
    bannedUsers: number;
    playTimeStats: Array<{
        gameName: string;
        totalDuration: number;
        avgDuration: number;
        count: number;
    }>;
}

interface TrendItem {
    date: string;
    count: number;
}

interface AdminStatsTrend {
    days: number;
    startDate: string;
    endDate: string;
    dailyUsers: TrendItem[];
    dailyMatches: TrendItem[];
    games: Array<{ name: string; count: number }>;
}

interface StatItem {
    title: string;
    value: string | number;
    icon: ReactNode;
    color: string;
    trend?: {
        value: number;
        isPositive: boolean;
        label: string;
    };
}

export default function AdminDashboard() {
    const { token } = useAuth();
    const { error } = useToast();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [trend, setTrend] = useState<AdminStatsTrend | null>(null);
    const [trendLoading, setTrendLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch(`${ADMIN_API_URL}/stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch stats');
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error(err);
                error('获取统计数据失败');
            } finally {
                setLoading(false);
            }
        };

        if (token) fetchStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    useEffect(() => {
        const fetchTrend = async () => {
            setTrendLoading(true);
            try {
                const res = await fetch(`${ADMIN_API_URL}/stats/trend?days=7`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch trend stats');
                const data = await res.json();
                setTrend(data);
            } catch (err) {
                console.error(err);
                error('获取趋势数据失败');
            } finally {
                setTrendLoading(false);
            }
        };

        if (token) fetchTrend();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    const statItems: StatItem[] = [
        {
            title: "总用户数",
            value: stats?.totalUsers ?? '-',
            icon: <Users size={24} />,
            color: "text-indigo-600 bg-indigo-50"
        },
        {
            title: "24h 活跃用户",
            value: stats?.activeUsers24h ?? '-',
            icon: <Activity size={24} />,
            color: "text-emerald-600 bg-emerald-50"
        },
        {
            title: "总对局数",
            value: stats?.totalMatches ?? '-',
            icon: <Gamepad2 size={24} />,
            color: "text-violet-600 bg-violet-50"
        },
        {
            title: "被封禁用户",
            value: stats?.bannedUsers ?? '-',
            icon: <ShieldAlert size={24} />,
            color: "text-rose-600 bg-rose-50"
        }
    ];

    const playTimeStats = stats?.playTimeStats ?? [];
    const matchCountMap = new Map((trend?.dailyMatches ?? []).map((item) => [item.date, item.count]));
    const trendData = (trend?.dailyUsers ?? []).map((item) => ({
        date: item.date,
        active: item.count,
        matches: matchCountMap.get(item.date) ?? 0
    }));

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="space-y-8 max-w-[1600px] mx-auto pb-10">
                <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">概览</h1>
                    <p className="text-zinc-500 mt-1">欢迎回来，这里是您的平台运营状态概览。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {statItems.map((item, index) => (
                        <StatsCard
                            key={index}
                            title={item.title}
                            value={item.value}
                            icon={item.icon}
                            trend={item.trend}
                            loading={loading}
                        />
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* 活跃趋势 */}
                    <GlobalTrendChart data={trendData} loading={trendLoading} />

                    {/* 游戏热度 */}
                    <GamePopularityChart stats={playTimeStats} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* 用户构成 */}
                    <UserCompositionChart
                        totalUsers={stats?.totalUsers || 0}
                        activeUsers={stats?.activeUsers24h || 0}
                        bannedUsers={stats?.bannedUsers || 0}
                    />

                    {/* Placeholder for future charts */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-indigo-500/5 to-violet-500/5 p-6 rounded-2xl border border-dashed border-indigo-200 flex items-center justify-center text-indigo-300">
                        <div className="text-center">
                            <Activity className="mx-auto mb-2 opacity-50" size={32} />
                            <p className="text-sm font-medium">更多数据源接入中...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
