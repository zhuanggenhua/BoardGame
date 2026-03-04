import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DataTable, { type Column } from './components/DataTable';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import { Filter, Calendar, Gamepad2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import CustomSelect, { type Option } from './components/ui/CustomSelect';
import SearchInput from './components/ui/SearchInput';

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

const GAME_OPTIONS: Option[] = [
    { label: 'Dice Throne', value: 'dicethrone', icon: <Gamepad2 size={14} /> },
    { label: 'Tic Tac Toe', value: 'tictactoe', icon: <Gamepad2 size={14} /> },
    { label: 'Smash Up', value: 'smashup', icon: <Gamepad2 size={14} /> },
    { label: 'Summoner Wars', value: 'summonerwars', icon: <Gamepad2 size={14} /> },
];

export default function MatchesPage() {
    const { token } = useAuth();
    const { error: toastError, success } = useToast();
    const [matches, setMatches] = useState<Match[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameFilter, setGameFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const fetchMatches = async () => {
        if (!token) {
            setMatches([]);
            setTotalPages(1);
            setTotalItems(0);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: '10',
                gameName: gameFilter,
                search
            });
            const res = await fetch(`${ADMIN_API_URL}/matches?${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch matches');
            const data = await res.json();
            const items = data.items.map((m: Match) => ({ ...m, id: m.matchID }));
            setMatches(items);
            setTotalPages(Math.ceil(data.total / data.limit));
            setTotalItems(data.total);
        } catch (err) {
            console.error(err);
            toastError('获取对局列表失败');
        } finally {
            setLoading(false);
        }
    };

    const resolveResultLabel = (match: Match) => {
        if (!match.winnerID) return '平局';
        const winner = match.players.find((player) => player.id === match.winnerID);
        return `${winner?.name || `玩家${match.winnerID}`} 胜`;
    };

    const formatDuration = (start: string, end: string) => {
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        if (Number.isNaN(startTime) || Number.isNaN(endTime)) return '耗时未知';
        const diffSeconds = Math.max(0, Math.round((endTime - startTime) / 1000));
        const hours = Math.floor(diffSeconds / 3600);
        const minutes = Math.floor((diffSeconds % 3600) / 60);
        const seconds = diffSeconds % 60;
        if (hours > 0) return `耗时 ${hours}小时${minutes}分`;
        if (minutes > 0) return `耗时 ${minutes}分${seconds}秒`;
        return `耗时 ${seconds}秒`;
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
        if (!confirm('确定要删除该对局记录吗？')) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/matches/${matchID}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '删除失败');
            }
            success('对局记录已删除');
            fetchMatches();
        } catch (err) {
            console.error(err);
            toastError(err instanceof Error ? err.message : '删除失败');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 条对局记录吗？`)) return;
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
                throw new Error(payload?.error || '批量删除失败');
            }
            success(`已删除 ${selectedIds.length} 条对局记录`);
            setSelectedIds([]);
            fetchMatches();
        } catch (err) {
            console.error(err);
            toastError(err instanceof Error ? err.message : '批量删除失败');
        }
    };

    const columns: Column<Match>[] = [
        {
            header: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="选择全部对局"
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
                        aria-label={`选择对局 ${m.matchID}`}
                    />
                </div>
            )
        },
        {
            header: 'ID',
            accessorKey: 'matchID',
            cell: (m) => <span className="font-mono text-xs text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200">{m.matchID.substring(0, 8)}</span>
        },
        {
            header: '游戏',
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
                        {m.gameName}
                    </span>
                </div>
            )
        },
        {
            header: '玩家',
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
                                        {(p.name || '?')[0]?.toUpperCase()}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )
        },
        {
            header: '结果',
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
            header: '结束时间',
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
            header: '操作',
            align: 'right', // New alignment
            cell: (m) => (
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => handleDelete(m.matchID)}
                        className="text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
                    >
                        删除
                    </button>
                    <button disabled className="text-xs font-medium text-zinc-400 hover:text-indigo-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        详情
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="h-full flex flex-col p-8 w-full max-w-[1600px] mx-auto min-h-0 bg-zinc-50/50">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 flex-none mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">对局记录</h1>
                    <p className="text-sm text-zinc-500 mt-1">查看平台所有对局历史与状态</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <SearchInput
                        placeholder="搜索对局ID或玩家..."
                        onSearch={(val) => { setSearch(val); setPage(1); }}
                        className="w-full sm:w-64"
                    />
                    <CustomSelect
                        value={gameFilter}
                        onChange={(val) => { setGameFilter(val); setPage(1); }}
                        options={GAME_OPTIONS}
                        placeholder="所有游戏"
                        allOptionLabel="所有游戏"
                        prefixIcon={<Filter size={14} />}
                        className="w-full sm:w-48"
                    />
                    <button
                        onClick={handleBulkDelete}
                        disabled={selectedIds.length === 0}
                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        删除选中 {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                    </button>
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
        </div>
    );
}
