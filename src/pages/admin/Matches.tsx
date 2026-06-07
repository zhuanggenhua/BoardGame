import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import DataTable, { type Column } from './components/DataTable';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import { Filter, Calendar, Gamepad2, X, ScrollText } from 'lucide-react';
import { cn } from '../../lib/utils';
import Skeleton from '../../components/common/feedback/Skeleton';
import CustomSelect, { type Option } from './components/ui/CustomSelect';
import SearchInput from './components/ui/SearchInput';
import { getAllGames } from '../../config/games.config';

interface MatchPlayer {
    id: string;
    name: string;
    avatar?: string;
}

interface Match {
    id: string;
    matchID: string;
    gameName: string;
    players: MatchPlayer[];
    winnerID?: string;
    createdAt: string;
    endedAt: string;
    updatedAt: string;
}

/** ActionLog segment（与引擎 ActionLogSegment 对齐） */
interface ActionLogSegment {
    type: 'text' | 'i18n' | 'breakdown';
    text?: string;
    key?: string;
    ns?: string;
    params?: Record<string, unknown>;
    label?: string;
    value?: number;
    unit?: string;
}

interface ActionLogEntry {
    id: string;
    timestamp: number;
    actorId: string;
    kind: string;
    segments: ActionLogSegment[];
}

interface MatchDetail {
    matchID: string;
    gameName: string;
    players: Array<MatchPlayer & { result?: string; userId?: string | null }>;
    winnerID?: string;
    actionLog?: ActionLogEntry[];
    createdAt: string;
    endedAt: string;
    duration: number;
}

export default function MatchesPage() {
    const { t } = useTranslation('lobby');
    const { token, user } = useAuth();
    const { error: toastError, success } = useToast();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameFilter, setGameFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [detailMatch, setDetailMatch] = useState<MatchDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const isAdmin = user?.role === 'admin';

    const gameConfigs = useMemo(
        () => getAllGames().filter((game) => game.type === 'game' && !game.isUgc),
        []
    );

    const gameOptions = useMemo<Option[]>(
        () => gameConfigs.map((game) => ({
            label: t(game.titleKey, { defaultValue: game.id }),
            value: game.id,
            icon: <Gamepad2 size={14} />,
        })),
        [gameConfigs, t]
    );

    const gameNameLabelMap = useMemo(
        () => new Map(gameConfigs.map((game) => [game.id, t(game.titleKey, { defaultValue: game.id })])),
        [gameConfigs, t]
    );

    const resolveGameName = useCallback((gameId: string) => {
        return gameNameLabelMap.get(gameId) ?? gameId;
    }, [gameNameLabelMap]);

    const fetchMatchDetail = useCallback(async (matchID: string) => {
        setDetailLoading(true);
        try {
            const headers: Record<string, string> = {};
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            const res = await fetch(`${ADMIN_API_URL}/matches/${matchID}`, {
                headers,
            });
            if (!res.ok) throw new Error(t('admin.matchesPage.toast.detail_fetch_failed'));
            const data = await res.json();
            setDetailMatch(data);
        } catch (err) {
            console.error(err);
            toastError(t('admin.matchesPage.toast.detail_fetch_failed'));
        } finally {
            setDetailLoading(false);
        }
    }, [token, toastError]);

    const fetchMatches = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                gameName: gameFilter,
                search
            });
            const headers: Record<string, string> = {};
            if (token) {
                headers.Authorization = `Bearer ${token}`;
            }
            const res = await fetch(`${ADMIN_API_URL}/matches?${query}`, {
                headers,
            });
            if (!res.ok) throw new Error(t('admin.matchesPage.toast.fetch_failed'));
            const data = await res.json();
            const items = data.items.map((m: Match) => ({ ...m, id: m.matchID }));
            setMatches(items);
            setTotalPages(Math.ceil(data.total / data.limit));
            setTotalItems(data.total);
        } catch (err) {
            console.error(err);
            toastError(t('admin.matchesPage.toast.fetch_failed'));
        } finally {
            setLoading(false);
        }
    };

    const resolveResultLabel = (match: Match) => {
        if (!match.winnerID) return t('admin.matchesPage.results.draw');
        const winner = match.players.find((player) => player.id === match.winnerID);
        return t('admin.matchesPage.results.winner', {
            name: winner?.name || t('admin.matchesPage.player_fallback', { id: match.winnerID }),
        });
    };

    const formatDuration = (start: string, end: string) => {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) return t('admin.matchesPage.duration.unknown');
        const diffSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));
        const hours = Math.floor(diffSeconds / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;
        if (hours > 0) return t('admin.matchesPage.duration.hours_minutes', { hours, minutes });
        if (minutes > 0) return t('admin.matchesPage.duration.minutes_seconds', { minutes, seconds });
        return t('admin.matchesPage.duration.seconds', { seconds });
    };

    useEffect(() => {
        fetchMatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, token, gameFilter, search]);

    useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => matches.some((m) => m.matchID === id)));
    }, [matches]);

    const allSelected = matches.length > 0 && matches.every((m) => selectedIds.includes(m.matchID));

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : matches.map((m) => m.matchID));
    };

    const toggleSelectOne = (matchID: string) => {
        setSelectedIds((prev) => (
            prev.includes(matchID) ? prev.filter((id) => id !== matchID) : [...prev, matchID]
        ));
    };

    const handleDelete = async (matchID: string) => {
        if (!isAdmin) {
            toastError(t('admin.matchesPage.toast.admin_only'));
            return;
        }
        if (!confirm(t('admin.matchesPage.confirm.delete'))) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/matches/${matchID}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || t('admin.matchesPage.toast.delete_failed'));
            }
            success(t('admin.matchesPage.toast.delete_success'));
            fetchMatches();
        } catch (err) {
            console.error(err);
            toastError(err instanceof Error ? err.message : t('admin.matchesPage.toast.delete_failed'));
        }
    };

    const handleBulkDelete = async () => {
        if (!isAdmin) {
            toastError(t('admin.matchesPage.toast.admin_only'));
            return;
        }
        if (selectedIds.length === 0) return;
        if (!confirm(t('admin.matchesPage.confirm.bulk_delete', { count: selectedIds.length }))) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/matches/bulk-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ids: selectedIds })
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || t('admin.matchesPage.toast.bulk_delete_failed'));
            }
            success(t('admin.matchesPage.toast.bulk_delete_success', { count: selectedIds.length }));
            setSelectedIds([]);
            fetchMatches();
        } catch (err) {
            console.error(err);
            toastError(err instanceof Error ? err.message : t('admin.matchesPage.toast.bulk_delete_failed'));
        }
    };

    const selectionColumn: Column<Match> = {
            header: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t('admin.matchesPage.aria.select_all')}
                />
            ),
            width: '48px',
            align: 'center',
            cell: (m) => (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selectedIds.includes(m.matchID)}
                        onChange={() => toggleSelectOne(m.matchID)}
                        aria-label={t('admin.matchesPage.aria.select_match', { id: m.matchID })}
                    />
                </div>
            )
        };

    const columns: Column<Match>[] = [
        ...(isAdmin ? [selectionColumn] : []),
        {
            header: t('admin.matchesPage.columns.id'),
            accessorKey: 'matchID',
            cell: (m) => <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">{m.matchID.substring(0, 8)}</span>
        },
        {
            header: t('admin.matchesPage.columns.game'),
            accessorKey: 'gameName',
            cell: (m) => (
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "w-2 h-2 rounded-full",
                        m.gameName === 'dicethrone' ? "bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" :
                            m.gameName === 'smashup' ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" :
                                "bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                    )} />
                    <span className="font-medium text-zinc-700 capitalize">
                        {resolveGameName(m.gameName)}
                    </span>
                </div>
            )
        },
        {
            header: t('admin.matchesPage.columns.players'),
            cell: (m) => (
                <div className="flex items-center gap-3">
                    {/* Fixed: Removed hover:space-x-1 to prevent layout jitter */}
                    <div className="flex -space-x-3">
                        {m.players.map((p, i) => (
                            // Fixed: Removed hover:scale-110 and hover:z-10
                            <div key={i} className="w-8 h-8 rounded-full bg-zinc-200 border-2 border-white overflow-hidden shadow-sm relative z-0" title={p.name || p.id}>
                                {p.avatar ? (
                                    <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center bg-zinc-100 text-xs font-bold text-zinc-400">
                                        {(p.name || t('admin.matchesPage.player_unknown'))[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            header: t('admin.matchesPage.columns.result'),
            align: 'center',
            cell: (m) => (
                <div className="flex justify-center">
                    <span className={cn(
                        "px-2.5 py-1 text-xs rounded-full font-semibold border flex w-fit items-center gap-1.5",
                        m.winnerID ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500 border-zinc-200"
                    )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", m.winnerID ? "bg-emerald-400" : "bg-zinc-400")} />
                        {resolveResultLabel(m)}
                    </span>
                </div>
            )
        },
        {
            header: t('admin.matchesPage.columns.ended_at'),
            accessorKey: 'endedAt',
            align: 'right', // New alignment
            className: 'custom-date-col',
            cell: (m) => (
                <div className="flex flex-col gap-1 text-zinc-500 text-xs font-mono">
                    <div className="flex items-center justify-end gap-1.5">
                        <Calendar size={12} className="opacity-70" />
                        {new Date(m.endedAt).toLocaleString(undefined, {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit'
                        })}
                    </div>
                    <span className="text-[10px] text-zinc-400 font-sans">
                        {formatDuration(m.createdAt, m.endedAt)}
                    </span>
                </div>
            )
        },
        {
            header: t('admin.matchesPage.columns.actions'),
            align: 'right', // New alignment
            cell: (m) => (
                <div className="flex justify-end gap-3">
                    {isAdmin && (
                        <button
                            onClick={() => handleDelete(m.matchID)}
                            className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                        >
                            {t('admin.matchesPage.actions.delete')}
                        </button>
                    )}
                    <button
                        onClick={() => fetchMatchDetail(m.matchID)}
                        className="text-xs font-medium text-zinc-500 hover:text-indigo-600 transition-colors"
                    >
                        {t('admin.matchesPage.actions.detail')}
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="h-full flex flex-col p-8 w-full max-w-[1600px] mx-auto min-h-0 bg-zinc-50/50">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 flex-none mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">
                        {t('admin.matchesPage.title')}
                    </h1>
                    <p className="text-sm text-zinc-500 mt-1">{t('admin.matchesPage.description')}</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <SearchInput
                        placeholder={t('admin.matchesPage.search_placeholder')}
                        onSearch={(val) => { setSearch(val); setPage(1); }}
                        className="w-full sm:w-64"
                    />
                    <CustomSelect
                        value={gameFilter}
                        onChange={(val) => { setGameFilter(val); setPage(1); }}
                        options={gameOptions}
                        placeholder={t('admin.matchesPage.filters.all_games')}
                        allOptionLabel={t('admin.matchesPage.filters.all_games')}
                        prefixIcon={<Filter size={14} />}
                        className="w-full sm:w-48"
                    />
                    {isAdmin && (
                        <button
                            onClick={handleBulkDelete}
                            disabled={selectedIds.length === 0}
                            className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {t('admin.matchesPage.actions.bulk_delete')}
                            {selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden flex flex-col">
                <DataTable
                    className="h-full border-none"
                    columns={columns}
                    data={matches}
                    loading={loading}
                    pagination={{
                        currentPage: page,
                        totalPages,
                        onPageChange: setPage,
                        totalItems
                    }}
                />
            </div>

            {/* 对局详情弹窗 */}
            {detailMatch && (
                <MatchDetailModal
                    detail={detailMatch}
                    resolveGameName={resolveGameName}
                    loading={detailLoading}
                    onClose={() => setDetailMatch(null)}
                />
            )}
        </div>
    );
}


// ── 操作日志 segment 渲染 ──

function renderSegment(seg: ActionLogSegment, idx: number): React.ReactNode {
    switch (seg.type) {
        case 'text':
            return <span key={idx}>{seg.text}</span>;
        case 'i18n':
            // 后台不加载游戏 i18n namespace，直接显示 key + params
            return (
                <span key={idx} className="text-indigo-600" title={`${seg.ns}:${seg.key}`}>
                    {seg.key}{seg.params ? `(${JSON.stringify(seg.params)})` : ''}
                </span>
            );
        case 'breakdown':
            return (
                <span key={idx} className="font-semibold text-amber-700">
                    {seg.label}: {seg.value}{seg.unit ?? ''}
                </span>
            );
        default:
            return <span key={idx}>{JSON.stringify(seg)}</span>;
    }
}

function formatDurationText(
    seconds: number,
    t: (key: string, options?: Record<string, unknown>) => string
): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return t('admin.matchesPage.duration.hours_minutes', { hours: h, minutes: m });
    if (m > 0) return t('admin.matchesPage.duration.minutes_seconds', { minutes: m, seconds: s });
    return t('admin.matchesPage.duration.seconds_only', { seconds: s });
}

// ── 对局详情弹窗 ──

function MatchDetailModal({
    detail,
    resolveGameName,
    loading,
    onClose,
}: {
    detail: MatchDetail;
    resolveGameName: (gameId: string) => string;
    loading: boolean;
    onClose: () => void;
}) {
    const { t } = useTranslation('lobby');
    const resolveResult = (playerId: string) => {
        if (!detail.winnerID) return t('admin.matchesPage.results.draw');
        return playerId === detail.winnerID
            ? t('admin.matchesPage.results.win')
            : t('admin.matchesPage.results.loss');
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-zinc-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-900">{t('admin.matchesPage.detail.title')}</h3>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">{detail.matchID}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {loading ? (
                    <div className="flex-1 space-y-6 overflow-y-auto p-6">
                        <div className="grid grid-cols-3 gap-4">
                            {Array.from({ length: 3 }, (_, index) => (
                                <div key={`match-detail-meta-${index}`} className="space-y-2">
                                    <Skeleton className="h-3 w-14 rounded-lg" />
                                    <Skeleton className="h-5 w-full rounded-lg" />
                                </div>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-16 rounded-lg" />
                            <div className="grid grid-cols-2 gap-3">
                                {Array.from({ length: 2 }, (_, index) => (
                                    <div key={`match-detail-player-${index}`} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                                        <Skeleton className="h-4 w-24 rounded-lg" />
                                        <Skeleton className="h-3 w-20 rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Skeleton className="h-4 w-20 rounded-lg" />
                            <div className="space-y-2">
                                {Array.from({ length: 4 }, (_, index) => (
                                    <div key={`match-detail-log-${index}`} className="grid grid-cols-[88px_minmax(0,1fr)] gap-3">
                                        <Skeleton className="h-4 w-20 rounded-lg" />
                                        <Skeleton className="h-4 w-full rounded-lg" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {/* 基础信息 */}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <span className="text-zinc-400 text-xs">{t('admin.matchesPage.detail.game')}</span>
                                <p className="font-medium text-zinc-700 mt-0.5">{resolveGameName(detail.gameName)}</p>
                            </div>
                            <div>
                                <span className="text-zinc-400 text-xs">{t('admin.matchesPage.detail.duration')}</span>
                                <p className="font-medium text-zinc-700 mt-0.5">
                                    {formatDurationText(detail.duration, t)}
                                </p>
                            </div>
                            <div>
                                <span className="text-zinc-400 text-xs">{t('admin.matchesPage.detail.ended_at')}</span>
                                <p className="font-medium text-zinc-700 mt-0.5">
                                    {new Date(detail.endedAt).toLocaleString(undefined, {
                                        year: 'numeric', month: '2-digit', day: '2-digit',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* 玩家 */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                                {t('admin.matchesPage.detail.players')}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                {detail.players.map((p, i) => (
                                    <div key={i} className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border",
                                        p.id === detail.winnerID
                                            ? "bg-emerald-50 border-emerald-200"
                                            : "bg-zinc-50 border-zinc-200"
                                    )}>
                                        <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-bold text-zinc-500">
                                            {(p.name || t('admin.matchesPage.player_unknown'))[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-zinc-700 truncate">
                                                {p.name || t('admin.matchesPage.player_fallback', { id: p.id })}
                                            </p>
                                            <p className={cn(
                                                "text-xs font-semibold",
                                                p.id === detail.winnerID ? "text-emerald-600" : "text-zinc-400"
                                            )}>
                                                {resolveResult(p.id)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 操作日志 */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                                <ScrollText size={12} />
                                {t('admin.matchesPage.detail.action_log')}
                                {detail.actionLog && (
                                    <span className="text-zinc-300 font-normal">({detail.actionLog.length})</span>
                                )}
                            </h4>
                            {detail.actionLog && detail.actionLog.length > 0 ? (
                                <div className="bg-zinc-50 rounded-xl border border-zinc-200 divide-y divide-zinc-100 max-h-80 overflow-y-auto">
                                    {detail.actionLog.map((entry, i) => (
                                        <div key={entry.id || i} className="px-4 py-2.5 flex items-start gap-3 text-sm">
                                            <span className="text-[10px] text-zinc-300 font-mono shrink-0 mt-0.5 w-6 text-right">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {entry.segments.map((seg, si) => renderSegment(seg, si))}
                                                </div>
                                            </div>
                                            <span className="text-[10px] text-zinc-300 font-mono shrink-0 mt-0.5">
                                                P{entry.actorId}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-zinc-400 italic">{t('admin.matchesPage.detail.no_logs')}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
