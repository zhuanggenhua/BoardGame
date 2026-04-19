import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DataTable, { type Column } from './components/DataTable';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import { Calendar, CheckCircle2, CircleSlash, Package, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import SearchInput from './components/ui/SearchInput';
import CustomSelect, { type Option } from './components/ui/CustomSelect';

interface UgcPackageItem {
    id: string;
    packageId: string;
    name: string;
    description?: string;
    tags?: string[];
    ownerId: string;
    version?: string;
    gameId?: string;
    coverAssetId?: string;
    status: 'draft' | 'published';
    publishedAt?: string | null;
    createdAt: string;
    updatedAt: string;
}

const STATUS_OPTIONS: Option[] = [
    { label: '已发布', value: 'published', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
    { label: '草稿', value: 'draft', icon: <CircleSlash size={14} className="text-amber-500" /> },
];

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

export default function UgcPackagesPage() {
    const { token } = useAuth();
    const { success, error } = useToast();
    const [packages, setPackages] = useState<UgcPackageItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [ownerFilter, setOwnerFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const fetchPackages = async () => {
        if (!token) {
            setPackages([]);
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
            if (statusFilter) query.append('status', statusFilter);
            if (ownerFilter) query.append('ownerId', ownerFilter);

            const res = await fetch(`${ADMIN_API_URL}/ugc/packages?${query}`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('Failed to fetch ugc packages');
            const data = await res.json();
            const items = data.items.map((pkg: UgcPackageItem) => ({
                ...pkg,
                id: pkg.packageId,
            }));
            setPackages(items);
            setTotalPages(Math.ceil(data.total / data.limit));
            setTotalItems(data.total);
        } catch (err) {
            console.error(err);
            error('获取 UGC 包列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, token, search, statusFilter, ownerFilter]);

    const handleUnpublish = async (pkg: UgcPackageItem) => {
        if (pkg.status !== 'published') return;
        if (!confirm(`确定要下架 UGC 包 “${pkg.name}” 吗？`)) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/ugc/packages/${pkg.packageId}/unpublish`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '下架失败');
            }
            success('已下架该 UGC 包');
            fetchPackages();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '下架失败');
        }
    };

    const handleDelete = async (pkg: UgcPackageItem) => {
        if (!confirm(`确定要删除 UGC 包 “${pkg.name}” 吗？删除后无法恢复。`)) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/ugc/packages/${pkg.packageId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (!res.ok) {
                const payload = await res.json().catch(() => null);
                throw new Error(payload?.error || '删除失败');
            }
            success('UGC 包已删除');
            fetchPackages();
        } catch (err) {
            console.error(err);
            error(err instanceof Error ? err.message : '删除失败');
        }
    };

    const columns: Column<UgcPackageItem>[] = [
        {
            header: '包信息',
            cell: (pkg) => (
                <div className="space-y-1">
                    <div className="font-semibold text-zinc-900">{pkg.name}</div>
                    <div className="text-xs font-mono text-zinc-400">{pkg.packageId}</div>
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
                        {pkg.version && (
                            <span className="px-2 py-0.5 rounded-full bg-zinc-100 border border-zinc-200">v{pkg.version}</span>
                        )}
                        {pkg.gameId && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">{pkg.gameId}</span>
                        )}
                    </div>
                </div>
            ),
        },
        {
            header: '作者',
            cell: (pkg) => (
                <div className="text-xs text-zinc-500">
                    <div className="flex items-center gap-2 text-zinc-700">
                        <User size={12} className="text-zinc-400" />
                        <span className="font-medium">{pkg.ownerId}</span>
                    </div>
                    {pkg.tags && pkg.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {pkg.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-2 py-0.5 text-[10px] rounded-full bg-zinc-100 text-zinc-500">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            ),
        },
        {
            header: '状态',
            cell: (pkg) => (
                <span
                    className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
                        pkg.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                    )}
                >
                    {pkg.status === 'published' ? <CheckCircle2 size={12} /> : <CircleSlash size={12} />}
                    {pkg.status === 'published' ? '已发布' : '草稿'}
                </span>
            ),
        },
        {
            header: '发布时间',
            cell: (pkg) => (
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-mono">
                    <Calendar size={12} className="opacity-70" />
                    {formatDate(pkg.publishedAt)}
                </div>
            ),
        },
        {
            header: '更新时间',
            cell: (pkg) => (
                <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-mono">
                    <Calendar size={12} className="opacity-70" />
                    {formatDate(pkg.updatedAt)}
                </div>
            ),
        },
        {
            header: '操作',
            className: 'text-right',
            cell: (pkg) => (
                <div className="flex justify-end gap-3">
                    <button
                        onClick={() => handleUnpublish(pkg)}
                        disabled={pkg.status !== 'published'}
                        className="text-xs font-medium text-amber-600 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        下架
                    </button>
                    <button
                        onClick={() => handleDelete(pkg)}
                        className="text-xs font-medium text-red-500 hover:text-red-600"
                    >
                        删除
                    </button>
                </div>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col p-8 w-full max-w-[1600px] mx-auto min-h-0 bg-zinc-50/50">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 flex-none mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">UGC 管理</h1>
                    <p className="text-sm text-zinc-500 mt-1">查看并管理所有 UGC 包（下架/删除）</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    <SearchInput
                        placeholder="搜索包ID/名称/作者..."
                        onSearch={(val) => {
                            setSearch(val);
                            setPage(1);
                        }}
                        className="w-full sm:w-64"
                    />
                    <CustomSelect
                        value={statusFilter}
                        onChange={(val) => {
                            setStatusFilter(val);
                            setPage(1);
                        }}
                        options={STATUS_OPTIONS}
                        placeholder="全部状态"
                        allOptionLabel="全部状态"
                        prefixIcon={<Package size={14} />}
                        className="w-full sm:w-40"
                    />
                    <input
                        value={ownerFilter}
                        onChange={(event) => {
                            setOwnerFilter(event.target.value);
                            setPage(1);
                        }}
                        placeholder="作者ID"
                        className="w-full sm:w-40 bg-white border border-zinc-200 text-zinc-900 text-sm rounded-xl px-3 py-2 transition-all duration-200 placeholder:text-zinc-400/80 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-indigo-300 shadow-sm"
                    />
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-zinc-200/60 shadow-sm overflow-hidden flex flex-col">
                <DataTable
                    className="h-full border-none"
                    columns={columns}
                    data={packages}
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
