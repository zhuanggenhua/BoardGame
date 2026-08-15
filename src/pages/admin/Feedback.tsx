import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import {
    AlertTriangle,
    Check,
    CheckCircle,
    ChevronLeft,
    ChevronRight,
    Circle,
    Contact,
    Copy,
    Gamepad2,
    HelpCircle,
    Image as ImageIcon,
    Lightbulb,
    RefreshCw,
    ScrollText,
    Trash2,
    User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ImageLightbox from '../../components/common/ImageLightbox';
import { RewardPointsBadge } from '../../components/common/labels/RewardPointsBadge';
import {
    CopyFeedbackButton,
    extractText,
    FeedbackContent,
    formatAbsoluteTime,
    formatTime,
    hasEmbeddedImage,
} from './components/FeedbackHelpers';
import { ADMIN_API_URL } from '../../config/server';
import type {
    FeedbackClientContext,
    FeedbackElementSummary,
    FeedbackErrorContext,
} from '../../lib/feedback/feedbackPayload';
import { cn } from '../../lib/utils';

interface FeedbackItem {
    _id: string;
    userId?: {
        _id: string;
        username: string;
        avatar?: string;
    };
    content?: string;
    contentPreview?: string;
    type: 'bug' | 'suggestion' | 'other';
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    closedReason?: string | null;
    resolvedMethod?: string | null;
    rewardPoints?: number;
    reporterType?: 'user' | 'system';
    source?: string;
    autoReportKind?: string;
    incidentKey?: string;
    latestIncidentKey?: string;
    occurrenceCount?: number;
    firstOccurredAt?: string;
    lastOccurredAt?: string;
    gameName?: string;
    contactInfo?: string;
    actionLog?: string;
    stateSnapshot?: string;
    hasEmbeddedImage?: boolean;
    hasActionLog?: boolean;
    hasStateSnapshot?: boolean;
    hasClientContext?: boolean;
    hasErrorContext?: boolean;
    clientContext?: FeedbackClientContext;
    errorContext?: FeedbackErrorContext;
    createdAt: string;
    canManage?: boolean;
}

function summarizeFeedbackElement(element?: FeedbackElementSummary): string {
    if (!element) return '-';
    const base = [
        element.tagName || '',
        element.type ? `[type=${element.type}]` : '',
        element.testId ? `[testid=${element.testId}]` : '',
        element.id ? `#${element.id}` : '',
    ].filter(Boolean).join('');
    return element.text ? `${base || '-'} ${element.text}` : (base || '-');
}

type StatusOption = { value: FeedbackItem['status']; color: string };
type StatusOptionWithLabel = StatusOption & { label: string };
type IconComponent = ComponentType<{ size?: number; className?: string }>;
type TypeOption = { value: FeedbackItem['type']; icon: IconComponent; iconColor: string };
type TypeOptionWithLabel = TypeOption & { label: string };
type ReporterTypeOption = { value: 'user' | 'system'; tone: string };
type ReporterTypeOptionWithLabel = ReporterTypeOption & { label: string };
type SourceOptionValue =
    | 'feedback-modal'
    | 'online-ai-watchdog'
    | 'client-auto-report'
    | 'client-runtime-guard'
    | 'client-window-error'
    | 'client-unhandled-rejection'
    | 'react-error-boundary'
    | 'board-render-error'
    | 'home-modal-error-boundary'
    | 'global-error-capture'
    | 'system-unsatisfiable-interaction'
    | 'unknown';
type SourceOption = { value: SourceOptionValue; label: string };
type SeverityConfig = Record<FeedbackItem['severity'], { label: string; dot: string; tone: string }>;

const SOURCE_OPTIONS: Array<{ value: SourceOptionValue; labelKey: string }> = [
    { value: 'feedback-modal', labelKey: 'feedback.source.feedbackModal' },
    { value: 'online-ai-watchdog', labelKey: 'feedback.source.onlineAiWatchdog' },
    { value: 'client-auto-report', labelKey: 'feedback.source.clientAutoReport' },
    { value: 'client-runtime-guard', labelKey: 'feedback.source.clientRuntimeGuard' },
    { value: 'client-window-error', labelKey: 'feedback.source.clientWindowError' },
    { value: 'client-unhandled-rejection', labelKey: 'feedback.source.clientUnhandledRejection' },
    { value: 'react-error-boundary', labelKey: 'feedback.source.reactErrorBoundary' },
    { value: 'board-render-error', labelKey: 'feedback.source.boardRenderError' },
    { value: 'home-modal-error-boundary', labelKey: 'feedback.source.homeModalErrorBoundary' },
    { value: 'global-error-capture', labelKey: 'feedback.source.globalErrorCapture' },
    { value: 'system-unsatisfiable-interaction', labelKey: 'feedback.source.unsatAutoSkip' },
    { value: 'unknown', labelKey: 'feedback.source.unknown' },
];

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

const REPORTER_TYPE_OPTIONS: ReporterTypeOption[] = [
    { value: 'user', tone: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
    { value: 'system', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
];

const SEVERITY_STYLES: Record<FeedbackItem['severity'], { dot: string; tone: string }> = {
    critical: { dot: 'bg-red-500', tone: 'bg-red-50 text-red-700' },
    high: { dot: 'bg-orange-500', tone: 'bg-orange-50 text-orange-700' },
    medium: { dot: 'bg-yellow-500', tone: 'bg-yellow-50 text-yellow-700' },
    low: { dot: 'bg-green-500', tone: 'bg-green-50 text-green-700' },
};

const POLL_INTERVAL = 30_000;
const PAGE_LIMIT = 20;

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

const buildReporterTypeOptions = (t: TFunction<'admin'>): ReporterTypeOptionWithLabel[] => (
    REPORTER_TYPE_OPTIONS.map((option) => ({
        ...option,
        label: t(`feedback.reporterType.${option.value}`),
    }))
);

const buildSourceOptions = (t: TFunction<'admin'>): SourceOption[] => (
    SOURCE_OPTIONS.map((option) => ({
        value: option.value,
        label: t(option.labelKey),
    }))
);

const buildSeverityConfig = (t: TFunction<'admin'>): SeverityConfig => ({
    critical: { label: t('feedback.severity.critical'), ...SEVERITY_STYLES.critical },
    high: { label: t('feedback.severity.high'), ...SEVERITY_STYLES.high },
    medium: { label: t('feedback.severity.medium'), ...SEVERITY_STYLES.medium },
    low: { label: t('feedback.severity.low'), ...SEVERITY_STYLES.low },
});

const isLegacyWatchdogFeedback = (item: FeedbackItem): boolean => (
    item.contactInfo === 'system:online-ai-watchdog'
    || item.errorContext?.source === 'online-ai-watchdog'
    || /^\[system\]\[online-ai-watchdog\]\s+/.test(item.content ?? item.contentPreview ?? '')
);

const resolveOriginInfo = (item: FeedbackItem): {
    reporterType: 'user' | 'system';
    source: string;
} => {
    if (item.reporterType) {
        return {
            reporterType: item.reporterType,
            source: item.source ?? (item.reporterType === 'system' ? 'unknown' : 'feedback-modal'),
        };
    }
    if (isLegacyWatchdogFeedback(item)) {
        return {
            reporterType: 'system',
            source: 'online-ai-watchdog',
        };
    }
    return {
        reporterType: 'user',
        source: item.source ?? 'feedback-modal',
    };
};

const requiresClosedReason = (item: FeedbackItem): boolean => {
    return resolveOriginInfo(item).reporterType !== 'system';
};

const resolveSourceLabel = (t: TFunction<'admin'>, source: string): string => {
    const option = SOURCE_OPTIONS.find((item) => item.value === source);
    return option ? t(option.labelKey) : t('feedback.source.unknown');
};

const resolveFeedbackPreviewText = (item: FeedbackItem, t: TFunction<'admin'>): string => {
    const preview = item.contentPreview?.trim();
    if (preview) return preview;
    if (item.content) return extractText(item.content, t);
    return item.hasEmbeddedImage ? t('feedback.content.onlyImage') : t('feedback.content.empty');
};

const resolveFeedbackHasImage = (item: FeedbackItem): boolean => (
    item.hasEmbeddedImage ?? (item.content ? hasEmbeddedImage(item.content) : false)
);

const hasFullFeedbackDetail = (item: FeedbackItem | null | undefined): item is FeedbackItem & { content: string } => (
    typeof item?.content === 'string'
);

function StatusSelect({
    value,
    onChange,
    options,
    disabled = false,
}: {
    value: string;
    onChange: (v: string) => void;
    options: StatusOptionWithLabel[];
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = options.find((option) => option.value === value) ?? options[0];

    useEffect(() => {
        if (!open || disabled) return;
        const handler = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [disabled, open]);

    useEffect(() => {
        if (!disabled) return;
        const handle = window.setTimeout(() => setOpen(false), 0);
        return () => window.clearTimeout(handle);
    }, [disabled]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    if (disabled) return;
                    setOpen((prev) => !prev);
                }}
                disabled={disabled}
                className={cn(
                    'inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium shadow-sm transition-colors',
                    current.color,
                    disabled && 'cursor-not-allowed opacity-50'
                )}
            >
                {current.label}
            </button>
            {open && !disabled && (
                <div className="absolute right-0 z-50 mt-1 min-w-[120px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange(option.value);
                                setOpen(false);
                            }}
                            className={cn(
                                'w-full px-2 py-1.5 text-left text-[10px] transition-colors hover:bg-zinc-50',
                                option.value === value ? 'font-semibold text-zinc-900' : 'text-zinc-600'
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function FilterTab({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex h-5 items-center rounded-md px-2 text-[10px] font-medium transition-colors',
                active
                    ? 'bg-zinc-900 text-white shadow-sm'
                    : 'border border-transparent text-zinc-500 hover:border-zinc-200 hover:bg-zinc-50 hover:text-zinc-700'
            )}
        >
            {children}
        </button>
    );
}

function MetaBadge({ children, tone = 'bg-zinc-100 text-zinc-600' }: { children: ReactNode; tone?: string }) {
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium', tone)}>
            {children}
        </span>
    );
}

export default function AdminFeedbackPage() {
    const { token, user } = useAuth();
    const { success, error } = useToast();
    const { t } = useTranslation('admin');

    const statusOptions = useMemo(() => buildStatusOptions(t), [t]);
    const typeOptions = useMemo(() => buildTypeOptions(t), [t]);
    const reporterTypeOptions = useMemo(() => buildReporterTypeOptions(t), [t]);
    const sourceOptions = useMemo(() => buildSourceOptions(t), [t]);
    const severityConfig = useMemo(() => buildSeverityConfig(t), [t]);
    const severityOptions = useMemo(() => (
        (['critical', 'high', 'medium', 'low'] as const).map((value) => ({
            value,
            label: severityConfig[value].label,
        }))
    ), [severityConfig]);
    const sortOptions = useMemo(() => (
        [
            { value: 'newest', label: t('feedback.filters.newest') },
            { value: 'oldest', label: t('feedback.filters.oldest') },
        ]
    ), [t]);

    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('open');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [severityFilter, setSeverityFilter] = useState<string>('all');
    const [reporterTypeFilter, setReporterTypeFilter] = useState<string>('user');
    const [sourceFilter, setSourceFilter] = useState<string>('all');
    const [sortFilter, setSortFilter] = useState<string>('newest');
    const [preferMineFilter, setPreferMineFilter] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isPolling, setIsPolling] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [aiPayloadPreview, setAiPayloadPreview] = useState<string | null>(null);
    const [feedbackDetails, setFeedbackDetails] = useState<Record<string, FeedbackItem>>({});
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null);
    const [detailErrorMessage, setDetailErrorMessage] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(PAGE_LIMIT);

    const requestIdRef = useRef(0);
    const detailRequestIdRef = useRef(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchFeedbacks = useCallback(async (silent = false) => {
        const requestId = ++requestIdRef.current;
        if (!silent) setLoading(true);
        if (silent) setIsPolling(true);
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_LIMIT),
                page: String(page),
            });
            if (statusFilter !== 'all') params.set('status', statusFilter);
            if (typeFilter !== 'all') params.set('type', typeFilter);
            if (severityFilter !== 'all') params.set('severity', severityFilter);
            if (reporterTypeFilter !== 'all') params.set('reporterType', reporterTypeFilter);
            if (sourceFilter !== 'all') params.set('source', sourceFilter);
            if (sortFilter) params.set('sort', sortFilter);
            if (preferMineFilter) params.set('preferMine', 'true');
            params.set('summaryOnly', 'true');

            const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
            const response = await fetch(`${ADMIN_API_URL}/feedback?${params}`, {
                headers,
            });
            if (!response.ok) throw new Error('fetch_failed');

            const data = await response.json();
            if (isMountedRef.current && requestId === requestIdRef.current) {
                setFeedbacks(data.items);
                setTotal(Math.max(0, Number(data.total) || 0));
                setLimit(Math.max(1, Number(data.limit) || PAGE_LIMIT));
                setPage(Math.max(1, Number(data.page) || 1));
            }
        } catch {
            if (!silent) error(t('feedback.messages.fetchFailed'));
        } finally {
            if (isMountedRef.current && requestId === requestIdRef.current) {
                setLoading(false);
                setIsPolling(false);
            }
        }
    }, [error, page, preferMineFilter, reporterTypeFilter, severityFilter, sortFilter, sourceFilter, statusFilter, t, token, typeFilter]);

    useEffect(() => {
        fetchFeedbacks();
    }, [fetchFeedbacks]);

    useEffect(() => {
        setPage(1);
    }, [statusFilter, typeFilter, severityFilter, reporterTypeFilter, sourceFilter, sortFilter, preferMineFilter]);

    useEffect(() => {
        if (reporterTypeFilter !== 'system' && sourceFilter !== 'all') {
            setSourceFilter('all');
        }
    }, [reporterTypeFilter, sourceFilter]);

    useEffect(() => {
        const timer = setInterval(() => {
            fetchFeedbacks(true);
        }, POLL_INTERVAL);
        return () => clearInterval(timer);
    }, [fetchFeedbacks]);

    useEffect(() => {
        setSelectedIds((prev) => {
            const next = new Set<string>();
            prev.forEach((id) => {
                if (feedbacks.some((feedback) => feedback._id === id && feedback.canManage)) {
                    next.add(id);
                }
            });
            return next.size === prev.size ? prev : next;
        });
    }, [feedbacks]);

    useEffect(() => {
        setActiveId((prev) => {
            if (!prev) return null;
            return feedbacks.some((feedback) => feedback._id === prev) ? prev : null;
        });
    }, [feedbacks]);

    useEffect(() => {
        const maxPage = Math.max(1, Math.ceil(total / limit));
        if (page > maxPage) {
            setPage(maxPage);
        }
    }, [limit, page, total]);

    const activeFeedbackSummary = useMemo(
        () => feedbacks.find((feedback) => feedback._id === activeId) ?? null,
        [activeId, feedbacks],
    );
    const activeFeedback = useMemo(
        () => (activeId ? feedbackDetails[activeId] ?? activeFeedbackSummary : null),
        [activeFeedbackSummary, activeId, feedbackDetails],
    );

    useEffect(() => {
        if (!activeFeedbackSummary) {
            setActiveId(null);
        }
    }, [activeFeedbackSummary]);

    useEffect(() => {
        if (!activeId) return;
        const summary = feedbacks.find((feedback) => feedback._id === activeId);
        const cached = feedbackDetails[activeId];
        if (!summary || hasFullFeedbackDetail(cached) || hasFullFeedbackDetail(summary)) {
            return;
        }

        const requestId = ++detailRequestIdRef.current;
        setDetailLoadingId(activeId);
        setDetailErrorMessage('');

        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        fetch(`${ADMIN_API_URL}/feedback/${activeId}`, { headers })
            .then(async (response) => {
                if (!response.ok) {
                    throw new Error(t('feedback.messages.fetchFailed'));
                }
                return response.json() as Promise<FeedbackItem>;
            })
            .then((detail) => {
                if (!isMountedRef.current || detailRequestIdRef.current !== requestId) {
                    return;
                }
                setFeedbackDetails((prev) => ({
                    ...prev,
                    [activeId]: detail,
                }));
            })
            .catch((err) => {
                if (!isMountedRef.current || detailRequestIdRef.current !== requestId) {
                    return;
                }
                setDetailErrorMessage(err instanceof Error ? err.message : t('feedback.messages.fetchFailed'));
            })
            .finally(() => {
                if (isMountedRef.current && detailRequestIdRef.current === requestId) {
                    setDetailLoadingId(null);
                }
            });
    }, [activeId, feedbackDetails, feedbacks, t, token]);

    const manageableFeedbacks = useMemo(
        () => feedbacks.filter((feedback) => feedback.canManage),
        [feedbacks],
    );
    const allSelected = manageableFeedbacks.length > 0 && manageableFeedbacks.every((feedback) => selectedIds.has(feedback._id));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const pageStart = total === 0 ? 0 : (page - 1) * limit + 1;
    const pageEnd = total === 0 ? 0 : Math.min(total, (page - 1) * limit + feedbacks.length);

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedIds(new Set());
            return;
        }
        setSelectedIds(new Set(manageableFeedbacks.map((feedback) => feedback._id)));
    };

    const toggleSelect = (id: string) => {
        const target = feedbacks.find((feedback) => feedback._id === id);
        if (!target?.canManage) return;
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleStatusUpdate = useCallback(async (id: string, newStatus: string) => {
        const target = feedbacks.find((feedback) => feedback._id === id);
        if (!target?.canManage) {
            error('你没有权限修改该反馈');
            return;
        }

        let closedReason: string | undefined;
        let resolvedMethod: string | undefined;
        if (newStatus === 'closed' && requiresClosedReason(target)) {
            const promptValue = window.prompt(t('feedback.messages.closedReasonPrompt'), target.closedReason ?? '');
            if (promptValue === null) {
                return;
            }
            closedReason = promptValue.trim();
            if (!closedReason) {
                error(t('feedback.messages.closedReasonRequired'));
                return;
            }
        }
        if (newStatus === 'resolved' && target.status !== 'resolved') {
            const promptValue = window.prompt(t('feedback.messages.resolvedMethodPrompt'), target.resolvedMethod ?? '');
            if (promptValue === null) {
                return;
            }
            resolvedMethod = promptValue.trim();
            if (!resolvedMethod) {
                error(t('feedback.messages.resolvedMethodRequired'));
                return;
            }
        }
        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback/${id}/status`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    status: newStatus,
                    ...(closedReason ? { closedReason } : {}),
                    ...(resolvedMethod ? { resolvedMethod } : {}),
                }),
            });
            if (!response.ok) {
                const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
                throw new Error(
                    payload?.error
                    || payload?.message
                    || t('feedback.messages.updateFailed')
                );
            }
            const updated = await response.json() as FeedbackItem;

            setFeedbacks((prev) => prev
                .map((feedback) => (
                    feedback._id === id ? { ...feedback, ...updated } : feedback
                ))
                .filter((feedback) => statusFilter === 'all' || feedback.status === statusFilter));
            setFeedbackDetails((prev) => (
                prev[id] ? { ...prev, [id]: { ...prev[id], ...updated } } : prev
            ));
            success(t('feedback.messages.updateSuccess'));
        } catch (err) {
            error(err instanceof Error ? err.message : t('feedback.messages.updateFailed'));
        }
    }, [error, feedbacks, statusFilter, success, t, token]);

    const handleDelete = async (id: string) => {
        const target = feedbacks.find((feedback) => feedback._id === id);
        if (!target?.canManage) {
            error('你没有权限删除该反馈');
            return;
        }
        if (!confirm(t('feedback.confirm.delete'))) return;

        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) throw new Error('delete_failed');

            setFeedbacks((prev) => prev.filter((feedback) => feedback._id !== id));
            setFeedbackDetails((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
            });
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            success(t('feedback.messages.deleteSuccess'));
        } catch {
            error(t('feedback.messages.deleteFailed'));
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(t('feedback.confirm.bulkDelete', { count: selectedIds.size }))) return;

        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback/bulk-delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ ids: Array.from(selectedIds) }),
            });
            if (!response.ok) throw new Error('bulk_delete_failed');

            success(t('feedback.messages.bulkDeleteSuccess'));
            setSelectedIds(new Set());
            fetchFeedbacks();
        } catch {
            error(t('feedback.messages.bulkDeleteFailed'));
        }
    };

    const changeFilter = (setter: (value: string) => void, value: string) => {
        setter(value);
        setSelectedIds(new Set());
        setActiveId(null);
    };

    return (
        <div className="mx-auto flex h-full min-h-0 w-full max-w-[1880px] flex-col gap-1 px-2 py-1">
            <div
                className="flex flex-none flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 shadow-sm"
                data-testid="feedback-list-controls"
            >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <h1 className="text-sm font-semibold text-zinc-900">{t('feedback.title')}</h1>
                    <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600">
                        {t('feedback.count', { count: total })}
                    </span>
                    {selectedIds.size > 0 && (
                        <span className="rounded-md bg-zinc-900 px-2 py-0.5 text-[10px] font-medium text-white">
                            {t('feedback.bulkDelete', { count: selectedIds.size })}
                        </span>
                    )}
                    {isPolling && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                            <RefreshCw size={10} className="animate-spin" />
                            {t('feedback.polling')}
                        </span>
                    )}
                    <span className="rounded-md bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-500">
                        {pageStart}-{pageEnd} / {total}
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-1">
                        <button
                            type="button"
                            onClick={() => fetchFeedbacks()}
                            title={t('feedback.refresh')}
                            className="inline-flex h-5 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[10px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                        >
                            <RefreshCw size={11} className={cn(isPolling && 'animate-spin')} />
                            {t('feedback.refresh')}
                        </button>
                        {selectedIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                className="inline-flex h-5 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-[10px] font-medium text-red-600 transition-colors hover:bg-red-100"
                            >
                                <Trash2 size={11} />
                                {t('feedback.bulkDelete', { count: selectedIds.size })}
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            {t('feedback.filters.status')}
                        </span>
                        {[{ value: 'all', label: t('feedback.filters.all') }, ...statusOptions].map((option) => (
                            <FilterTab
                                key={option.value}
                                active={statusFilter === option.value}
                                onClick={() => changeFilter(setStatusFilter, option.value)}
                            >
                                {option.label}
                            </FilterTab>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            {t('feedback.filters.type')}
                        </span>
                        <FilterTab active={typeFilter === 'all'} onClick={() => changeFilter(setTypeFilter, 'all')}>
                            {t('feedback.filters.all')}
                        </FilterTab>
                        {typeOptions.map((option) => {
                            const Icon = option.icon;
                            return (
                                <FilterTab
                                    key={option.value}
                                    active={typeFilter === option.value}
                                    onClick={() => changeFilter(setTypeFilter, option.value)}
                                >
                                    <span className="flex items-center gap-1">
                                        <Icon size={10} className={option.iconColor} />
                                        {option.label}
                                    </span>
                                </FilterTab>
                            );
                        })}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            {t('feedback.filters.severity')}
                        </span>
                        <FilterTab active={severityFilter === 'all'} onClick={() => changeFilter(setSeverityFilter, 'all')}>
                            {t('feedback.filters.all')}
                        </FilterTab>
                        {severityOptions.map((option) => (
                            <FilterTab
                                key={option.value}
                                active={severityFilter === option.value}
                                onClick={() => changeFilter(setSeverityFilter, option.value)}
                            >
                                {option.label}
                            </FilterTab>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            {t('feedback.filters.reporterType')}
                        </span>
                        <FilterTab
                            active={reporterTypeFilter === 'all'}
                            onClick={() => changeFilter(setReporterTypeFilter, 'all')}
                        >
                            {t('feedback.filters.all')}
                        </FilterTab>
                        {reporterTypeOptions.map((option) => (
                            <FilterTab
                                key={option.value}
                                active={reporterTypeFilter === option.value}
                                onClick={() => changeFilter(setReporterTypeFilter, option.value)}
                            >
                                {option.label}
                            </FilterTab>
                        ))}
                    </div>

                    {reporterTypeFilter === 'system' && (
                        <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                {t('feedback.filters.source')}
                            </span>
                            <FilterTab active={sourceFilter === 'all'} onClick={() => changeFilter(setSourceFilter, 'all')}>
                                {t('feedback.filters.all')}
                            </FilterTab>
                            {sourceOptions.map((option) => (
                                <FilterTab
                                    key={option.value}
                                    active={sourceFilter === option.value}
                                    onClick={() => changeFilter(setSourceFilter, option.value)}
                                >
                                    {option.label}
                                </FilterTab>
                            ))}
                        </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1">
                        <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            {t('feedback.filters.sort')}
                        </span>
                        {sortOptions.map((option) => (
                            <FilterTab
                                key={option.value}
                                active={sortFilter === option.value}
                                onClick={() => changeFilter(setSortFilter, option.value)}
                            >
                                {option.label}
                            </FilterTab>
                        ))}
                    </div>

                    {user && (
                        <div className="flex flex-wrap items-center gap-1">
                            <span className="mr-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                {t('feedback.filters.priority')}
                            </span>
                            <FilterTab
                                active={preferMineFilter}
                                onClick={() => setPreferMineFilter((prev) => !prev)}
                            >
                                {t('feedback.filters.preferMine')}
                            </FilterTab>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid min-h-0 gap-1.5 xl:grid-cols-[minmax(0,1fr)_312px] 2xl:grid-cols-[minmax(0,1fr)_330px]">
                <section className="flex min-h-0 max-h-[calc(100vh-260px)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
                    {loading ? (
                        <div className="flex flex-1 items-center justify-center py-20">
                            <RefreshCw className="animate-spin text-zinc-300" size={24} />
                        </div>
                    ) : feedbacks.length === 0 ? (
                        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-zinc-400">
                            {t('feedback.table.empty')}
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-auto" data-testid="feedback-list-scroll">
                            <table className="w-full table-fixed text-[11px]">
                                <thead className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur">
                                    <tr className="text-left text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                                        <th className="w-8 px-2 py-1">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={toggleSelectAll}
                                                disabled={manageableFeedbacks.length === 0}
                                                className="rounded border-zinc-300"
                                                aria-label={t('feedback.table.selectAll')}
                                            />
                                        </th>
                                        <th className="px-2.5 py-1">{t('feedback.table.content')}</th>
                                        <th className="w-[112px] px-2 py-1">{t('feedback.table.submitter')}</th>
                                        <th className="w-[112px] px-2 py-1">{t('feedback.table.origin')}</th>
                                        <th className="w-[128px] px-2 py-1">{t('feedback.detail.game')}</th>
                                        <th className="w-[72px] px-2 py-1">{t('feedback.table.severity')}</th>
                                        <th className="w-[88px] px-2 py-1">{t('feedback.table.status')}</th>
                                        <th className="w-[82px] px-2 py-1">{t('feedback.table.time')}</th>
                                        <th className="w-[52px] px-2 py-1 text-right" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {feedbacks.map((item) => {
                                        const typeOpt = typeOptions.find((option) => option.value === item.type);
                                        const TypeIcon = typeOpt?.icon ?? HelpCircle;
                                        const sevCfg = severityConfig[item.severity] ?? severityConfig.low;

                                        return (
                                            <FeedbackRow
                                                key={item._id}
                                                item={item}
                                                active={activeId === item._id}
                                                selected={selectedIds.has(item._id)}
                                                TypeIcon={TypeIcon}
                                                typeOpt={typeOpt}
                                                sevCfg={sevCfg}
                                                statusOptions={statusOptions}
                                                t={t}
                                                onActivate={() => setActiveId(item._id)}
                                                onToggleSelect={() => toggleSelect(item._id)}
                                                onStatusUpdate={handleStatusUpdate}
                                                onDelete={handleDelete}
                                            />
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
                <FeedbackDetailPanel
                    key={activeFeedback?._id ?? 'empty'}
                    item={activeFeedback}
                    typeOptions={typeOptions}
                    severityConfig={severityConfig}
                    statusOptions={statusOptions}
                    t={t}
                    loading={Boolean(activeId && detailLoadingId === activeId && !hasFullFeedbackDetail(activeFeedback))}
                    errorMessage={detailErrorMessage}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={handleDelete}
                    onAiPayloadCopy={setAiPayloadPreview}
                    onImageClick={setPreviewImage}
                />
            </div>

            <div className="flex flex-none items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-sm">
                <div className="text-[11px] text-zinc-500" data-testid="feedback-pagination-indicator">
                    {page} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        data-testid="feedback-pagination-prev"
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        disabled={page <= 1 || loading}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <ChevronLeft size={14} />
                        {t('feedback.pagination.prev')}
                    </button>
                    <button
                        type="button"
                        data-testid="feedback-pagination-next"
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page >= totalPages || loading}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[11px] font-medium text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {t('feedback.pagination.next')}
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>

            {aiPayloadPreview && (
                <textarea
                    readOnly
                    wrap="off"
                    value={aiPayloadPreview}
                    data-testid="feedback-ai-payload-viewer"
                    className="min-h-[220px] w-full rounded-lg border border-zinc-200 bg-zinc-950 p-3 font-mono text-[11px] leading-5 text-emerald-200 shadow-sm"
                />
            )}

            <ImageLightbox src={previewImage} onClose={() => setPreviewImage(null)} />
        </div>
    );
}

interface FeedbackRowProps {
    item: FeedbackItem;
    active: boolean;
    selected: boolean;
    TypeIcon: IconComponent;
    typeOpt: TypeOptionWithLabel | undefined;
    sevCfg: SeverityConfig[FeedbackItem['severity']];
    statusOptions: StatusOptionWithLabel[];
    t: TFunction<'admin'>;
    onActivate: () => void;
    onToggleSelect: () => void;
    onStatusUpdate: (id: string, status: string) => void;
    onDelete: (id: string) => void;
}

function FeedbackRow({
    item,
    active,
    selected,
    TypeIcon,
    typeOpt,
    sevCfg,
    statusOptions,
    t,
    onActivate,
    onToggleSelect,
    onStatusUpdate,
    onDelete,
}: FeedbackRowProps) {
    const previewText = resolveFeedbackPreviewText(item, t);
    const submitter = item.userId?.username || t('feedback.anonymous');
    const hasImage = resolveFeedbackHasImage(item);
    const hasActionLog = item.hasActionLog ?? Boolean(item.actionLog);
    const hasSnapshot = item.hasStateSnapshot ?? Boolean(item.stateSnapshot);
    const origin = resolveOriginInfo(item);
    const reporterLabel = t(`feedback.reporterType.${origin.reporterType}`);
    const sourceLabel = resolveSourceLabel(t, origin.source);
    const reporterTone = REPORTER_TYPE_OPTIONS.find((option) => option.value === origin.reporterType)?.tone
        ?? 'bg-zinc-100 text-zinc-600 border-zinc-200';

    return (
        <tr
            data-testid="feedback-row"
            data-feedback-id={item._id}
            onClick={onActivate}
            className={cn(
                'group cursor-pointer border-b border-zinc-100 transition-colors',
                active ? 'bg-zinc-100' : 'hover:bg-zinc-50/90',
                selected && 'bg-amber-50/70',
                active && selected && 'bg-amber-50'
            )}
        >
            <td className="px-2 py-1 align-middle" onClick={(event) => event.stopPropagation()}>
                <input
                    type="checkbox"
                    checked={selected}
                    onChange={onToggleSelect}
                    disabled={!item.canManage}
                    className="rounded border-zinc-300"
                    aria-label={t('feedback.table.selectItem', { id: item._id })}
                />
            </td>

            <td className="px-2.5 py-1.5">
                <div className="flex min-w-0 items-start gap-2">
                    <div className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded bg-zinc-100">
                        <TypeIcon size={11} className={typeOpt?.iconColor ?? 'text-zinc-400'} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p
                            className={cn(
                                'truncate text-[11px] leading-4',
                                active ? 'font-semibold text-zinc-900' : 'text-zinc-800'
                            )}
                            title={previewText}
                        >
                            {previewText}
                        </p>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[9px] leading-4 text-zinc-400">
                            <span className="truncate">{typeOpt?.label ?? item.type}</span>
                            {hasImage && <ImageIcon size={10} title={t('feedback.content.screenshotAlt')} />}
                            {hasActionLog && <ScrollText size={10} title={t('feedback.actionLog.title')} />}
                            {hasSnapshot && <span title={t('feedback.stateSnapshot.title')}>JSON</span>}
                        </div>
                        {active && item.clientContext?.route && (
                            <div className="mt-1 text-[10px] leading-4 text-zinc-500">
                                {item.clientContext.route}
                            </div>
                        )}
                        {active && (
                            item.clientContext?.appVersion
                            || item.clientContext?.appCommitSha
                            || item.clientContext?.appBuildTime
                        ) && (
                            <div className="text-[10px] leading-4 text-zinc-500">
                                {[
                                    item.clientContext?.appVersion ? `版本 ${item.clientContext.appVersion}` : null,
                                    item.clientContext?.appCommitSha ? `提交 ${item.clientContext.appCommitSha}` : null,
                                    item.clientContext?.appBuildTime ? `构建 ${item.clientContext.appBuildTime}` : null,
                                ].filter(Boolean).join(' | ')}
                            </div>
                        )}
                        {active && item.errorContext && (
                            <div
                                data-testid="feedback-error-context-panel"
                                className="mt-1 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-[10px] leading-4 text-red-700"
                            >
                                <div className="font-semibold">{item.errorContext.name || '-'}</div>
                                <div>{item.errorContext.message || '-'}</div>
                                <div className="text-red-500">{item.errorContext.source || '-'}</div>
                                {item.clientContext?.lastUserAction && (
                                    <div className="text-red-500">
                                        {t('feedback.detail.recentAction')}: {item.clientContext.lastUserAction.type} / {summarizeFeedbackElement(item.clientContext.lastUserAction.target)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </td>

            <td className="px-2 py-1.5 align-middle">
                <p className="truncate text-[10px] leading-4 text-zinc-600" title={submitter}>
                    <span className={cn('font-medium', active ? 'text-zinc-900' : 'text-zinc-700')}>{submitter}</span>
                    <span className="text-zinc-400"> / {item._id.slice(-6)}</span>
                </p>
            </td>

            <td className="px-2 py-1.5 align-middle">
                <div className="flex flex-wrap items-center gap-1">
                    <MetaBadge tone={reporterTone}>
                        {reporterLabel}
                    </MetaBadge>
                    {origin.reporterType === 'system' && (
                        <MetaBadge>
                            {sourceLabel}
                        </MetaBadge>
                    )}
                </div>
            </td>

            <td className="px-2 py-1.5 align-middle">
                <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-[10px] leading-4 text-zinc-500">
                    <Gamepad2 size={10} className="shrink-0 text-zinc-400" />
                    <span className="truncate">{item.gameName || '-'}</span>
                </span>
            </td>

            <td className="px-2 py-1.5 align-middle">
                <span className={cn('inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium', sevCfg.tone)}>
                    {sevCfg.label}
                </span>
            </td>

            <td className="px-2 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                <StatusSelect
                    value={item.status}
                    onChange={(value) => onStatusUpdate(item._id, value)}
                    options={statusOptions}
                    disabled={!item.canManage}
                />
            </td>

            <td className="px-2 py-1.5 align-middle">
                <span
                    className="block tabular-nums text-[10px] leading-4 text-zinc-500"
                    title={formatAbsoluteTime(item.createdAt)}
                >
                    {formatTime(item.createdAt, t)}
                </span>
            </td>

            <td className="px-2 py-1.5 align-middle" onClick={(event) => event.stopPropagation()}>
                <div
                    className={cn(
                        'flex items-center justify-end gap-0.5 transition-opacity xl:opacity-0 xl:group-hover:opacity-100 xl:group-focus-within:opacity-100',
                        active && 'xl:opacity-100'
                    )}
                >
                    <button
                        type="button"
                        onClick={() => onStatusUpdate(item._id, item.status === 'resolved' ? 'open' : 'resolved')}
                        disabled={!item.canManage}
                        className={cn(
                            'rounded p-1 transition-colors',
                            item.canManage ? 'hover:bg-zinc-100' : 'cursor-not-allowed opacity-40',
                        )}
                        title={item.status === 'resolved' ? t('feedback.actions.reopen') : t('feedback.actions.resolve')}
                    >
                        {item.status === 'resolved'
                            ? <Circle size={13} className="text-zinc-400" />
                            : <CheckCircle size={13} className="text-emerald-500" />}
                    </button>
                    <button
                        type="button"
                        onClick={() => onDelete(item._id)}
                        disabled={!item.canManage}
                        className={cn(
                            'rounded p-1 transition-colors',
                            item.canManage ? 'hover:bg-red-50' : 'cursor-not-allowed opacity-40',
                        )}
                        title={t('feedback.actions.delete')}
                    >
                        <Trash2 size={13} className="text-zinc-300 hover:text-red-500" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

function FeedbackDetailPanel({
    item,
    typeOptions,
    severityConfig,
    statusOptions,
    t,
    loading,
    errorMessage,
    onStatusUpdate,
    onDelete,
    onAiPayloadCopy,
    onImageClick,
}: {
    item: FeedbackItem | null;
    typeOptions: TypeOptionWithLabel[];
    severityConfig: SeverityConfig;
    statusOptions: StatusOptionWithLabel[];
    t: TFunction<'admin'>;
    loading: boolean;
    errorMessage: string;
    onStatusUpdate: (id: string, status: string) => void;
    onDelete: (id: string) => void;
    onAiPayloadCopy: (payloadText: string) => void;
    onImageClick: (src: string) => void;
}) {
    const [snapshotCopied, setSnapshotCopied] = useState(false);

    if (!item) {
        return (
            <aside className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-6 text-center shadow-sm">
                <div className="rounded-full bg-zinc-100 p-3 text-zinc-400">
                    <ScrollText size={18} />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-700">{t('feedback.detail.emptyTitle')}</p>
                <p className="mt-2 max-w-xs text-xs leading-5 text-zinc-400">{t('feedback.detail.emptyDescription')}</p>
            </aside>
        );
    }

    const typeOpt = typeOptions.find((option) => option.value === item.type);
    const TypeIcon = typeOpt?.icon ?? HelpCircle;
    const sevCfg = severityConfig[item.severity] ?? severityConfig.low;
    const submitter = item.userId?.username || t('feedback.anonymous');
    const previewText = resolveFeedbackPreviewText(item, t);
    const fullDetailReady = hasFullFeedbackDetail(item);
    const hasImage = resolveFeedbackHasImage(item);
    const hasActionLog = item.hasActionLog ?? Boolean(item.actionLog);
    const hasSnapshot = item.hasStateSnapshot ?? Boolean(item.stateSnapshot);
    const origin = resolveOriginInfo(item);
    const reporterLabel = t(`feedback.reporterType.${origin.reporterType}`);
    const sourceLabel = resolveSourceLabel(t, origin.source);
    const reporterTone = REPORTER_TYPE_OPTIONS.find((option) => option.value === origin.reporterType)?.tone
        ?? 'bg-zinc-100 text-zinc-600 border-zinc-200';

    return (
        <aside className="flex min-h-0 max-h-[calc(100vh-260px)] flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-none flex-col gap-1.5 border-b border-zinc-200 px-3 py-2">
                <div className="flex flex-wrap items-start gap-2">
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-zinc-100">
                        <TypeIcon size={14} className={typeOpt?.iconColor ?? 'text-zinc-400'} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 break-words text-[13px] font-semibold leading-5 text-zinc-900">
                            {previewText}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-zinc-500">
                            <span className="inline-flex items-center gap-1">
                                <User size={10} />
                                <span className="max-w-[104px] truncate">{submitter}</span>
                            </span>
                            <span title={formatAbsoluteTime(item.createdAt)}>{formatTime(item.createdAt, t)}</span>
                            {item.gameName && (
                                <span className="inline-flex items-center gap-1">
                                    <Gamepad2 size={10} />
                                    <span className="max-w-[104px] truncate">{item.gameName}</span>
                                </span>
                            )}
                            <span className="font-mono text-[9px] text-zinc-400">{item._id.slice(-8)}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-1">
                        <StatusSelect
                            value={item.status}
                            onChange={(value) => onStatusUpdate(item._id, value)}
                            options={statusOptions}
                            disabled={!item.canManage}
                        />
                        <button
                            type="button"
                            onClick={() => onStatusUpdate(item._id, item.status === 'resolved' ? 'open' : 'resolved')}
                            disabled={!item.canManage}
                            className={cn(
                                'inline-flex h-5 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[10px] font-medium text-zinc-600 transition-colors',
                                item.canManage ? 'hover:bg-zinc-50' : 'cursor-not-allowed opacity-40',
                            )}
                        >
                            {item.status === 'resolved'
                                ? <Circle size={12} className="text-zinc-400" />
                                : <CheckCircle size={12} className="text-emerald-500" />}
                            {item.status === 'resolved' ? t('feedback.actions.reopen') : t('feedback.actions.resolve')}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(item._id)}
                            disabled={!item.canManage}
                            className={cn(
                                'inline-flex h-5 items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 text-[10px] font-medium text-red-600 transition-colors',
                                item.canManage ? 'hover:bg-red-100' : 'cursor-not-allowed opacity-40',
                            )}
                        >
                            <Trash2 size={12} />
                            {t('feedback.actions.delete')}
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                    <MetaBadge>
                        <TypeIcon size={10} className={typeOpt?.iconColor ?? 'text-zinc-400'} />
                        {typeOpt?.label ?? item.type}
                    </MetaBadge>
                    <MetaBadge tone={sevCfg.tone}>
                        <span className={cn('h-2 w-2 rounded-full', sevCfg.dot)} />
                        {sevCfg.label}
                    </MetaBadge>
                    <MetaBadge tone={reporterTone}>
                        {reporterLabel}
                    </MetaBadge>
                    {origin.reporterType === 'system' && (
                        <MetaBadge>
                            {sourceLabel}
                        </MetaBadge>
                    )}
                    {hasImage && (
                        <MetaBadge>
                            <ImageIcon size={11} />
                            {t('feedback.content.screenshotAlt')}
                        </MetaBadge>
                    )}
                    {hasActionLog && (
                        <MetaBadge>
                            <ScrollText size={11} />
                            {t('feedback.actionLog.title')}
                        </MetaBadge>
                    )}
                    {hasSnapshot && <MetaBadge>JSON</MetaBadge>}
                    {item.rewardPoints ? (
                        <RewardPointsBadge points={item.rewardPoints} signed className="rounded-md px-1.5 py-0.5 text-[10px]" />
                    ) : null}
                    <div className="ml-auto">
                        {fullDetailReady ? (
                            <CopyFeedbackButton item={item} t={t} onAiPayloadCopy={onAiPayloadCopy} />
                        ) : (
                            <span className="inline-flex h-7 items-center rounded-md border border-zinc-200 bg-zinc-50 px-2 text-[10px] text-zinc-400">
                                {t('feedback.detail.copyPending')}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 space-y-2 overflow-y-auto p-2">
                <section className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-2.5">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                        {t('feedback.table.content')}
                    </p>
                    {fullDetailReady ? (
                        <FeedbackContent content={item.content} onImageClick={onImageClick} t={t} />
                    ) : (
                        <div className="space-y-2">
                            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-800">
                                {previewText}
                            </p>
                            {loading ? (
                                <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                                    <RefreshCw size={12} className="animate-spin" />
                                    {t('feedback.detail.loading')}
                                </p>
                            ) : errorMessage ? (
                                <p className="rounded-md border border-red-100 bg-red-50 px-2 py-1.5 text-xs text-red-600">
                                    {errorMessage}
                                </p>
                            ) : (
                                <p className="text-xs text-zinc-400">
                                    {t('feedback.detail.summaryOnly')}
                                </p>
                            )}
                        </div>
                    )}
                </section>

                <section className="rounded-lg border border-zinc-200 bg-white p-2.5">
                    <div className="grid gap-x-3 gap-y-2 text-xs text-zinc-500 sm:grid-cols-2">
                        <MetaField label={t('feedback.table.submitter')}>
                            <div className="flex items-center gap-2">
                                {item.userId ? (
                                    <>
                                        <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-[10px] font-bold text-zinc-500">
                                            {item.userId.avatar
                                                ? <img src={item.userId.avatar} alt="" className="h-full w-full object-cover" />
                                                : item.userId.username?.[0]?.toUpperCase()}
                                        </div>
                                        <span className="text-sm font-medium text-zinc-800">{item.userId.username}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                                            <User size={13} />
                                        </div>
                                        <span className="text-sm italic text-zinc-400">{t('feedback.anonymous')}</span>
                                    </>
                                )}
                            </div>
                        </MetaField>

                        <MetaField label={t('feedback.table.time')}>
                            <div className="space-y-0.5">
                                <p className="text-zinc-700">{formatAbsoluteTime(item.createdAt)}</p>
                                <p className="text-zinc-400">{formatTime(item.createdAt, t)}</p>
                            </div>
                        </MetaField>

                        {item.gameName && (
                            <MetaField label={t('feedback.detail.game')}>
                                <span className="inline-flex items-center gap-1.5 text-zinc-700">
                                    <Gamepad2 size={12} />
                                    {item.gameName}
                                </span>
                            </MetaField>
                        )}

                        {item.contactInfo && (
                            <MetaField label={t('feedback.detail.contact')}>
                                <span className="inline-flex items-center gap-1.5 break-all text-zinc-700">
                                    <Contact size={12} />
                                    {item.contactInfo}
                                </span>
                            </MetaField>
                        )}

                        <MetaField label={t('feedback.detail.origin')}>
                            <div className="space-y-0.5 text-zinc-700">
                                <p>{t('feedback.detail.reporterType')}: {reporterLabel}</p>
                                <p>{t('feedback.detail.source')}: {sourceLabel}</p>
                                {origin.reporterType === 'system' && (
                                    <>
                                        {item.autoReportKind && (
                                            <p>{t('feedback.detail.autoReportKind')}: {item.autoReportKind}</p>
                                        )}
                                        {item.incidentKey && (
                                            <p className="break-all">{t('feedback.detail.incidentKey')}: {item.incidentKey}</p>
                                        )}
                                        {typeof item.occurrenceCount === 'number' && (
                                            <p>{t('feedback.detail.occurrenceCount')}: {item.occurrenceCount}</p>
                                        )}
                                        {item.firstOccurredAt && (
                                            <p>{t('feedback.detail.firstOccurredAt')}: {formatAbsoluteTime(item.firstOccurredAt)}</p>
                                        )}
                                        {item.lastOccurredAt && (
                                            <p>{t('feedback.detail.lastOccurredAt')}: {formatAbsoluteTime(item.lastOccurredAt)}</p>
                                        )}
                                        {item.latestIncidentKey && (
                                            <p className="break-all">{t('feedback.detail.latestIncidentKey')}: {item.latestIncidentKey}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </MetaField>

                        <MetaField label={t('feedback.table.status')}>
                            <span className="text-zinc-700">
                                {statusOptions.find((option) => option.value === item.status)?.label ?? item.status}
                            </span>
                        </MetaField>

                        {item.status === 'closed' ? (
                            <MetaField label={t('feedback.detail.closedReason')}>
                                <span className="text-zinc-700">{item.closedReason?.trim() || t('feedback.detail.closedReasonEmpty')}</span>
                            </MetaField>
                        ) : null}

                        {item.status === 'resolved' ? (
                            <MetaField label={t('feedback.detail.resolvedMethod')}>
                                <span className="text-zinc-700">{item.resolvedMethod?.trim() || t('feedback.detail.resolvedMethodEmpty')}</span>
                            </MetaField>
                        ) : null}

                        {item.rewardPoints ? (
                            <MetaField label={t('feedback.detail.rewardPoints')}>
                                <RewardPointsBadge points={item.rewardPoints} signed className="text-xs" />
                            </MetaField>
                        ) : null}

                        <MetaField label="ID">
                            <span className="rounded-md bg-zinc-50 px-2 py-1 font-mono text-[11px] text-zinc-500">
                                {item._id}
                            </span>
                        </MetaField>
                    </div>
                </section>

                {item.errorContext && (
                    <section
                        data-testid="feedback-error-context-panel"
                        className="rounded-lg border border-red-100 bg-red-50 p-2.5"
                    >
                        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-red-400">
                            {t('feedback.detail.errorContext')}
                        </p>
                        <div className="space-y-1 text-xs text-red-700">
                            <p>{item.errorContext.name || '-'}</p>
                            <p>{item.errorContext.message || '-'}</p>
                            <p>{item.errorContext.source || '-'}</p>
                            {(item.clientContext?.appVersion || item.clientContext?.appCommitSha || item.clientContext?.appBuildTime) && (
                                <p>
                                    {[
                                        item.clientContext?.appVersion ? `版本 ${item.clientContext.appVersion}` : null,
                                        item.clientContext?.appCommitSha ? `提交 ${item.clientContext.appCommitSha}` : null,
                                        item.clientContext?.appBuildTime ? `构建 ${item.clientContext.appBuildTime}` : null,
                                    ].filter(Boolean).join(' | ')}
                                </p>
                            )}
                            {item.clientContext?.lastUserAction && (
                                <p>{t('feedback.detail.recentAction')}: {item.clientContext.lastUserAction.type} / {summarizeFeedbackElement(item.clientContext.lastUserAction.target)}</p>
                            )}
                            {item.clientContext?.activeElement && (
                                <p>{t('feedback.detail.activeElement')}: {summarizeFeedbackElement(item.clientContext.activeElement)}</p>
                            )}
                        </div>
                    </section>
                )}

                {item.actionLog && (
                    <details className="rounded-lg border border-zinc-200 bg-white p-2.5" open>
                        <summary
                            data-testid="feedback-action-log-toggle"
                            className="cursor-pointer text-[11px] font-medium text-zinc-500 hover:text-zinc-700"
                        >
                            {t('feedback.actionLog.title')}
                        </summary>
                        <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-zinc-100 p-2.5 font-mono text-[11px] leading-relaxed text-zinc-600 whitespace-pre-wrap">
                            {item.actionLog}
                        </pre>
                    </details>
                )}

                {item.stateSnapshot && (
                    <details className="rounded-lg border border-zinc-200 bg-white p-2.5">
                        <summary
                            data-testid="feedback-state-snapshot-toggle"
                            className="flex cursor-pointer items-center gap-2 text-[11px] font-medium text-zinc-500 hover:text-zinc-700"
                        >
                            <ScrollText size={12} />
                            {t('feedback.stateSnapshot.title')}
                        </summary>
                        <div className="relative mt-2">
                            <pre className="max-h-72 overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 p-2.5 font-mono text-[11px] leading-relaxed text-emerald-400 whitespace-pre-wrap">
                                {item.stateSnapshot}
                            </pre>
                            <button
                                type="button"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    navigator.clipboard.writeText(item.stateSnapshot!).then(() => {
                                        setSnapshotCopied(true);
                                        setTimeout(() => setSnapshotCopied(false), 2000);
                                    });
                                }}
                                className="absolute right-2 top-2 inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] text-white transition-colors hover:bg-emerald-500"
                            >
                                {snapshotCopied ? <Check size={10} /> : <Copy size={10} />}
                                {snapshotCopied ? t('feedback.stateSnapshot.copied') : t('feedback.stateSnapshot.copy')}
                            </button>
                        </div>
                    </details>
                )}
            </div>
        </aside>
    );
}

function MetaField({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
            {children}
        </div>
    );
}
