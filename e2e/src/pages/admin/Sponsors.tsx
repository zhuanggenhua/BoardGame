import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ADMIN_API_URL } from '../../config/server';
import DataTable, { type Column } from './components/DataTable';
import SearchInput from './components/ui/SearchInput';
import { BadgeCheck, BadgeX, Pin, PinOff, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SponsorItem {
    id: string;
    name: string;
    amount: number;
    isPinned: boolean;
    createdAt: string;
    updatedAt: string;
}

interface SponsorFormState {
    name: string;
    amount: string;
    isPinned: boolean;
}

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString(undefined, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const emptyForm: SponsorFormState = {
    name: '',
    amount: '',
    isPinned: false,
};

export default function SponsorsPage() {
    const { token } = useAuth();
    const { success, error } = useToast();
    const [sponsors, setSponsors] = useState<SponsorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState<SponsorFormState>(emptyForm);

    const canSubmit = useMemo(() => {
        const amount = Number(form.amount);
        return form.name.trim().length > 0 && Number.isFinite(amount) && amount >= 0;
    }, [form.amount, form.name]);

    const fetchSponsors = async () => {
        if (!token) {
            setSponsors([]);
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
            const res = await fetch(`${ADMIN_API_URL}/sponsors?${query}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('获取赞助列表失败');
            const data = await res.json();
            setSponsors(data.items || []);
            setTotalPages(Math.ceil((data.total || 0) / (data.limit || 10)) || 1);
            setTotalItems(data.total || 0);
        } catch (err) {
            console.error(err);
            error('获取赞助列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSponsors();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, token, search]);

    const handleCreate = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!token) return;
        if (!canSubmit) {
            error('请填写赞助者姓名与正确金额');
            return;
        }
        setCreating(true);
        try {
            const payload = {
                name: form.name.trim(),
                amount: Number(form.amount),
                isPinned: form.isPinned,
            };
            const res = await fetch(`${ADMIN_API_URL}/sponsors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error('创建失败');
            success('赞助信息已添加');
            setForm(emptyForm);
            setPage(1);
            fetchSponsors();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '创建失败');
        } finally {
            setCreating(false);
        }
    };

    const handleTogglePinned = async (item: SponsorItem) => {
        if (!token) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/sponsors/${item.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ isPinned: !item.isPinned }),
            });
            if (!res.ok) throw new Error('更新失败');
            success(item.isPinned ? '已取消置顶' : '已设为置顶');
            fetchSponsors();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '更新失败');
        }
    };

    const handleDelete = async (item: SponsorItem) => {
        if (!token) return;
        if (!confirm(`确定要删除赞助记录 “${item.name}” 吗？`)) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/sponsors/${item.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('删除失败');
            success('赞助记录已删除');
            fetchSponsors();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '删除失败');
        }
    };

    const columns: Column<SponsorItem>[] = [
        {
            header: '赞助者',
            cell: (item) => (
                <div className="min-w-0">
                    <div className="font-semibold text-zinc-900 truncate">{item.name}</div>
                </div>
            ),
        },
        {
            header: '金额',
            cell: (item) => (
                <div className="font-mono text-zinc-700">¥{item.amount}</div>
            ),
        },
        {
            header: '置顶',
            cell: (item) => (
                <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border',
                    item.isPinned
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-zinc-100 text-zinc-500 border-zinc-200'
                )}>
                    {item.isPinned ? <BadgeCheck size={12} /> : <BadgeX size={12} />}
                    {item.isPinned ? '置顶' : '普通'}
                </span>
            ),
        },
        {
            header: '创建时间',
            cell: (item) => (
                <div className="text-xs text-zinc-500 font-mono">{formatDate(item.createdAt)}</div>
            ),
        },
        {
            header: '操作',
            align: 'right',
            cell: (item) => (
                <div className="flex items-center justify-end gap-2">
                    <button
                        onClick={() => handleTogglePinned(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-zinc-200 text-zinc-600 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                        {item.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                        {item.isPinned ? '取消置顶' : '置顶'}
                    </button>
                    <button
                        onClick={() => handleDelete(item)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                        <Trash2 size={12} />
                        删除
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="h-full overflow-y-auto p-8">
            <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">赞助管理</h1>
                        <p className="text-zinc-500 mt-1">维护关于弹窗的赞助滚动列表。</p>
                    </div>
                    <button
                        onClick={fetchSponsors}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-200 text-sm text-zinc-600 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                    >
                        <RefreshCw size={16} />
                        刷新
                    </button>
                </div>

                <form
                    onSubmit={handleCreate}
                    className="bg-white rounded-2xl border border-zinc-100 shadow-xl shadow-zinc-200/40 p-6 space-y-4"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-500">赞助者姓名</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                                placeholder="请输入昵称"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-zinc-500">赞助金额</label>
                            <input
                                type="number"
                                min={0}
                                step="1"
                                value={form.amount}
                                onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                                placeholder="金额（元）"
                            />
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-sm text-zinc-600">
                            <input
                                type="checkbox"
                                checked={form.isPinned}
                                onChange={(e) => setForm((prev) => ({ ...prev, isPinned: e.target.checked }))}
                            />
                            设为置顶
                        </label>
                        <button
                            type="submit"
                            disabled={!canSubmit || creating}
                            className={cn(
                                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors',
                                canSubmit && !creating
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                                    : 'bg-zinc-200 text-zinc-500 cursor-not-allowed'
                            )}
                        >
                            {creating ? '提交中...' : '添加赞助'}
                        </button>
                    </div>
                </form>

                <div className="flex items-center justify-between gap-4">
                    <SearchInput
                        value={search}
                        onSearch={(value) => {
                            setPage(1);
                            setSearch(value);
                        }}
                        placeholder="搜索赞助者"
                    />
                </div>

                <DataTable
                    columns={columns}
                    data={sponsors}
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
