import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { getAllGames } from '../../config/games.config';

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

export default function RoomsPage() {
    const { t } = useTranslation('lobby');
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

    const gameConfigs = useMemo(
        () => getAllGames().filter((game) => game.type === 'game' && !game.isUgc),
        []
    );
    const gameOptions = useMemo<Option[]>(
        () => gameConfigs.map((game) => ({
            label: t(game.titleKey, { defaultValue: game.id }),
            value: game.id,
            icon: <DoorOpen size={14} />,
        })),
        [gameConfigs, t]
    );
    const gameNameLabelMap = useMemo(
        () => new Map(gameConfigs.map((game) => [game.id, t(game.titleKey, { defaultValue: game.id })])),
        [gameConfigs, t]
    );
    const resolveGameName = (gameId: string) => gameNameLabelMap.get(gameId) ?? gameId;
    const resolveOwnerTypeLabel = (ownerType?: 'user' | 'guest') =>
        ownerType === 'user'
            ? t('admin.roomsPage.owner_type.user')
            : t('admin.roomsPage.owner_type.guest');
    const resolveOwnerLabel = (room: RoomItem) => {
        if (room.ownerName) return room.ownerName;
        if (room.ownerType === 'guest' && room.ownerKey) {
            return room.ownerKey.replace('guest:', t('admin.roomsPage.guest_prefix'));
        }
        return room.ownerKey || t('admin.roomsPage.unknown');
    };
    const resolveRoomTitle = (room: RoomItem) => room.roomName?.trim() || t('admin.roomsPage.unnamed_room');

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
                throw new Error(payload?.error || t('admin.roomsPage.toast.fetch_failed'));
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
            toastError(err instanceof Error ? err.message : t('admin.roomsPage.toast.fetch_failed'));
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
        if (!confirm(t('admin.roomsPage.confirm.delete'))) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/rooms/${matchID}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || t('admin.roomsPage.toast.delete_failed'));
            }
            success(t('admin.roomsPage.toast.delete_success'));
            fetchRooms();
        } catch (err) {
            toastError(err instanceof Error ? err.message : t('admin.roomsPage.toast.delete_failed'));
        }
    };

    const handleBulkDelete = async () => {
        if (!selectAllFiltered && selectedIds.length === 0) return;
        const label = selectAllFiltered
            ? t('admin.roomsPage.bulk.filtered_count', { count: totalItems })
            : t('admin.roomsPage.bulk.selected_count', { count: selectedIds.length });
        if (!confirm(t('admin.roomsPage.confirm.bulk_delete', { label }))) return;

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
                throw new Error(data?.error || t('admin.roomsPage.toast.bulk_delete_failed'));
            }
            success(t('admin.roomsPage.toast.bulk_delete_success', { label }));
            setSelectedIds([]);
            setSelectAllFiltered(false);
            fetchRooms();
        } catch (err) {
            toastError(err instanceof Error ? err.message : t('admin.roomsPage.toast.bulk_delete_failed'));
        }
    };

    const columns: Column<RoomItem>[] = [
        {
            header: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t('admin.roomsPage.aria.select_all')}
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
                        aria-label={t('admin.roomsPage.aria.select_room', { id: room.matchID })}
                    />
                </div>
            ),
        },
        {
            header: t('admin.roomsPage.columns.room'),
            cell: (room) => (
                <div className="space-y-1">
                    <div className="font-semibold text-zinc-900">{resolveRoomTitle(room)}</div>
                    <div className="font-mono text-xs text-zinc-400">{room.matchID}</div>
                </div>
            ),
        },
        {
            header: t('admin.roomsPage.columns.game'),
            accessorKey: 'gameName',
            cell: (room) => (
                <span className="font-medium text-zinc-700">{resolveGameName(room.gameName)}</span>
            ),
        },
        {
            header: t('admin.roomsPage.columns.owner'),
            cell: (room) => (
                <div className="space-y-1 text-xs">
                    <div className="font-medium text-zinc-700">{resolveOwnerLabel(room)}</div>
                    <div className="uppercase tracking-[0.08em] text-zinc-400">
                        {resolveOwnerTypeLabel(room.ownerType)}
                    </div>
                </div>
            ),
        },
        {
            header: t('admin.roomsPage.columns.status'),
            cell: (room) => (
                <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                    room.isLocked
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                )}>
                    {room.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    {room.isLocked ? t('admin.roomsPage.status.locked') : t('admin.roomsPage.status.public')}
                </span>
            ),
        },
        {
            header: t('admin.roomsPage.columns.players'),
            width: '320px',
            cell: (room) => {
                const summary = summarizeRoomPlayers(room.players);
                return (
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-zinc-700">
                            {t('admin.roomsPage.players.online_count', {
                                connected: summary.connected,
                                total: summary.total,
                            })}
                        </div>
                        <RoomPlayerStatusList
                            players={room.players}
                            emptyLabel={t('admin.roomsPage.players.empty')}
                        />
                    </div>
                );
            },
        },
        {
            header: t('admin.roomsPage.columns.duration'),
            cell: (room) => (
                <div className="space-y-1 text-xs text-zinc-500">
                    <div className="inline-flex items-center gap-1.5 font-medium text-zinc-700">
                        <Timer size={12} className="opacity-70" />
                        {formatDurationMs(getElapsedDurationMs(room.createdAt))}
                    </div>
                    <div>{t('admin.roomsPage.duration.started_at', { time: formatDateTime(room.createdAt) })}</div>
                </div>
            ),
        },
        {
            header: t('admin.roomsPage.columns.updated_at'),
            accessorKey: 'updatedAt',
            cell: (room) => (
                <div className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500">
                    <Calendar size={12} className="opacity-70" />
                    {formatDateTime(room.updatedAt)}
                </div>
            ),
        },
        {
            header: t('admin.roomsPage.columns.actions'),
            className: 'text-right',
            cell: (room) => (
                <div className="flex justify-end">
                    <button
                        onClick={() => handleDelete(room.matchID)}
                        className="text-xs font-medium text-red-500 transition-colors hover:text-red-600"
                    >
                        {t('admin.roomsPage.actions.delete')}
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1800px] flex-col bg-zinc-50/50 p-8">
            <div className="mb-8 flex flex-none flex-col justify-between gap-6 xl:flex-row xl:items-center">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
                        {t('admin.roomsPage.title')}
                    </h1>
                    <p className="mt-1 text-sm text-zinc-500">{t('admin.roomsPage.description')}</p>
                </div>

                <div className="flex flex-col items-center gap-3 sm:flex-row">
                    <SearchInput
                        placeholder={t('admin.roomsPage.search_placeholder')}
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
                        options={gameOptions}
                        placeholder={t('admin.roomsPage.filters.all_games')}
                        allOptionLabel={t('admin.roomsPage.filters.all_games')}
                        prefixIcon={<Filter size={14} />}
                        className="w-full sm:w-48"
                    />
                    <button
                        onClick={handleBulkDelete}
                        disabled={!selectAllFiltered && selectedIds.length === 0}
                        className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t('admin.roomsPage.actions.bulk_delete')}
                        {' '}
                        {selectAllFiltered
                            ? `(${t('admin.roomsPage.bulk.total_count', { count: totalItems })})`
                            : selectedIds.length > 0
                                ? `(${selectedIds.length})`
                                : ''}
                    </button>
                </div>
            </div>

            {selectAllFiltered && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                    {t('admin.roomsPage.bulk.all_filtered_selected', { count: totalItems })}
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
