import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import {
    ArrowLeft, Calendar, Ban, CheckCircle, Clock,
    Trophy, Gamepad2, Swords, MessageSquare, Trash2,
    ShieldAlert, Activity
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ImageLightbox from '../../components/common/ImageLightbox';
import DataTable, { type Column } from './components/DataTable';

// --- Types ---

interface UserDetail {
    id: string;
    username: string;
    email?: string;
    role: string;
    banned: boolean;
    bannedReason?: string;
    bannedAt?: string;
    createdAt: string;
    lastOnline?: string;
    avatar?: string;
}

interface UserStats {
    totalMatches: number;
    wins: number;
    winRate: number;
}

interface matchID {
    matchID: string;
    gameName: string;
    result: string;
    winnerID?: string;
    players: { id: string; name: string }[];
    endedAt: string;
}

interface MatchTableItem {
    id: string;
    matchID: string;
    gameName: string;
    result: string;
    opponent: string;
    endedAt: string;
}

// --- Component ---

export default function UserDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { error: toastError, success } = useToast();

    // State
    const [user, setUser] = useState<UserDetail | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [recentMatches, setRecentMatches] = useState<matchID[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Fetch Data
    const fetchUser = async () => {
        if (!id || !token) return;
        setLoading(true);
        try {
            const res = await fetch(`${ADMIN_API_URL}/users/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch user');
            const data = await res.json();
            setUser(data.user);
            if (data.stats) setStats(data.stats);

            // Fetch Matches to calc stats locally if needed
            const matchesQuery = new URLSearchParams({ search: id, limit: '100' });
            const matchesRes = await fetch(`${ADMIN_API_URL}/matches?${matchesQuery.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (matchesRes.ok) {
                const matchesData = await matchesRes.json();
                const items = matchesData.items || [];
                setRecentMatches(items);

                // Fallback stats calculation
                if ((!data.stats || data.stats.totalMatches === 0) && items.length > 0) {
                    const total = matchesData.total || items.length;
                    const wins = items.filter((m: any) => {
                        const resStr = String(m.result || '').toUpperCase();
                        if (resStr.includes('WIN') || resStr.includes('VICTORY')) return true;
                        if (m.winnerID && m.winnerID === id) return true;
                        return false;
                    }).length;

                    setStats({
                        totalMatches: total,
                        wins: wins,
                        winRate: total > 0 ? (wins / Math.min(total, items.length)) * 100 : 0
                    });
                }
            } else if (data.recentMatches) {
                setRecentMatches(data.recentMatches);
            }

        } catch (err) {
            console.error(err);
            toastError('获取详情失败');
            navigate('/admin/users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, token]);

    // --- Actions ---

    const handleBanToggle = async () => {
        if (!user) return;
        if (!confirm(`确定要${user.banned ? '解封' : '封禁'}该用户吗？`)) return;

        try {
            const isBanning = !user.banned;
            const action = isBanning ? 'ban' : 'unban';
            const reason = isBanning ? (prompt('请输入封禁原因') ?? '').trim() : '';
            if (isBanning && !reason) {
                toastError('封禁原因不能为空');
                return;
            }
            const res = await fetch(`${ADMIN_API_URL}/users/${user.id}/${action}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    ...(isBanning ? { 'Content-Type': 'application/json' } : {})
                },
                body: isBanning ? JSON.stringify({ reason }) : undefined,
            });

            if (!res.ok) throw new Error('Action failed');
            success('操作成功');
            fetchUser();
        } catch (err) {
            console.error(err);
            toastError('操作失败');
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        if (user.role === 'admin') {
            toastError('不能删除管理员账号');
            return;
        }
        if (!confirm('确定要删除该用户吗？删除后无法恢复。')) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Delete failed');
            success('用户已删除');
            navigate('/admin/users');
        } catch (err) {
            toastError('删除失败');
        }
    };

    const handleSendMessage = () => toastError('这是演示功能，尚未实装');

    // --- Render Helpers ---

    const tableData: MatchTableItem[] = recentMatches.map(m => {
        let resultLabel = m.result;
        if (typeof resultLabel !== 'string') {
            if (m.winnerID) resultLabel = m.winnerID === user?.id ? 'WIN' : 'LOSS';
            else resultLabel = 'DRAW';
        }

        let opponent = '未知对手';
        if (m.players && m.players.length > 0) {
            const opp = m.players.find(p => p.id !== user?.id);
            if (opp) opponent = opp.name || '未知对手';
        }

        return {
            id: m.matchID,
            matchID: m.matchID,
            gameName: m.gameName,
            result: resultLabel,
            opponent: opponent,
            endedAt: m.endedAt
        };
    });

    const columns: Column<MatchTableItem>[] = [
        {
            header: '结果',
            accessorKey: 'result',
            width: '80px',
            align: 'center', // Centered result
            cell: (m) => {
                const resStr = String(m.result || '').toUpperCase();
                const isWin = resStr.includes('WIN') || resStr.includes('VICTORY');
                const isLoss = resStr.includes('LOSS') || resStr.includes('DEFEAT');
                const isDraw = !isWin && !isLoss;
                return (
                    <div className="flex justify-center">
                        <span className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded-md border text-center min-w-[48px]",
                            isWin ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                isDraw ? "bg-zinc-100 text-zinc-600 border-zinc-200" :
                                    "bg-red-50 text-red-600 border-red-100"
                        )}>
                            {isWin ? '胜利' : isDraw ? '平局' : '失败'}
                        </span>
                    </div>
                );
            }
        },
        {
            header: '游戏',
            accessorKey: 'gameName',
            className: 'pl-4',
            cell: (m) => (
                <div className="flex items-center gap-2 pl-4">
                    <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        m.gameName === 'dicethrone' ? "bg-orange-500" :
                            m.gameName === 'smashup' ? "bg-purple-500" :
                                "bg-blue-500"
                    )} />
                    <span className="capitalize font-medium text-zinc-700 text-xs truncate max-w-[100px]">{m.gameName}</span>
                </div>
            )
        },
        {
            header: '对手',
            accessorKey: 'opponent',
            cell: (m) => (
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[9px] text-zinc-500 font-bold overflow-hidden shrink-0">
                        {m.opponent[0]?.toUpperCase()}
                    </div>
                    <span className="text-zinc-600 text-xs font-medium truncate max-w-[80px]" title={m.opponent}>
                        {m.opponent}
                    </span>
                </div>
            )
        },
        {
            header: '时间',
            accessorKey: 'endedAt',
            align: 'right', // Right aligned date
            className: 'custom-date-col',
            cell: (m) => <span className="text-zinc-400 text-[10px] font-mono whitespace-nowrap">{new Date(m.endedAt).toLocaleDateString()}</span>
        }
    ];

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
    );
    if (!user) return null;

    return (
        <div className="h-full flex flex-col bg-zinc-50/30 overflow-hidden"> {/* Root: Filling Height & No Scroll */}

            {/* 1. Compact User Header (Top Fixed Area) */}
            <div className="flex-none bg-white border-b border-zinc-200 px-6 py-4 shadow-sm z-10">
                <div className="flex items-center gap-4 max-w-[1400px] mx-auto">
                    <button
                        onClick={() => navigate('/admin/users')}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
                        title="返回用户列表"
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex-1 flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 p-0.5 overflow-hidden shrink-0 cursor-pointer"
                            onClick={() => user.avatar && setPreviewImage(user.avatar)}>
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.username} className="w-full h-full object-cover rounded-full" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-50 text-xs font-bold text-zinc-300">
                                    {user.username[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-zinc-900 truncate">{user.username}</h1>
                                {user.role === 'admin' && (
                                    <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded font-bold shadow-sm">
                                        ADMIN
                                    </span>
                                )}
                                {user.banned && (
                                    <span className="bg-red-50 text-red-600 border border-red-100 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                        已封禁
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono mt-0.5">
                                <span>ID: {user.id}</span>
                                <span className="hidden sm:inline">|</span>
                                <span className="hidden sm:inline truncate max-w-[200px]">{user.email || '未绑定邮箱'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleSendMessage}
                            className="h-8 px-3 bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                        >
                            <MessageSquare size={14} /> <span className="hidden sm:inline">发消息</span>
                        </button>
                        <button
                            onClick={handleBanToggle}
                            className={cn(
                                "h-8 px-3 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm border",
                                user.banned
                                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100"
                                    : "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                            )}
                        >
                            {user.banned ? <CheckCircle size={14} /> : <Ban size={14} />}
                            <span className="hidden sm:inline">{user.banned ? '解封' : '封禁'}</span>
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={user.role === 'admin'}
                            className="h-8 w-8 flex items-center justify-center text-zinc-400 border border-transparent hover:border-red-100 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="删除用户"
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Scrollable Content Area */}
            <div className="flex-1 overflow-hidden min-h-0 bg-zinc-50/50 p-6 flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full max-w-[1400px] mx-auto w-full">

                    {/* Left Panel: Stats & Info (Fixed Height/Scrollable if needed) */}
                    <div className="lg:col-span-4 flex flex-col gap-6 ">
                        {/* Stats Card */}
                        <div className="bg-white rounded-xl border border-zinc-200/60 shadow-sm p-5 shrink-0">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Activity size={14} /> 活跃数据
                            </h3>
                            {stats ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 bg-zinc-50/50 rounded-lg border border-zinc-100">
                                        <div className="flex items-center gap-2 text-zinc-600">
                                            <Gamepad2 size={16} />
                                            <span className="text-sm font-medium">总场次</span>
                                        </div>
                                        <span className="text-xl font-bold text-zinc-900 tabular-nums">{stats.totalMatches}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100/50">
                                            <div className="flex items-center gap-1.5 text-emerald-600 mb-1">
                                                <Trophy size={14} />
                                                <span className="text-xs font-bold">胜场</span>
                                            </div>
                                            <span className="text-2xl font-bold text-emerald-700 tabular-nums">{stats.wins}</span>
                                        </div>
                                        <div className="p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                            <div className="flex items-center gap-1.5 text-indigo-600 mb-1">
                                                <Swords size={14} />
                                                <span className="text-xs font-bold">胜率</span>
                                            </div>
                                            <span className="text-2xl font-bold text-indigo-700 tabular-nums">{Math.round(stats.winRate)}%</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-zinc-400 text-sm">暂无数据</div>
                            )}
                        </div>

                        {/* Info Card */}
                        <div className="bg-white rounded-xl border border-zinc-200/60 shadow-sm p-5 shrink-0">
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <ShieldAlert size={14} /> 账户信息
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm py-1 border-b border-dashed border-zinc-100">
                                    <span className="text-zinc-500 flex items-center gap-2">
                                        <Calendar size={14} /> 注册时间
                                    </span>
                                    <span className="font-mono text-zinc-700">{new Date(user.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm py-1 border-b border-dashed border-zinc-100">
                                    <span className="text-zinc-500 flex items-center gap-2">
                                        <Clock size={14} /> 最后活跃
                                    </span>
                                    <span className="font-mono text-zinc-700">{user.lastOnline ? new Date(user.lastOnline).toLocaleDateString() : '从未'}</span>
                                </div>
                                {user.banned && (
                                    <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs">
                                        <p className="font-bold text-red-800 mb-1">封禁详情</p>
                                        <p className="text-red-600 mb-1">原因: {user.bannedReason || '未说明'}</p>
                                        <p className="text-red-500/80 font-mono text-[10px]">{user.bannedAt && new Date(user.bannedAt).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Match History (Full Height, Internal Scroll) */}
                    <div className="lg:col-span-8 flex flex-col bg-white rounded-xl border border-zinc-200/60 shadow-sm overflow-hidden h-full min-h-0">
                        <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/30 shrink-0">
                            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                <Gamepad2 size={16} className="text-indigo-500" />
                                近期对局记录
                            </h3>
                            <span className="text-[10px] font-medium text-zinc-400 bg-white px-2 py-1 rounded border border-zinc-100">
                                共 {recentMatches.length} 条
                            </span>
                        </div>

                        {/* THE SCROLLABLE TABLE CONTAINER */}
                        <div className="flex-1 overflow-auto min-h-0 relative">
                            {/* Add padding-bottom to ensure last item isn't cut off */}
                            <div className="absolute inset-0 pb-2">
                                <DataTable
                                    columns={columns}
                                    data={tableData}
                                    className="border-none shadow-none rounded-none w-full h-full"
                                    pagination={{
                                        currentPage: 1,
                                        totalPages: 1,
                                        onPageChange: () => { },
                                        totalItems: recentMatches.length
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />
        </div>
    );
}
