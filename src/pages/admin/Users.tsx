import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import DataTable, { type Column } from './components/DataTable';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import { Ban, CheckCircle, Eye, Shield, ShieldAlert, BadgeCheck, Users as UsersIcon, Filter } from 'lucide-react';
import { cn } from '../../lib/utils';
import SearchInput from './components/ui/SearchInput';
import CustomSelect, { type Option } from './components/ui/CustomSelect';


interface User {
    id: string;
    username: string;
    email?: string;
    role: 'user' | 'admin';
    banned: boolean;
    lastOnline?: string;
    createdAt: string;
    avatar?: string;
}

const ROLE_OPTIONS: Option[] = [
    { label: '管理员', value: 'admin', icon: <Shield size={14} className="text-indigo-500" /> },
    { label: '普通用户', value: 'user', icon: <UsersIcon size={14} /> },
];

const STATUS_OPTIONS: Option[] = [
    { label: '正常', value: 'false', icon: <BadgeCheck size={14} className="text-green-500" /> },
    { label: '已封禁', value: 'true', icon: <ShieldAlert size={14} className="text-red-500" /> },
];

export default function UsersPage() {
    const { token } = useAuth();
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
                search
            });

            if (roleFilter) query.append('role', roleFilter);
            if (banFilter) query.append('banned', banFilter);

            const res = await fetch(`${ADMIN_API_URL}/users?${query}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch users');
            const data = await res.json();
            setUsers(data.items);
            setTotalPages(Math.ceil(data.total / data.limit));
            setTotalItems(data.total);
        } catch (err) {
            console.error(err);
            error('获取用户列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, token, search, roleFilter, banFilter]);

    useEffect(() => {
        setSelectedIds((prev) => prev.filter((id) => users.some((u) => u.id === id)));
    }, [users]);

    const allSelected = users.length > 0 && users.every((u) => selectedIds.includes(u.id));

    const toggleSelectAll = () => {
        setSelectedIds(allSelected ? [] : users.map((u) => u.id));
    };

    const toggleSelectOne = (userId: string) => {
        setSelectedIds((prev) => (
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        ));
    };

    const handleBanToggle = async (user: User) => {
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
                    'Authorization': `Bearer ${token}`,
                    ...(isBanning ? { 'Content-Type': 'application/json' } : {})
                },
                body: isBanning ? JSON.stringify({ reason }) : undefined,
            });

            if (!res.ok) throw new Error('Action failed');

            success('操作成功');
            fetchUsers();
        } catch (err) {
            console.error(err);
            error('操作失败');
        }
    };

    const handleDelete = async (user: User) => {
        if (user.role === 'admin') {
            error('不能删除管理员账号');
            return;
        }
        if (!confirm('确定要删除该用户吗？删除后无法恢复。')) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/users/${user.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '删除失败');
            }

            success('用户已删除');
            fetchUsers();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '删除失败');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedIds.length} 位用户吗？`)) return;

        try {
            const res = await fetch(`${ADMIN_API_URL}/users/bulk-delete`, {
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

            const payload = await res.json().catch(() => null);
            const deleted = payload?.deleted ?? selectedIds.length;
            const skipped = payload?.skipped?.length ?? 0;
            success(`已删除 ${deleted} 位用户${skipped ? `，跳过 ${skipped} 位` : ''}`);
            setSelectedIds([]);
            fetchUsers();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '批量删除失败');
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
            )
        },
        {
            header: '用户',
            cell: (user) => (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                        {user.avatar ? (
                            <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-sm font-bold text-zinc-400">{user.username[0]?.toUpperCase()}</span>
                        )}
                        <span className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white", user.lastOnline ? "bg-green-500" : "bg-zinc-300")} title={user.lastOnline ? "在线" : "离线"} />
                    </div>
                    <div>
                        <div className="font-semibold text-zinc-900">{user.username}</div>
                        <div className="text-xs text-zinc-500 font-mono">{user.email || '未绑定邮箱'}</div>
                    </div>
                </div>
            )
        },
        {
            header: '角色',
            accessorKey: 'role',
            cell: (user) => (
                <div className="flex items-center">
                    {user.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Shield size={12} className="opacity-80" />
                            管理员
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-50 text-zinc-600 border border-zinc-200">
                            用户
                        </span>
                    )}
                </div>
            )
        },
        {
            header: '状态',
            accessorKey: 'banned',
            cell: (user) => (
                <span className={cn(
                    "px-2.5 py-1 text-xs rounded-full font-semibold inline-flex items-center gap-1.5 border",
                    user.banned
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                )}>
                    {user.banned ? <ShieldAlert size={12} /> : <BadgeCheck size={12} />}
                    {user.banned ? '已封禁' : '正常'}
                </span>
            )
        },
        {
            header: '注册时间',
            accessorKey: 'createdAt',
            cell: (user) => <span className="text-zinc-500 font-medium text-xs font-mono">{new Date(user.createdAt).toLocaleDateString()}</span>
        },
        {
            header: '操作',
            align: 'center',
            cell: (user) => (
                <div className="flex items-center justify-center gap-2">
                    <Link
                        to={`/admin/users/${user.id}`}
                        className="p-1.5 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                        title="查看详情"
                    >
                        <Eye size={16} />
                    </Link>
                    <button
                        onClick={() => handleBanToggle(user)}
                        className={cn(
                            "p-1.5 rounded-lg transition-colors border border-transparent",
                            user.banned
                                ? "text-green-600 hover:bg-green-50 hover:border-green-100"
                                : "text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100"
                        )}
                        title={user.banned ? "解封" : "封禁"}
                    >
                        {user.banned ? <CheckCircle size={16} /> : <Ban size={16} />}
                    </button>
                    <button
                        onClick={() => handleDelete(user)}
                        disabled={user.role === 'admin'}
                        className={cn(
                            "p-1.5 rounded-lg transition-colors border border-transparent",
                            user.role === 'admin'
                                ? "text-zinc-300 cursor-not-allowed"
                                : "text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-100"
                        )}
                        title={user.role === 'admin' ? "不能删除管理员" : "删除"}
                    >
                        <ShieldAlert size={16} />
                    </button>
                </div>
            )
        }
    ];

    return (
        <div className="h-full flex flex-col p-8 w-full max-w-[1600px] mx-auto min-h-0 bg-zinc-50/50">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 flex-none mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">用户管理</h1>
                    <p className="text-sm text-zinc-500 mt-1">管理平台用户及其权限状态</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <SearchInput
                        placeholder="搜索用户名或邮箱..."
                        onSearch={(val) => { setSearch(val); setPage(1); }}
                        className="w-full sm:w-64"
                    />
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <CustomSelect
                            value={roleFilter}
                            onChange={(val) => { setRoleFilter(val); setPage(1); }}
                            options={ROLE_OPTIONS}
                            placeholder="所有角色"
                            allOptionLabel="所有角色"
                            prefixIcon={<Shield size={14} />}
                            className="w-full sm:w-40"
                        />
                        <CustomSelect
                            value={banFilter}
                            onChange={(val) => { setBanFilter(val); setPage(1); }}
                            options={STATUS_OPTIONS}
                            placeholder="所有状态"
                            allOptionLabel="所有状态"
                            prefixIcon={<Filter size={14} />}
                            className="w-full sm:w-40"
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
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden flex flex-col">
                <DataTable
                    className="h-full border-none"
                    columns={columns}
                    data={users}
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
