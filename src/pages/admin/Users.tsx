import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Ban,
    BadgeCheck,
    CheckCircle,
    Eye,
    Filter,
    ScrollText,
    Shield,
    ShieldAlert,
    Users as UsersIcon,
} from 'lucide-react';
import { useAuth, type UserRole } from '../../contexts/AuthContext';
import DataTable, { type Column } from './components/DataTable';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import { areDeveloperGameIdsEqual, getDeveloperGameScopeLabel, normalizeDeveloperGameIds } from '../../lib/developerGameAccess';
import { cn } from '../../lib/utils';
import SearchInput from './components/ui/SearchInput';
import CustomSelect, { type Option } from './components/ui/CustomSelect';
import { logger } from '../../lib/logger';
import { UserRoleModal } from './components/UserRoleModal';
import { getAllGames } from '../../config/games.config';

interface User {
    id: string;
    username: string;
    email?: string;
    role: UserRole;
    developerGameIds?: string[];
    banned: boolean;
    lastOnline?: string;
    createdAt: string;
    avatar?: string;
}

const ROLE_OPTIONS: Option[] = [
    { label: '管理员', value: 'admin', icon: <Shield size={14} className="text-indigo-500" /> },
    { label: '开发者', value: 'developer', icon: <ScrollText size={14} className="text-amber-500" /> },
    { label: '普通用户', value: 'user', icon: <UsersIcon size={14} /> },
];

const STATUS_OPTIONS: Option[] = [
    { label: '正常', value: 'false', icon: <BadgeCheck size={14} className="text-green-500" /> },
    { label: '已封禁', value: 'true', icon: <ShieldAlert size={14} className="text-red-500" /> },
];

const parseActionError = async (response: Response, fallback: string) => {
    const payload = await response.json().catch(() => null) as null | { error?: string; message?: string };
    return payload?.error || payload?.message || fallback;
};

function renderRoleBadge(role: UserRole, developerGameIds?: string[]) {
    if (role === 'admin') {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                <Shield size={12} className="opacity-80" />
                管理员
            </span>
        );
    }

    if (role === 'developer') {
        const scopeLabel = getDeveloperGameScopeLabel(developerGameIds);
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                <ScrollText size={12} className="opacity-80" />
                开发者{scopeLabel ? ` (${scopeLabel})` : ''}
            </span>
        );
    }

    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-semibold text-zinc-600">
            <UsersIcon size={12} className="opacity-80" />
            普通用户
        </span>
    );
}

export default function UsersPage() {
    const { token, user: authUser } = useAuth();
    const { success, error } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [roleFilter, setRoleFilter] = useState('');
    const [banFilter, setBanFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [roleTarget, setRoleTarget] = useState<User | null>(null);
    const [roleInitial, setRoleInitial] = useState<UserRole>('user');
    const [roleDraft, setRoleDraft] = useState<UserRole>('user');
    const [developerGameIdsDraft, setDeveloperGameIdsDraft] = useState<string[]>([]);
    const [roleSaving, setRoleSaving] = useState(false);

    const gameOptions = useMemo(
        () => getAllGames()
            .filter((game) => game.type === 'game' && !game.isUgc)
            .map((game) => ({ id: game.id, titleKey: game.titleKey })),
        []
    );

    const fetchUsers = async () => {
        if (!token) {
            setUsers([]);
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
                search,
            });

            if (roleFilter) query.append('role', roleFilter);
            if (banFilter) query.append('banned', banFilter);

            const res = await fetch(`${ADMIN_API_URL}/users?${query}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch users');

            const data = await res.json();
            setUsers(data.items);
            setTotalPages(Math.ceil(data.total / data.limit));
            setTotalItems(data.total);
        } catch (err) {
            logger.error('[AdminUsers] 获取用户列表失败', {
                error: err,
                page,
                search,
                roleFilter,
                banFilter,
            });
            error('获取用户列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, token, search, roleFilter, banFilter]);

    useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => users.some((user) => user.id === id)));
    }, [users]);

    const allSelected = users.length > 0 && users.every((user) => selectedIds.includes(user.id));

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : users.map((user) => user.id));
    };

    const toggleSelectOne = (userId: string) => {
        setSelectedIds((prev) => (
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        ));
    };

    const handleBanToggle = async (user: User) => {
        if (!token) return;
        if (!confirm(`确定要${user.banned ? '解封' : '封禁'}该用户吗？`)) return;

        try {
            const isBanning = !user.banned;
            const action = isBanning ? 'ban' : 'unban';
            const reason = isBanning ? (prompt('请输入封禁原因') ?? '').trim() : '';
            if (isBanning && !reason) {
                error('封禁原因不能为空');
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

            success('操作成功');
            await fetchUsers();
        } catch (err) {
            logger.error('[AdminUsers] 更新封禁状态失败', {
                userId: user.id,
                action: user.banned ? 'unban' : 'ban',
                error: err,
            });
            error('操作失败');
        }
    };

    const handleDelete = async (user: User) => {
        if (!token) return;
        if (user.role === 'admin') {
            error('不能删除管理员账号');
            return;
        }
        if (!confirm('确定要删除该用户吗？删除后无法恢复。')) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/users/${user.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '删除失败');
            }

            success('用户已删除');
            await fetchUsers();
        } catch (err) {
            logger.error('[AdminUsers] 删除用户失败', {
                userId: user.id,
                error: err,
            });
            error(err instanceof Error ? err.message : '删除失败');
        }
    };

    const handleBulkDelete = async () => {
        if (!token || selectedIds.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 位用户吗？`)) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/users/bulk-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ids: selectedIds }),
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '批量删除失败');
            }

            const payload = await res.json().catch(() => null);
            const deleted = payload?.deleted ?? selectedIds.length;
            const skipped = payload?.skipped?.length ?? 0;
            success(`已删除 ${deleted} 位用户${skipped ? `，跳过 ${skipped} 位` : ''}`);
            setSelectedIds([]);
            await fetchUsers();
        } catch (err) {
            logger.error('[AdminUsers] 批量删除用户失败', {
                selectedIds,
                error: err,
            });
            error(err instanceof Error ? err.message : '批量删除失败');
        }
    };

    const resetRoleState = () => {
        setRoleTarget(null);
        setRoleInitial('user');
        setRoleDraft('user');
        setDeveloperGameIdsDraft([]);
        setRoleSaving(false);
    };

    const openRoleModal = (user: User) => {
        setRoleTarget(user);
        setRoleInitial(user.role);
        setRoleDraft(user.role);
        setDeveloperGameIdsDraft(normalizeDeveloperGameIds(user.developerGameIds));
        setRoleSaving(false);
    };

    const closeRoleModal = () => {
        if (roleSaving) return;
        resetRoleState();
    };

    const toggleDeveloperGame = (gameId: string) => {
        setDeveloperGameIdsDraft((prev) => (
            prev.includes(gameId)
                ? prev.filter((item) => item !== gameId)
                : [...prev, gameId]
        ));
    };

    const handleSaveRole = async () => {
        if (!token || !roleTarget) return;

        const nextDeveloperGameIds = roleDraft === 'developer'
            ? normalizeDeveloperGameIds(developerGameIdsDraft)
            : [];

        if (roleDraft === 'developer' && nextDeveloperGameIds.length === 0) {
            error('开发者至少需要分配一个游戏');
            return;
        }

        const roleUnchanged = roleDraft === roleInitial;
        const scopeUnchanged = areDeveloperGameIdsEqual(
            roleTarget.role === 'developer' ? roleTarget.developerGameIds : [],
            nextDeveloperGameIds,
        );

        if (roleUnchanged && scopeUnchanged) {
            closeRoleModal();
            return;
        }

        setRoleSaving(true);
        try {
            const roleRes = await fetch(`${ADMIN_API_URL}/users/${roleTarget.id}/role`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    role: roleDraft,
                    developerGameIds: roleDraft === 'developer' ? nextDeveloperGameIds : undefined,
                }),
            });

            if (!roleRes.ok) {
                throw new Error(await parseActionError(roleRes, '更新角色失败'));
            }

            success(
                roleDraft === 'admin'
                    ? '已设为管理员'
                    : roleDraft === 'developer'
                        ? `已设为开发者，可管理 ${nextDeveloperGameIds.length} 个游戏`
                        : '已设为普通用户'
            );
            resetRoleState();
            await fetchUsers();
        } catch (err) {
            logger.error('[AdminUsers] 保存角色设置失败', {
                userId: roleTarget.id,
                nextRole: roleDraft,
                developerGameIds: nextDeveloperGameIds,
                error: err,
            });
            error(err instanceof Error ? err.message : '保存角色设置失败');
        } finally {
            setRoleSaving(false);
        }
    };

    const columns: Column<User>[] = [
        {
            header: (
                <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="选择全部用户"
                />
            ),
            width: '48px',
            className: 'text-center',
            cell: (user) => (
                <div className="flex items-center justify-center">
                    <input
                        type="checkbox"
                        checked={selectedIds.includes(user.id)}
                        onChange={() => toggleSelectOne(user.id)}
                        aria-label={`选择用户 ${user.username}`}
                    />
                </div>
            ),
        },
        {
            header: '用户',
            cell: (user) => (
                <div className="flex items-center gap-3">
                    <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-200 bg-zinc-100">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" />
                        ) : (
                            <span className="text-sm font-bold text-zinc-400">{user.username[0]?.toUpperCase()}</span>
                        )}
                        <span
                            className={cn(
                                'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white',
                                user.lastOnline ? 'bg-green-500' : 'bg-zinc-300'
                            )}
                            title={user.lastOnline ? '在线' : '离线'}
                        />
                    </div>
                    <div>
                        <div className="font-semibold text-zinc-900">{user.username}</div>
                        <div className="font-mono text-xs text-zinc-500">{user.email || '未绑定邮箱'}</div>
                    </div>
                </div>
            ),
        },
        {
            header: '角色',
            accessorKey: 'role',
            cell: (user) => <div className="flex items-center">{renderRoleBadge(user.role, user.developerGameIds)}</div>,
        },
        {
            header: '状态',
            accessorKey: 'banned',
            cell: (user) => (
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
                        user.banned
                            ? 'border-red-200 bg-red-50 text-red-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    )}
                >
                    {user.banned ? <ShieldAlert size={12} /> : <BadgeCheck size={12} />}
                    {user.banned ? '已封禁' : '正常'}
                </span>
            ),
        },
        {
            header: '注册时间',
            accessorKey: 'createdAt',
            cell: (user) => (
                <span className="font-mono text-xs font-medium text-zinc-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                </span>
            ),
        },
        {
            header: '操作',
            align: 'center',
            cell: (user) => (
                <div className="flex items-center justify-center gap-2">
                    <Link
                        to={`/admin/users/${user.id}`}
                        className="rounded-lg border border-transparent p-1.5 text-zinc-400 transition-colors hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-600"
                        title="查看详情"
                        aria-label="查看详情"
                    >
                        <Eye size={16} />
                    </Link>
                    <button
                        onClick={() => openRoleModal(user)}
                        className={cn(
                            'rounded-lg border border-transparent p-1.5 transition-colors',
                            user.role === 'admin'
                                ? 'text-violet-500 hover:border-violet-100 hover:bg-violet-50 hover:text-violet-700'
                                : user.role === 'developer'
                                    ? 'text-amber-500 hover:border-amber-100 hover:bg-amber-50 hover:text-amber-700'
                                    : 'text-indigo-500 hover:border-indigo-100 hover:bg-indigo-50 hover:text-indigo-700'
                        )}
                        title="角色设置"
                        aria-label="角色设置"
                    >
                        <Shield size={16} />
                    </button>
                    <button
                        onClick={() => { void handleBanToggle(user); }}
                        className={cn(
                            'rounded-lg border border-transparent p-1.5 transition-colors',
                            user.banned
                                ? 'text-green-600 hover:border-green-100 hover:bg-green-50'
                                : 'text-red-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600'
                        )}
                        title={user.banned ? '解封' : '封禁'}
                        aria-label={user.banned ? '解封' : '封禁'}
                    >
                        {user.banned ? <CheckCircle size={16} /> : <Ban size={16} />}
                    </button>
                    <button
                        onClick={() => { void handleDelete(user); }}
                        disabled={user.role === 'admin'}
                        className={cn(
                            'rounded-lg border border-transparent p-1.5 transition-colors',
                            user.role === 'admin'
                                ? 'cursor-not-allowed text-zinc-300'
                                : 'text-red-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600'
                        )}
                        title={user.role === 'admin' ? '不能删除管理员' : '删除'}
                        aria-label={user.role === 'admin' ? '不能删除管理员' : '删除'}
                    >
                        <ShieldAlert size={16} />
                    </button>
                </div>
            ),
        },
    ];

    const nextDeveloperGameIds = roleDraft === 'developer'
        ? normalizeDeveloperGameIds(developerGameIdsDraft)
        : [];
    const saveDisabled = !roleTarget
        || roleSaving
        || (roleDraft === 'developer' && nextDeveloperGameIds.length === 0)
        || (
            roleDraft === roleInitial
            && areDeveloperGameIdsEqual(
                roleTarget.role === 'developer' ? roleTarget.developerGameIds : [],
                nextDeveloperGameIds,
            )
        );

    return (
        <div className="mx-auto flex h-full w-full max-w-[1600px] min-h-0 flex-col bg-zinc-50/50 p-8">
            <div className="mb-8 flex-none">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">用户管理</h1>
                        <p className="mt-1 text-sm text-zinc-500">管理平台用户及其后台角色状态</p>
                    </div>

                    <div className="flex flex-col items-center gap-3 sm:flex-row">
                        <SearchInput
                            placeholder="搜索用户名或邮箱..."
                            onSearch={(value) => {
                                setSearch(value);
                                setPage(1);
                            }}
                            className="w-full sm:w-64"
                        />
                        <div className="flex w-full items-center gap-3 sm:w-auto">
                            <CustomSelect
                                value={roleFilter}
                                onChange={(value) => {
                                    setRoleFilter(value);
                                    setPage(1);
                                }}
                                options={ROLE_OPTIONS}
                                placeholder="所有角色"
                                allOptionLabel="所有角色"
                                prefixIcon={<Shield size={14} />}
                                className="w-full sm:w-40"
                            />
                            <CustomSelect
                                value={banFilter}
                                onChange={(value) => {
                                    setBanFilter(value);
                                    setPage(1);
                                }}
                                options={STATUS_OPTIONS}
                                placeholder="所有状态"
                                allOptionLabel="所有状态"
                                prefixIcon={<Filter size={14} />}
                                className="w-full sm:w-40"
                            />
                            <button
                                onClick={() => { void handleBulkDelete(); }}
                                disabled={selectedIds.length === 0}
                                className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                删除选中 {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/60 bg-white shadow-sm">
                <DataTable
                    className="h-full border-none"
                    columns={columns}
                    data={users}
                    loading={loading}
                    pagination={{
                        currentPage: page,
                        totalPages,
                        onPageChange: setPage,
                        totalItems,
                    }}
                />
            </div>

            {roleTarget && (
                <UserRoleModal
                    target={roleTarget}
                    roleDraft={roleDraft}
                    developerGameIdsDraft={developerGameIdsDraft}
                    gameOptions={gameOptions}
                    saving={roleSaving}
                    saveDisabled={saveDisabled}
                    roleLocked={authUser?.id === roleTarget.id}
                    onClose={closeRoleModal}
                    onSave={() => { void handleSaveRole(); }}
                    onRoleChange={(nextRole) => {
                        setRoleDraft(nextRole);
                        if (nextRole === 'user') {
                            setDeveloperGameIdsDraft([]);
                        }
                    }}
                    onToggleGame={toggleDeveloperGame}
                />
            )}
        </div>
    );
}
