import { useEffect, useState } from 'react';
import { Calendar, DoorOpen, Filter, Lock, Timer, Unlock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ADMIN_API_URL } from '../../config/server';
import { cn } from '../../lib/utils';
import DataTable, { type Column } from './components/DataTable';
import RoomPlayerStatusList from './components/RoomPlayerStatusList';
import CustomSelect, { type Option } from './components/ui/CustomSelect';
import SearchInput from './components/ui/SearchInput';
import { summarizeRoomPlayers } from './utils/roomPresence';
import { formatDateTime, formatDurationMs, getElapsedDurationMs } from './utils/roomTime';

interface RoomPlayer {
    id: number;
    name?: string;
    isConnected?: boolean;
}

interface RoomItem {
    id: string;
    matchID: string;
    gameName: string;
    roomName?: string;
    ownerKey?: string;
    ownerType?: 'user' | 'guest';
    ownerName?: string;
    isLocked: boolean;
    players: RoomPlayer[];
    createdAt: string;
    updatedAt: string;
}

const PAGE_LIMIT = 10;

const GAME_OPTIONS: Option[] = [
    { label: 'Dice Throne', value: 'dicethrone', icon: <DoorOpen size={14} /> },
    { label: 'Tic Tac Toe', value: 'tictactoe', icon: <DoorOpen size={14} /> },
    { label: 'Smash Up', value: 'smashup', icon: <DoorOpen size={14} /> },
    { label: 'Summoner Wars', value: 'summonerwars', icon: <DoorOpen size={14} /> },
];

const resolveOwnerLabel = (room: RoomItem) => {
    if (room.ownerName) return room.ownerName;
    if (room.ownerType === 'guest' && room.ownerKey) {
        return room.ownerKey.replace('guest:', '游客#');
    }
    return room.ownerKey || '未知';
};

const resolveRoomTitle = (room: RoomItem) => room.roomName?.trim() || '未命名房间';

export default function RoomsPage() {
    const { token } = useAuth();
    const { error: toastError, success } = useToast();
    const [rooms, setRooms] = useState<RoomItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [gameFilter, setGameFilter] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectAllFiltered, setSelectAllFiltered] = useState(false);

    const fetchRooms = async () => {
        if (!token) {
            setRooms([]);
            setTotalPages(1);
            setTotalItems(0);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: String(PAGE_LIMIT),
                gameName: gameFilter,
                search,
            });
            const res = await fetch(`${ADMIN_API_URL}/rooms?${query.toString()}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '获取房间列表失败');
            }

            const data = await res.json();
            const items = Array.isArray(data.items)
                ? data.items.map((room: RoomItem) => ({ ...room, id: room.matchID }))
                : [];
            setRooms(items);
            const nextTotal = Number(data.total ?? 0);
            const nextLimit = Math.max(1, Number(data.limit ?? PAGE_LIMIT));
            setTotalPages(Math.max(1, Math.ceil(nextTotal / nextLimit)));
            setTotalItems(nextTotal);
        } catch (err) {
            toastError(err instanceof Error ? err.message : '获取房间列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, token, gameFilter, search]);

    useEffect(() => {
        if (selectAllFiltered) return;
        setSelectedIds((prev) => prev.filter((id) => rooms.some((room) => room.matchID === id)));
    }, [rooms, selectAllFiltered]);

    const allSelected = selectAllFiltered || (rooms.length > 0 && rooms.every((room) => selectedIds.includes(room.matchID)));

    const toggleSelectAll = () => {
        if (selectAllFiltered) {
            setSelectAllFiltered(false);
            setSelectedIds([]);
            return;
        }
        if (totalItems > rooms.length) {
            setSelectAllFiltered(true);
            setSelectedIds([]);
            return;
        }
        setSelectedIds(rooms.map((room) => room.matchID));
    };

    const toggleSelectOne = (matchID: string) => {
        if (selectAllFiltered) {
            setSelectAllFiltered(false);
            setSelectedIds([matchID]);
            return;
        }
        setSelectedIds((prev) => (
            prev.includes(matchID) ? prev.filter((id) => id !== matchID) : [...prev, matchID]
        ));
    };

    const handleDelete = async (matchID: string) => {
        if (!confirm('确定要删除该房间吗？')) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/rooms/${matchID}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '删除失败');
            }
            success('房间已删除');
            fetchRooms();
        } catch (err) {
            toastError(err instanceof Error ? err.message : '删除失败');
        }
    };

    const handleBulkDelete = async () => {
        if (!selectAllFiltered && selectedIds.length === 0) return;
        const label = selectAllFiltered ? `当前筛选的 ${totalItems} 个房间` : `选中的 ${selectedIds.length} 个房间`;
        if (!confirm(`确定要删除${label}吗？`)) return;

        try {
            const url = selectAllFiltered
                ? `${ADMIN_API_URL}/rooms/bulk-delete-by-filter`
                : `${ADMIN_API_URL}/rooms/bulk-delete`;
            const payload = selectAllFiltered
                ? { gameName: gameFilter, search }
                : { ids: selectedIds };
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                throw new Error(data?.error || '批量删除失败');
            }
            success(`已删除${label}`);
            setSelectedIds([]);
            setSelectAllFiltered(false);
            fetchRooms();
        } catch (err) {
            toastError(err instanceof Error ? err.message : '批量删除失败');
        }
    };

    const columns: Column<RoomItem>[] = [
        {
            header: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="选择全部房间"
                />
            ),
            width: '48px',
            className: 'text-center',
            cell: (room) => (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selectAllFiltered || selectedIds.includes(room.matchID)}
                        onChange={() => toggleSelectOne(room.matchID)}
                        aria-label={`选择房间 ${room.matchID}`}
                    />
                </div>
            ),
        },
        {
            header: '房间',
            cell: (room) => (
                <div className="space-y-1">
                    <div className="font-semibold text-zinc-900">{resolveRoomTitle(room)}</div>
                    <div className="font-mono text-xs text-zinc-400">{room.matchID}</div>
                </div>
            ),
        },
        {
            header: '游戏',
            accessorKey: 'gameName',
            cell: (room) => (
                <span className="font-medium capitalize text-zinc-700">{room.gameName}</span>
            ),
        },
        {
            header: '房主',
            cell: (room) => (
                <div className="space-y-1 text-xs">
                    <div className="font-medium text-zinc-700">{resolveOwnerLabel(room)}</div>
                    <div className="uppercase tracking-[0.08em] text-zinc-400">{room.ownerType || 'guest'}</div>
                </div>
            ),
        },
        {
            header: '状态',
            cell: (room) => (
                <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    room.isLocked
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                )}>
                    {room.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    {room.isLocked ? '有密码' : '公开'}
                </span>
            ),
        },
        {
            header: '玩家在线状态',
            width: '320px',
            cell: (room) => {
                const summary = summarizeRoomPlayers(room.players);
                return (
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-700">
                            {summary.connected}/{summary.total} 在线
                        </div>
                        <RoomPlayerStatusList players={room.players} emptyLabel="暂无玩家入座" />
                    </div>
                );
            },
        },
        {
            header: '持续时间',
            cell: (room) => (
                <div className="space-y-1 text-xs text-zinc-500">
                    <div className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
                        <Timer size={12} className="opacity-70" />
                        {formatDurationMs(getElapsedDurationMs(room.createdAt))}
                    </div>
                    <div>开始于 {formatDateTime(room.createdAt)}</div>
                </div>
            ),
        },
        {
            header: '最近更新',
            accessorKey: 'updatedAt',
            cell: (room) => (
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                    <Calendar size={12} className="opacity-70" />
                    {formatDateTime(room.updatedAt)}
                </div>
            ),
        },
        {
            header: '操作',
            className: 'text-right',
            cell: (room) => (
                <div className="flex justify-end">
                    <button
                        onClick={() => handleDelete(room.matchID)}
                        className="text-xs font-medium text-red-500 transition-colors hover:text-red-600"
                    >
                        删除
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col bg-zinc-50/50 p-8">
            <div className="mb-8 flex flex-none flex-col justify-between gap-6 xl:flex-row xl:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">房间管理</h1>
                    <p className="mt-1 text-sm text-zinc-500">查看房间在线状态、持续时间，并支持按条件清理</p>
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                    <SearchInput
                        placeholder="搜索房间 ID 或房间名..."
                        onSearch={(value) => {
                            setSearch(value);
                            setPage(1);
                            setSelectedIds([]);
                            setSelectAllFiltered(false);
                        }}
                        className="w-full sm:w-64"
                    />
                    <CustomSelect
                        value={gameFilter}
                        onChange={(value) => {
                            setGameFilter(value);
                            setPage(1);
                            setSelectedIds([]);
                            setSelectAllFiltered(false);
                        }}
                        options={GAME_OPTIONS}
                        placeholder="所有游戏"
                        allOptionLabel="所有游戏"
                        prefixIcon={<Filter size={14} />}
                        className="w-full sm:w-48"
                    />
                    <button
                        onClick={handleBulkDelete}
                        disabled={!selectAllFiltered && selectedIds.length === 0}
                        className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        删除选中 {selectAllFiltered ? `(共 ${totalItems})` : selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                    </button>
                </div>
            </div>

            {selectAllFiltered && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                    已全选当前筛选结果（{totalItems} 条）。如需取消，请点击表头的全选框。
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-hidden rounded-2xl border border-zinc-200/60 bg-white shadow-sm">
                <DataTable
                    className="h-full border-none"
                    columns={columns}
                    data={rooms}
                    loading={loading}
                    pagination={{
                        currentPage: page,
                        totalPages,
                        onPageChange: setPage,
                        totalItems,
                    }}
                />
            </div>
        </div>
    );
}
