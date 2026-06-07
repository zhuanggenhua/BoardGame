import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, type UserRole } from '../../contexts/AuthContext';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import {
    Activity,
    ArrowLeft,
    Ban,
    Calendar,
    CheckCircle,
    Clock,
    Gamepad2,
    MessageSquare,
    ScrollText,
    Shield,
    ShieldAlert,
    Swords,
    Trash2,
    Trophy,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { logger } from '../../lib/logger';
import ImageLightbox from '../../components/common/ImageLightbox';
import DataTable, { type Column } from './components/DataTable';
import { getAllGames } from '../../config/games.config';
import { getDeveloperGameScopeLabel, normalizeDeveloperGameIds } from '../../lib/developerGameAccess';
import { AdminDetailPageSkeleton } from './components/AdminSkeletons';

interface UserDetail {
    id: string;
    username: string;
    email?: string;
    role: UserRole;
    developerGameIds?: string[];
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

interface RecentMatchItem {
    matchID: string;
    gameName: string;
    result: string;
    opponent: string;
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

export default function UserDetailPage() {
    const { t } = useTranslation('lobby');
    const adminT = (key: string, options?: Record<string, unknown>) => t(`admin.userDetail.${key}`, options);
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const { error: toastError, success } = useToast();
    const [user, setUser] = useState<UserDetail | null>(null);
    const [stats, setStats] = useState<UserStats | null>(null);
    const [recentMatches, setRecentMatches] = useState<RecentMatchItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const gameLabelById = useMemo(
        () => new Map(
            getAllGames()
                .filter((game) => game.type === 'game' && !game.isUgc)
                .map((game) => [game.id, t(game.titleKey, { defaultValue: game.id })] as const)
        ),
        [t]
    );

    const fetchUser = async () => {
        if (!id || !token) return;
        setLoading(true);
        try {
            const res = await fetch(`${ADMIN_API_URL}/users/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch user');
            const data = await res.json();
            setUser(data.user);
            if (data.stats) setStats(data.stats);
            setRecentMatches(Array.isArray(data.recentMatches) ? data.recentMatches : []);
        } catch (err) {
            logger.error('[AdminUserDetail] 获取用户详情失败', {
                userId: id,
                error: err,
            });
            toastError(adminT('toast.fetch_failed'));
            navigate('/admin/users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, token]);

    const handleBanToggle = async () => {
        if (!user) return;
        if (user.role === 'admin') {
            toastError(adminT('toast.cannot_ban_admin'));
            return;
        }
        if (!confirm(adminT(user.banned ? 'confirm.unban' : 'confirm.ban'))) return;

        try {
            const isBanning = !user.banned;
            const action = isBanning ? 'ban' : 'unban';
            const reason = isBanning ? (prompt(adminT('prompt.ban_reason')) ?? '').trim() : '';
            if (isBanning && !reason) {
                toastError(adminT('toast.ban_reason_required'));
                return;
            }
            const res = await fetch(`${ADMIN_API_URL}/users/${user.id}/${action}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(isBanning ? { 'Content-Type': 'application/json' } : {}),
                },
                body: isBanning ? JSON.stringify({ reason }) : undefined,
            });

            if (!res.ok) throw new Error('Action failed');
            success(adminT('toast.action_success'));
            await fetchUser();
        } catch (err) {
            logger.error('[AdminUserDetail] 更新封禁状态失败', {
                userId: user.id,
                action: user.banned ? 'unban' : 'ban',
                error: err,
            });
            toastError(adminT('toast.action_failed'));
        }
    };

    const handleDelete = async () => {
        if (!user) return;
        if (user.role === 'admin') {
            toastError(adminT('toast.cannot_delete_admin'));
            return;
        }
        if (!confirm(adminT('confirm.delete'))) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/users/${user.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Delete failed');
            success(adminT('toast.delete_success'));
            navigate('/admin/users');
        } catch (err) {
            logger.error('[AdminUserDetail] 删除用户失败', {
                userId: user.id,
                error: err,
            });
            toastError(adminT('toast.delete_failed'));
        }
    };

    const handleSendMessage = () => toastError(adminT('toast.message_demo'));

    const tableData: MatchTableItem[] = recentMatches.map((m) => ({
        id: m.matchID,
        matchID: m.matchID,
        gameName: m.gameName,
        result: m.result || 'draw',
        opponent: m.opponent || adminT('table.unknown_opponent'),
        endedAt: m.endedAt,
    }));

    const columns: Column<MatchTableItem>[] = [
        {
            header: adminT('table.result'),
            accessorKey: 'result',
            width: '80px',
            align: 'center',
            cell: (m) => {
                const resStr = String(m.result || '').toUpperCase();
                const isWin = resStr.includes('WIN') || resStr.includes('VICTORY');
                const isLoss = resStr.includes('LOSS') || resStr.includes('DEFEAT');
                const isDraw = !isWin && !isLoss;
                return (
                    <div className="flex justify-center">
                        <span className={cn(
                            'min-w-[48px] rounded-md border px-2 py-0.5 text-center text-[10px] font-bold',
                            isWin ? 'border-emerald-100 bg-emerald-50 text-emerald-600' :
                                isDraw ? 'border-zinc-200 bg-zinc-100 text-zinc-600' :
                                    'border-red-100 bg-red-50 text-red-600'
                        )}>
                            {isWin ? adminT('table.result_win') : isDraw ? adminT('table.result_draw') : adminT('table.result_loss')}
                        </span>
                    </div>
                );
            },
        },
        {
            header: adminT('table.game'),
            accessorKey: 'gameName',
            className: 'pl-4',
            cell: (m) => (
                <div className="flex items-center gap-2 pl-4">
                    <span className={cn(
                        'h-1.5 w-1.5 shrink-0 rounded-full',
                        m.gameName === 'dicethrone' ? 'bg-orange-500' :
                            m.gameName === 'smashup' ? 'bg-purple-500' :
                                'bg-blue-500'
                    )} />
                    <span className="max-w-[100px] truncate text-xs font-medium capitalize text-zinc-700">{m.gameName}</span>
                </div>
            ),
        },
        {
            header: adminT('table.opponent'),
            accessorKey: 'opponent',
            cell: (m) => (
                <div className="flex items-center gap-2">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 text-[9px] font-bold text-zinc-500">
                        {m.opponent[0]?.toUpperCase()}
                    </div>
                    <span className="max-w-[80px] truncate text-xs font-medium text-zinc-600" title={m.opponent}>
                        {m.opponent}
                    </span>
                </div>
            ),
        },
        {
            header: adminT('table.time'),
            accessorKey: 'endedAt',
            align: 'right',
            className: 'custom-date-col',
            cell: (m) => <span className="whitespace-nowrap font-mono text-[10px] text-zinc-400">{new Date(m.endedAt).toLocaleDateString()}</span>,
        },
    ];

    if (loading) {
        return <AdminDetailPageSkeleton />;
    }
    if (!user) return null;

    const developerGameIds = normalizeDeveloperGameIds(user.developerGameIds);
    const developerScopeLabel = getDeveloperGameScopeLabel(user.developerGameIds);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-zinc-50/30">
            <div className="z-10 flex-none border-b border-zinc-200 bg-white px-6 py-4 shadow-sm">
                <div className="mx-auto flex max-w-[1400px] items-center gap-4">
                    <button
                        onClick={() => navigate('/admin/users')}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
                        title={adminT('title.back_to_users')}
                    >
                        <ArrowLeft size={18} />
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-4">
                        <div
                            className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 p-0.5"
                            onClick={() => user.avatar && setPreviewImage(user.avatar)}
                        >
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.username} className="h-full w-full rounded-full object-cover" />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center bg-zinc-50 text-xs font-bold text-zinc-300">
                                    {user.username[0]?.toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h1 className="truncate text-lg font-bold text-zinc-900">{user.username}</h1>
                                {user.role === 'admin' && (
                                    <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                        {adminT('badge.admin')}
                                    </span>
                                )}
                                {user.role === 'developer' && (
                                    <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                                        {adminT('badge.developer')}
                                    </span>
                                )}
                                {user.banned && (
                                    <span className="rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                                        {adminT('badge.banned')}
                                    </span>
                                )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-3 font-mono text-xs text-zinc-500">
                                <span>ID: {user.id}</span>
                                <span className="hidden sm:inline">|</span>
                                <span className="hidden max-w-[200px] truncate sm:inline">{user.email || adminT('field.email_unbound')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                        <button
                            onClick={handleSendMessage}
                            className="flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-600 shadow-sm transition-colors hover:bg-zinc-50 hover:text-zinc-900"
                        >
                            <MessageSquare size={14} /> <span className="hidden sm:inline">{adminT('action.send_message')}</span>
                        </button>
                        <button
                            onClick={handleBanToggle}
                            disabled={user.role === 'admin'}
                            className={cn(
                                'flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold shadow-sm transition-colors',
                                user.role === 'admin'
                                    ? 'cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400'
                                    : user.banned
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                            )}
                            title={user.role === 'admin' ? adminT('tooltip.cannot_ban_admin') : user.banned ? adminT('action.unban') : adminT('action.ban')}
                        >
                            {user.banned ? <CheckCircle size={14} /> : <Ban size={14} />}
                            <span className="hidden sm:inline">{user.banned ? adminT('action.unban') : adminT('action.ban')}</span>
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={user.role === 'admin'}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-zinc-400 transition-all hover:border-red-100 hover:bg-red-50 hover:text-red-500"
                            title={adminT('action.delete')}
                        >
                            <Trash2 size={15} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 min-h-0 flex-col bg-zinc-50/50 p-6">
                <div className="mx-auto grid h-full w-full max-w-[1400px] grid-cols-1 gap-6 lg:grid-cols-12">
                    <div className="flex flex-col gap-6 lg:col-span-4">
                        <div className="shrink-0 rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                                <Activity size={14} /> {adminT('stats.section_title')}
                            </h3>
                            {stats ? (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-3">
                                        <div className="flex items-center gap-2 text-zinc-600">
                                            <Gamepad2 size={16} />
                                            <span className="text-sm font-medium">{adminT('stats.total_matches')}</span>
                                        </div>
                                        <span className="tabular-nums text-xl font-bold text-zinc-900">{stats.totalMatches}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-lg border border-emerald-100/50 bg-emerald-50/50 p-3">
                                            <div className="mb-1 flex items-center gap-1.5 text-emerald-600">
                                                <Trophy size={14} />
                                                <span className="text-xs font-bold">{adminT('stats.wins')}</span>
                                            </div>
                                            <span className="tabular-nums text-2xl font-bold text-emerald-700">{stats.wins}</span>
                                        </div>
                                        <div className="rounded-lg border border-indigo-100/50 bg-indigo-50/50 p-3">
                                            <div className="mb-1 flex items-center gap-1.5 text-indigo-600">
                                                <Swords size={14} />
                                                <span className="text-xs font-bold">{adminT('stats.win_rate')}</span>
                                            </div>
                                            <span className="tabular-nums text-2xl font-bold text-indigo-700">{Math.round(stats.winRate)}%</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm text-zinc-400">{adminT('stats.empty')}</div>
                            )}
                        </div>

                        <div className="shrink-0 rounded-xl border border-zinc-200/60 bg-white p-5 shadow-sm">
                            <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                                <ShieldAlert size={14} /> {adminT('account.section_title')}
                            </h3>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between border-b border-dashed border-zinc-100 py-1 text-sm">
                                    <span className="flex items-center gap-2 text-zinc-500">
                                        <Shield size={14} /> {adminT('account.role')}
                                    </span>
                                    <span className={cn(
                                        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold',
                                        user.role === 'admin'
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                                            : user.role === 'developer'
                                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                                : 'border-zinc-200 bg-zinc-100 text-zinc-600'
                                    )}>
                                        {user.role === 'admin'
                                            ? adminT('role.admin')
                                            : user.role === 'developer'
                                                ? developerScopeLabel
                                                    ? adminT('role.developer_scoped', { scope: developerScopeLabel })
                                                    : adminT('role.developer')
                                                : adminT('role.user')}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-b border-dashed border-zinc-100 py-1 text-sm">
                                    <span className="flex items-center gap-2 text-zinc-500">
                                        <Calendar size={14} /> {adminT('account.created_at')}
                                    </span>
                                    <span className="font-mono text-zinc-700">{new Date(user.createdAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between border-b border-dashed border-zinc-100 py-1 text-sm">
                                    <span className="flex items-center gap-2 text-zinc-500">
                                        <Clock size={14} /> {adminT('account.last_online')}
                                    </span>
                                    <span className="font-mono text-zinc-700">{user.lastOnline ? new Date(user.lastOnline).toLocaleDateString() : adminT('account.never_online')}</span>
                                </div>
                                {user.banned && (
                                    <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs">
                                        <p className="mb-1 font-bold text-red-800">{adminT('ban.section_title')}</p>
                                        <p className="mb-1 text-red-600">{adminT('ban.reason', { reason: user.bannedReason || adminT('ban.unspecified') })}</p>
                                        <p className="font-mono text-[10px] text-red-500/80">{user.bannedAt && new Date(user.bannedAt).toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {user.role === 'developer' && (
                            <div className="shrink-0 rounded-xl border border-amber-100 bg-white p-5 shadow-sm">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                        <ScrollText size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600">
                                            {adminT('developer.section_title')}
                                        </h3>
                                        <p className="mt-2 text-xs leading-5 text-zinc-500">
                                            {adminT('developer.description')}
                                        </p>
                                        <div className="mt-3">
                                            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                                {adminT('developer.scope', { scope: developerScopeLabel ?? adminT('developer.unassigned') })}
                                            </span>
                                        </div>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {developerGameIds.length > 0 ? (
                                                developerGameIds.map((gameId) => (
                                                    <span
                                                        key={gameId}
                                                        className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                                                    >
                                                        {gameLabelById.get(gameId) ?? gameId}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-zinc-400">{adminT('developer.empty_games')}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-zinc-200/60 bg-white shadow-sm lg:col-span-8">
                        <div className="flex shrink-0 items-center justify-between border-b border-zinc-100 bg-zinc-50/30 p-4">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                                <Gamepad2 size={16} className="text-indigo-500" />
                                {adminT('matches.section_title')}
                            </h3>
                            <span className="rounded border border-zinc-100 bg-white px-2 py-1 text-[10px] font-medium text-zinc-400">
                                {adminT('matches.count', { count: recentMatches.length })}
                            </span>
                        </div>

                        <div className="relative min-h-0 flex-1 overflow-auto">
                            <div className="absolute inset-0 pb-2">
                                <DataTable
                                    columns={columns}
                                    data={tableData}
                                    className="h-full w-full rounded-none border-none shadow-none"
                                    pagination={{
                                        currentPage: 1,
                                        totalPages: 1,
                                        onPageChange: () => {},
                                        totalItems: recentMatches.length,
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
