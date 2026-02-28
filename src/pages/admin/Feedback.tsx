import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useAuth } from '../../contexts/AuthContext';
import { ADMIN_API_URL } from '../../config/server';
import { useToast } from '../../contexts/ToastContext';
import {
    CheckCircle, Circle, AlertTriangle, Lightbulb, HelpCircle,
    Gamepad2, Trash2, ChevronDown, ChevronRight, RefreshCw, Contact,
    Image as ImageIcon, ScrollText, Copy, Check
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import ImageLightbox from '../../components/common/ImageLightbox';

// ── 类型 ──

interface FeedbackItem {
    _id: string;
    userId?: {
        _id: string;
        username: string;
        avatar?: string;
    };
    content: string;
    type: 'bug' | 'suggestion' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    gameName?: string;
    contactInfo?: string;
    actionLog?: string;
    stateSnapshot?: string; // 完整游戏状态 JSON
    createdAt: string;
}

// ── 常量 ──

type StatusOption = { value: FeedbackItem['status']; color: string };
type StatusOptionWithLabel = StatusOption & { label: string };
type TypeOption = { value: FeedbackItem['type']; icon: React.ElementType; iconColor: string };
type TypeOptionWithLabel = TypeOption & { label: string };
type SeverityConfig = Record<FeedbackItem['severity'], { label: string; dot: string }>;

const STATUS_OPTIONS: StatusOption[] = [
    { value: 'open', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'in_progress', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'resolved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'closed', color: 'bg-zinc-100 text-zinc-500 border-zinc-200' },
];

const TYPE_OPTIONS: TypeOption[] = [
    { value: 'bug', icon: AlertTriangle, iconColor: 'text-red-500' },
    { value: 'suggestion', icon: Lightbulb, iconColor: 'text-amber-500' },
    { value: 'other', icon: HelpCircle, iconColor: 'text-blue-500' },
];

const SEVERITY_DOTS: Record<FeedbackItem['severity'], string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500',
};

const buildStatusOptions = (t: TFunction<'admin'>): StatusOptionWithLabel[] => (
    STATUS_OPTIONS.map((option) => ({
        ...option,
        label: t(`feedback.status.${option.value}`),
    }))
);

const buildTypeOptions = (t: TFunction<'admin'>): TypeOptionWithLabel[] => (
    TYPE_OPTIONS.map((option) => ({
        ...option,
        label: t(`feedback.type.${option.value}`),
    }))
);

const buildSeverityConfig = (t: TFunction<'admin'>): SeverityConfig => ({
    critical: { label: t('feedback.severity.critical'), dot: SEVERITY_DOTS.critical },
    high: { label: t('feedback.severity.high'), dot: SEVERITY_DOTS.high },
    medium: { label: t('feedback.severity.medium'), dot: SEVERITY_DOTS.medium },
    low: { label: t('feedback.severity.low'), dot: SEVERITY_DOTS.low },
});

const POLL_INTERVAL = 30_000; // 30 秒自动刷新

// ── 辅助组件 ──

/** 内联状态下拉选择器 */
function StatusSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: StatusOptionWithLabel[] }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find((s) => s.value === value) ?? options[0];

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
                className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border transition-colors cursor-pointer',
                    current.color
                )}
            >
                {current.label}
                <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 left-0 bg-white rounded-lg shadow-lg border border-zinc-200 py-1 min-w-[100px]">
                    {options.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(opt.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 transition-colors',
                                opt.value === value ? 'font-semibold text-zinc-900' : 'text-zinc-600'
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** 筛选标签按钮 */
function FilterTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'px-2.5 py-1 text-xs font-medium rounded-md transition-all',
                active
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100'
            )}
        >
            {children}
        </button>
    );
}

// ── 主组件 ──

export default function AdminFeedbackPage() {
    const { token } = useAuth();
    const { success, error } = useToast();
    const { t } = useTranslation('admin');

    const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
    const typeOptions = useMemo(() => buildTypeOptions(t), [t]);
    const severityConfig = useMemo(() => buildSeverityConfig(t), [t]);

    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const requestIdRef = useRef(0);

    // 用于静默轮询（不显示 loading）
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    const fetchFeedbacks = useCallback(async (silent = false) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        if (silent) setIsPolling(true);
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (typeFilter !== 'all') params.set('type', typeFilter);

            const res = await fetch(`${ADMIN_API_URL}/feedback?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('fetch_failed');
            const data = await res.json();
            if (isMountedRef.current && requestId === requestIdRef.current) {
                setFeedbacks(data.items);
            }
        } catch {
            if (!silent) error(t('feedback.messages.fetchFailed'));
        } finally {
            if (isMountedRef.current && requestId === requestIdRef.current) {
                setLoading(false);
                setIsPolling(false);
            }
        }
    }, [token, statusFilter, typeFilter, error, t]);

    // 初始加载 + 筛选变更
    useEffect(() => {
        fetchFeedbacks();
    }, [fetchFeedbacks]);

    // 自动轮询
    useEffect(() => {
        const timer = setInterval(() => fetchFeedbacks(true), POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchFeedbacks]);

    // 清理已不存在的选中项
    useEffect(() => {
        setSelectedIds((prev) => {
            const ids = new Set<string>();
            prev.forEach((id) => { if (feedbacks.some((f) => f._id === id)) ids.add(id); });
            return ids.size === prev.size ? prev : ids;
        });
    }, [feedbacks]);

    // ── 选择逻辑 ──

    const allSelected = feedbacks.length > 0 && feedbacks.every((f) => selectedIds.has(f._id));

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(feedbacks.map((f) => f._id)));
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // ── 操作 ──

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            const res = await fetch(`${ADMIN_API_URL}/feedback/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) throw new Error('update_failed');
            setFeedbacks((prev) => prev.map((f) => (f._id === id ? { ...f, status: newStatus as FeedbackItem['status'] } : f)));
            success(t('feedback.messages.updateSuccess'));
        } catch {
            error(t('feedback.messages.updateFailed'));
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t('feedback.confirm.delete'))) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/feedback/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) throw new Error('delete_failed');
            setFeedbacks((prev) => prev.filter((f) => f._id !== id));
            setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
            success(t('feedback.messages.deleteSuccess'));
        } catch {
            error(t('feedback.messages.deleteFailed'));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(t('feedback.confirm.bulkDelete', { count: selectedIds.size }))) return;
        try {
            const res = await fetch(`${ADMIN_API_URL}/feedback/bulk-delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            if (!res.ok) throw new Error('bulk_delete_failed');
            success(t('feedback.messages.bulkDeleteSuccess'));
            setSelectedIds(new Set());
            fetchFeedbacks();
        } catch {
            error(t('feedback.messages.bulkDeleteFailed'));
        }
    };

    const changeFilter = (setter: (v: string) => void, value: string) => {
        setter(value);
        setSelectedIds(new Set());
        setExpandedId(null);
    };

    // ── 渲染 ──

    return (
        <div className="h-full flex flex-col p-6 w-full max-w-[1400px] mx-auto min-h-0">
            {/* 顶栏：标题 + 操作 */}
            <div className="flex items-center justify-between gap-4 flex-none mb-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-lg font-bold text-zinc-900">{t('feedback.title')}</h1>
                    <span className="text-xs text-zinc-400">{t('feedback.count', { count: feedbacks.length })}</span>
                    <button
                        onClick={() => fetchFeedbacks()}
                        title={t('feedback.refresh')}
                        className="p-1 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                        <RefreshCw size={14} className={cn(isPolling && 'animate-spin')} />
                    </button>
                    {isPolling && <span className="text-[10px] text-zinc-400">{t('feedback.polling')}</span>}
                </div>

                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md border border-red-200 transition-colors"
                        >
                            <Trash2 size={12} />
                            {t('feedback.bulkDelete', { count: selectedIds.size })}
                        </button>
                    )}
                </div>
            </div>

            {/* 筛选栏 */}
            <div className="flex items-center gap-4 flex-none mb-3 pb-3 border-b border-zinc-100">
                <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400 mr-1">{t('feedback.filters.status')}</span>
                    {[{ value: 'all', label: t('feedback.filters.all') }, ...statusOptions].map((opt) => (
                        <FilterTab
                            key={opt.value}
                            active={statusFilter === opt.value}
                            onClick={() => changeFilter(setStatusFilter, opt.value)}
                        >
                            {opt.label}
                        </FilterTab>
                    ))}
                </div>
                <div className="w-px h-4 bg-zinc-200" />
                <div className="flex items-center gap-1">
                    <span className="text-xs text-zinc-400 mr-1">{t('feedback.filters.type')}</span>
                    <FilterTab active={typeFilter === 'all'} onClick={() => changeFilter(setTypeFilter, 'all')}>
                        {t('feedback.filters.all')}
                    </FilterTab>
                    {typeOptions.map((opt) => {
                        const Icon = opt.icon;
                        return (
                            <FilterTab key={opt.value} active={typeFilter === opt.value} onClick={() => changeFilter(setTypeFilter, opt.value)}>
                                <span className="flex items-center gap-1">
                                    <Icon size={12} className={opt.iconColor} />
                                    {opt.label}
                                </span>
                            </FilterTab>
                        );
                    })}
                </div>
            </div>

            {/* 表格 */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <RefreshCw className="animate-spin text-zinc-300" size={24} />
                    </div>
                ) : feedbacks.length === 0 ? (
                    <div className="text-center py-20 text-zinc-400 text-sm">{t('feedback.table.empty')}</div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-zinc-50">
                            <tr className="text-left text-xs text-zinc-400 font-medium">
                                <th className="w-8 py-2 px-2">
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleSelectAll}
                                        className="rounded border-zinc-300"
                                        aria-label={t('feedback.table.selectAll')}
                                    />
                                </th>
                                <th className="w-8 py-2" />
                                <th className="py-2 px-2">{t('feedback.table.content')}</th>
                                <th className="py-2 px-2 w-20">{t('feedback.table.type')}</th>
                                <th className="py-2 px-2 w-16">{t('feedback.table.severity')}</th>
                                <th className="py-2 px-2 w-24">{t('feedback.table.status')}</th>
                                <th className="py-2 px-2 w-24">{t('feedback.table.submitter')}</th>
                                <th className="py-2 px-2 w-32">{t('feedback.table.time')}</th>
                                <th className="py-2 px-2 w-16" />
                            </tr>
                        </thead>
                        <tbody>
                            {feedbacks.map((item) => {
                                const expanded = expandedId === item._id;
                                const typeOpt = typeOptions.find((t) => t.value === item.type);
                                const TypeIcon = typeOpt?.icon ?? HelpCircle;
                                const sevCfg = severityConfig[item.severity] ?? severityConfig.low;

                                return (
                                    <FeedbackRow
                                        key={item._id}
                                        item={item}
                                        expanded={expanded}
                                        selected={selectedIds.has(item._id)}
                                        TypeIcon={TypeIcon}
                                        typeOpt={typeOpt}
                                        sevCfg={sevCfg}
                                        statusOptions={statusOptions}
                                        t={t}
                                        onToggleExpand={() => setExpandedId(expanded ? null : item._id)}
                                        onToggleSelect={() => toggleSelect(item._id)}
                                        onStatusUpdate={handleStatusUpdate}
                                        onDelete={handleDelete}
                                        onImageClick={setPreviewImage}
                                    />
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
            <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />
        </div>
    );
}

// ── 行组件（表格行 + 展开详情） ──

interface FeedbackRowProps {
    item: FeedbackItem;
    expanded: boolean;
    selected: boolean;
    TypeIcon: React.ElementType;
    typeOpt: TypeOptionWithLabel | undefined;
    sevCfg: SeverityConfig[FeedbackItem['severity']];
    statusOptions: StatusOptionWithLabel[];
    t: TFunction<'admin'>;
    onToggleExpand: () => void;
    onToggleSelect: () => void;
    onStatusUpdate: (id: string, status: string) => void;
    onDelete: (id: string) => void;
    onImageClick: (src: string) => void;
}

function FeedbackRow({
    item, expanded, selected, TypeIcon, typeOpt, sevCfg, statusOptions, t,
    onToggleExpand, onToggleSelect, onStatusUpdate, onDelete, onImageClick,
}: FeedbackRowProps) {
    return (
        <>
            <tr
                onClick={onToggleExpand}
                className={cn(
                    'border-b border-zinc-50 cursor-pointer transition-colors group',
                    expanded ? 'bg-indigo-50/40' : 'hover:bg-zinc-50/80',
                    selected && 'bg-indigo-50/60'
                )}
            >
                {/* 选择框 */}
                <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggleSelect}
                        className="rounded border-zinc-300"
                        aria-label={t('feedback.table.selectItem', { id: item._id })}
                    />
                </td>

                {/* 展开箭头 */}
                <td className="py-2">
                    {expanded
                        ? <ChevronDown size={14} className="text-zinc-400" />
                        : <ChevronRight size={14} className="text-zinc-300" />
                    }
                </td>

                {/* 内容摘要 */}
                <td className="py-2 px-2">
                    <div className="flex items-center gap-2">
                        <p className={cn('truncate max-w-[400px]', expanded ? 'text-zinc-900 font-medium' : 'text-zinc-700')}>
                            {extractText(item.content, t)}
                        </p>
                        {hasEmbeddedImage(item.content) && (
                            <ImageIcon size={14} className="text-zinc-400 flex-shrink-0" />
                        )}
                    </div>
                </td>

                {/* 类型 */}
                <td className="py-2 px-2">
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-600">
                        <TypeIcon size={12} className={typeOpt?.iconColor ?? 'text-zinc-400'} />
                        {typeOpt?.label ?? item.type}
                    </span>
                </td>

                {/* 严重度 */}
                <td className="py-2 px-2">
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-600">
                        <span className={cn('w-2 h-2 rounded-full', sevCfg.dot)} />
                        {sevCfg.label}
                    </span>
                </td>

                {/* 状态 */}
                <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect value={item.status} onChange={(v) => onStatusUpdate(item._id, v)} options={statusOptions} />
                </td>

                {/* 提交者 */}
                <td className="py-2 px-2">
                    <div className="flex items-center gap-1.5">
                        {item.userId ? (
                            <>
                                <div className="w-5 h-5 rounded-full bg-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-500 overflow-hidden flex-shrink-0">
                                    {item.userId.avatar
                                        ? <img src={item.userId.avatar} alt="" className="w-full h-full object-cover" />
                                        : item.userId.username?.[0]?.toUpperCase()
                                    }
                                </div>
                                <span className="text-xs text-zinc-600 truncate max-w-[80px]">{item.userId.username}</span>
                            </>
                        ) : (
                            <span className="text-xs text-zinc-400 italic">{t('feedback.anonymous')}</span>
                        )}
                    </div>
                </td>

                {/* 时间 */}
                <td className="py-2 px-2 text-xs text-zinc-400 tabular-nums">
                    {formatTime(item.createdAt, t)}
                </td>

                {/* 操作 */}
                <td className="py-2 px-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={() => onStatusUpdate(item._id, item.status === 'resolved' ? 'open' : 'resolved')}
                            className="p-1 rounded hover:bg-zinc-100 transition-colors"
                            title={item.status === 'resolved' ? t('feedback.actions.reopen') : t('feedback.actions.resolve')}
                        >
                            {item.status === 'resolved'
                                ? <Circle size={14} className="text-zinc-400" />
                                : <CheckCircle size={14} className="text-emerald-500" />
                            }
                        </button>
                        <button
                            onClick={() => onDelete(item._id)}
                            className="p-1 rounded hover:bg-red-50 transition-colors"
                            title={t('feedback.actions.delete')}
                        >
                            <Trash2 size={14} className="text-zinc-300 hover:text-red-500" />
                        </button>
                    </div>
                </td>
            </tr>

            {/* 展开详情 */}
            <AnimatePresence>
                {expanded && (
                    <tr>
                        <td colSpan={9} className="p-0">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.15 }}
                                className="overflow-hidden"
                            >
                                <div className="px-10 py-4 bg-zinc-50/50 border-b border-zinc-100">
                                    <FeedbackContent content={item.content} onImageClick={onImageClick} t={t} />
                                    {item.actionLog && (
                                        <details className="mt-3">
                                            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700 font-medium">
                                                {t('feedback.actionLog.title')}
                                            </summary>
                                            <pre className="mt-2 max-h-48 overflow-auto rounded bg-zinc-100 border border-zinc-200 p-3 text-[11px] text-zinc-600 font-mono whitespace-pre-wrap leading-relaxed">
                                                {item.actionLog}
                                            </pre>
                                        </details>
                                    )}
                                    {item.stateSnapshot && (
                                        <details className="mt-3">
                                            <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-700 font-medium flex items-center gap-2">
                                                <ScrollText size={12} />
                                                {t('feedback.stateSnapshot.title')}
                                            </summary>
                                            <div className="mt-2 relative group">
                                                <pre className="max-h-64 overflow-auto rounded bg-zinc-900 border border-zinc-700 p-3 text-[11px] text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
                                                    {item.stateSnapshot}
                                                </pre>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigator.clipboard.writeText(item.stateSnapshot!).then(() => {
                                                            // 临时显示复制成功提示
                                                            const btn = e.currentTarget;
                                                            const originalText = btn.textContent;
                                                            btn.textContent = '✓ ' + t('feedback.stateSnapshot.copied');
                                                            setTimeout(() => {
                                                                btn.textContent = originalText;
                                                            }, 2000);
                                                        });
                                                    }}
                                                    className="absolute top-2 right-2 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                                                >
                                                    <Copy size={10} />
                                                    {t('feedback.stateSnapshot.copy')}
                                                </button>
                                            </div>
                                        </details>
                                    )}
                                    <div className="flex items-center gap-4 text-xs text-zinc-400 mt-3">
                                        {item.gameName && (
                                            <span className="inline-flex items-center gap-1">
                                                <Gamepad2 size={12} />
                                                {item.gameName}
                                            </span>
                                        )}
                                        {item.contactInfo && (
                                            <span className="inline-flex items-center gap-1">
                                                <Contact size={12} />
                                                {item.contactInfo}
                                            </span>
                                        )}
                                        <span>{t('feedback.table.id', { id: item._id })}</span>
                                        <CopyFeedbackButton item={item} t={t} />
                                    </div>
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
}

// ── 一键复制按钮 ──

function CopyFeedbackButton({ item, t }: { item: FeedbackItem; t: TFunction<'admin'> }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        const textContent = extractText(item.content, t);
        const submitter = item.userId?.username || t('feedback.anonymous');
        const parts = [
            `【${t(`feedback.type.${item.type}`)}】${t(`feedback.severity.${item.severity}`)}`,
            item.gameName ? `游戏: ${item.gameName}` : '',
            `提交者: ${submitter}`,
            `时间: ${new Date(item.createdAt).toLocaleString('zh-CN')}`,
            '',
            '--- 反馈内容 ---',
            textContent,
            item.actionLog ? `\n--- 操作日志 ---\n${item.actionLog}` : '',
        ].filter(Boolean).join('\n');

        navigator.clipboard.writeText(parts).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button
            onClick={handleCopy}
            className={cn(
                'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
                copied
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100'
            )}
            title={t('feedback.actions.copyAll')}
        >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? t('feedback.actions.copied') : t('feedback.actions.copyAll')}
        </button>
    );
}

// ── 内容解析与渲染 ──

/** 匹配 Markdown 内嵌图片：![alt](data:image/...) */
const EMBEDDED_IMG_RE = /!\[([^\]]*)\]\((data:image\/[^)]+)\)/g;

/** 提取纯文本（去掉内嵌图片的 Markdown） */
function extractText(content: string, t: TFunction<'admin'>): string {
    return content.replace(EMBEDDED_IMG_RE, '').trim() || t('feedback.content.onlyImage');
}

/** 是否包含内嵌图片 */
function hasEmbeddedImage(content: string): boolean {
    return EMBEDDED_IMG_RE.test(content);
}

/** 将 content 中的文本和内嵌图片分别渲染 */
function FeedbackContent({ content, onImageClick, t }: { content: string; onImageClick: (src: string) => void; t: TFunction<'admin'> }) {
    // 重置 lastIndex（全局正则需要）
    EMBEDDED_IMG_RE.lastIndex = 0;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;

    while ((match = EMBEDDED_IMG_RE.exec(content)) !== null) {
        // 图片前的文本
        if (match.index > lastIndex) {
            const text = content.slice(lastIndex, match.index).trim();
            if (text) {
                parts.push(
                    <p key={key++} className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                        {text}
                    </p>
                );
            }
        }
        // 图片 — 点击打开灯箱预览
        const imgSrc = match[2];
        parts.push(
            <button
                key={key++}
                type="button"
                onClick={(e) => { e.stopPropagation(); onImageClick(imgSrc); }}
                className="block text-left"
            >
                <img
                    src={imgSrc}
                    alt={match[1] || t('feedback.content.screenshotAlt')}
                    className="max-w-md max-h-64 rounded-lg border border-zinc-200 object-contain bg-white cursor-zoom-in hover:shadow-md transition-shadow"
                />
            </button>
        );
        lastIndex = match.index + match[0].length;
    }

    // 剩余文本
    const remaining = content.slice(lastIndex).trim();
    if (remaining) {
        parts.push(
            <p key={key++} className="text-sm text-zinc-800 whitespace-pre-wrap leading-relaxed">
                {remaining}
            </p>
        );
    }

    if (parts.length === 0) {
        parts.push(
            <p key={0} className="text-sm text-zinc-400 italic">{t('feedback.content.empty')}</p>
        );
    }

    return <div className="space-y-3 mb-3">{parts}</div>;
}

// ── 工具函数 ──

function formatTime(iso: string, t: TFunction<'admin'>): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return t('feedback.time.justNow');
    if (diffMin < 60) return t('feedback.time.minutesAgo', { count: diffMin });
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return t('feedback.time.hoursAgo', { count: diffHour });
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) return t('feedback.time.daysAgo', { count: diffDay });
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
