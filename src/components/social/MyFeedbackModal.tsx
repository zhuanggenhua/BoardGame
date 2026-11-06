import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock3, Lightbulb, MessageSquareWarning, RefreshCw, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ADMIN_API_URL } from '../../config/server';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { RewardPointsBadge } from '../common/labels/RewardPointsBadge';
import { useAuthModalSession } from '../../hooks/ui/useAuthModalSession';
import { getGameById } from '../../config/games.config';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';
import './my-feedback.css';

const PAGE_SIZE = 6;

type ModalViewportCssVars = {
    '--modal-active-viewport-height': string;
    '--modal-active-bottom-inset': string;
    '--modal-max-height': string;
};

interface MyFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface MyFeedbackItem {
    _id: string;
    content?: string;
    contentPreview?: string;
    hasEmbeddedImage?: boolean;
    type: 'bug' | 'suggestion' | 'other';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    gameName?: string;
    closedReason?: string | null;
    resolvedMethod?: string | null;
    rewardPoints?: number;
    createdAt: string;
}

const STATUS_STYLES: Record<MyFeedbackItem['status'], string> = {
    open: 'border-amber-200 bg-amber-50 text-amber-700',
    in_progress: 'border-blue-200 bg-blue-50 text-blue-700',
    resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    closed: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

const TYPE_ICONS: Record<MyFeedbackItem['type'], typeof AlertTriangle> = {
    bug: AlertTriangle,
    suggestion: Lightbulb,
    other: MessageSquareWarning,
};

const stripEmbeddedImages = (content?: string) => (
    content?.replace(/!\[[^\]]*\]\((data:image\/[^)]+)\)/g, '').trim() ?? ''
);

const resolveFeedbackExcerpt = (
    item: MyFeedbackItem,
    onlyImageLabel: string,
    emptyLabel: string,
    preferFullContent = false,
) => {
    if (preferFullContent) {
        const fullText = stripEmbeddedImages(item.content);
        if (fullText) return fullText;
    }
    const preview = item.contentPreview?.trim();
    if (preview) return preview;
    const text = stripEmbeddedImages(item.content);
    if (text) return text;
    return item.hasEmbeddedImage ? onlyImageLabel : emptyLabel;
};

const formatFeedbackTime = (value: string) => {
    const date = new Date(value);
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
};

export const MyFeedbackModal = ({ isOpen, onClose }: MyFeedbackModalProps) => {
    useAuthModalSession(isOpen, onClose);
    const { token } = useAuth();
    const { success, error } = useToast();
    const { t } = useTranslation(['lobby', 'auth', 'admin']);
    const tokenRef = useRef(token);
    const isOpenRef = useRef(isOpen);
    tokenRef.current = token;
    isOpenRef.current = isOpen;
    const [items, setItems] = useState<MyFeedbackItem[]>([]);
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [refreshVersion, setRefreshVersion] = useState(0);
    const listRequest = useRef<AbortController | null>(null);
    const detailRequests = useRef(new Map<string, AbortController>());
    const scrollBody = useRef<HTMLDivElement | null>(null);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
    const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
    const [detailLoadingIds, setDetailLoadingIds] = useState<Set<string>>(() => new Set());

    const statusLabels = useMemo(() => ({
        open: t('admin:feedback.status.open'),
        in_progress: t('admin:feedback.status.in_progress'),
        resolved: t('admin:feedback.status.resolved'),
        closed: t('admin:feedback.status.closed'),
    }), [t]);

    const typeLabels = useMemo(() => ({
        bug: t('admin:feedback.type.bug'),
        suggestion: t('admin:feedback.type.suggestion'),
        other: t('admin:feedback.type.other'),
    }), [t]);

    const fetchItems = useCallback(async () => {
        listRequest.current?.abort();
        const controller = new AbortController();
        listRequest.current = controller;
        if (!token) {
            setItems([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        setLoading(true);
        setErrorMessage('');
        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback?mineOnly=true&page=${page}&limit=${PAGE_SIZE}&sort=newest&summaryOnly=true`, {
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(t('admin:feedback.messages.fetchFailed'));
            }
            const data = await response.json() as { items?: MyFeedbackItem[]; total?: number };
            if (controller.signal.aborted) return;
            const nextTotal = data.total ?? data.items?.length ?? 0;
            setTotal(nextTotal);
            const lastPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
            if (page > lastPage) { setPage(lastPage); return; }
            setItems(data.items ?? []);
        } catch (error) {
            if (controller.signal.aborted) return;
            setErrorMessage(error instanceof Error ? error.message : t('admin:feedback.messages.fetchFailed'));
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    }, [page, t, token]);

    useEffect(() => {
        if (!isOpen) {
            setItems([]); setPage(1); setTotal(0); setExpandedIds(new Set());
            return;
        }
        void fetchItems();
        return () => listRequest.current?.abort();
    }, [fetchItems, isOpen, refreshVersion]);

    useEffect(() => {
        const requests = detailRequests.current;
        setDetailLoadingIds(new Set());
        return () => {
            requests.forEach((controller) => controller.abort());
            requests.clear();
        };
    }, [isOpen, token]);

    useEffect(() => {
        setExpandedIds(new Set());
        if (scrollBody.current) scrollBody.current.scrollTop = 0;
    }, [page]);

    const loadItemDetail = useCallback(async (id: string) => {
        if (!token) {
            return;
        }
        const target = items.find((item) => item._id === id);
        if (target?.content || detailLoadingIds.has(id)) {
            return;
        }

        setDetailLoadingIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        const requestToken = token;
        const controller = new AbortController();
        detailRequests.current.get(id)?.abort();
        detailRequests.current.set(id, controller);
        setErrorMessage('');
        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback/${id}`, {
                signal: controller.signal,
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(t('admin:feedback.messages.fetchFailed'));
            }
            const detail = await response.json() as MyFeedbackItem;
            if (controller.signal.aborted || !isOpenRef.current || tokenRef.current !== requestToken) return;
            setItems((prev) => prev.map((item) => (
                item._id === id ? { ...item, ...detail } : item
            )));
        } catch (err) {
            if (controller.signal.aborted || !isOpenRef.current || tokenRef.current !== requestToken) return;
            const message = err instanceof Error ? err.message : t('admin:feedback.messages.fetchFailed');
            setErrorMessage(message);
            error(message);
        } finally {
            if (detailRequests.current.get(id) === controller) {
                detailRequests.current.delete(id);
                if (isOpenRef.current && tokenRef.current === requestToken) {
                    setDetailLoadingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                    });
                }
            }
        }
    }, [detailLoadingIds, error, items, t, token]);

    const deleteItem = useCallback(async (id: string) => {
        if (!token) {
            setErrorMessage(t('admin:feedback.messages.deleteFailed'));
            error(t('admin:feedback.messages.deleteFailed'));
            return;
        }
        if (!window.confirm(t('admin:feedback.confirm.delete'))) {
            return;
        }

        setDeletingIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setErrorMessage('');
        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback/${id}`, {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            const payload = await response.json().catch(() => null) as { ok?: boolean; error?: string; message?: string } | null;
            if (!response.ok || payload?.ok === false) {
                throw new Error(payload?.error || payload?.message || t('admin:feedback.messages.deleteFailed'));
            }
            setItems((prev) => prev.filter((item) => item._id !== id));
            setExpandedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            success(t('admin:feedback.messages.deleteSuccess'));
            setRefreshVersion(version => version + 1);
        } catch (err) {
            const message = err instanceof Error ? err.message : t('admin:feedback.messages.deleteFailed');
            setErrorMessage(message);
            error(message);
        } finally {
            setDeletingIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }, [error, success, t, token]);

    if (!isOpen) return null;

    return (
        <div
            className="modal-base-container fixed inset-0 z-50 flex items-center justify-center p-4"
            data-lock-layout-viewport="true"
            style={({
                '--modal-active-viewport-height': 'var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))',
                '--modal-active-bottom-inset': 'var(--runtime-modal-bottom-inset)',
                '--modal-max-height': 'calc(var(--layout-viewport-height, var(--runtime-viewport-height, 100vh)) - max(1rem, var(--safe-area-top)) - max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset))))',
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            } as CSSProperties & ModalViewportCssVars)}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 8 }}
                onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="my-feedback-title"
                className="my-feedback-dialog" data-testid="my-feedback-modal" data-platform-dialog="my-feedback"
                style={{ maxHeight: 'min(800px, var(--modal-max-height, var(--runtime-modal-max-height)))' }}
            >
                <header className="my-feedback-header">
                    <div className="my-feedback-heading"><MessageSquareWarning aria-hidden="true" size={22} /><div>
                        <h2 id="my-feedback-title">{t('auth:menu.myFeedback')}</h2>
                        <p>{t('auth:menu.myFeedbackSubtitle')}</p>
                    </div></div>
                    <div className="my-feedback-toolbar">
                        <button type="button" onClick={() => setRefreshVersion(version => version + 1)} disabled={loading}>
                            <RefreshCw aria-hidden="true" size={18} className={clsx(loading && 'animate-spin')} />{t('admin:feedback.refresh')}
                        </button>
                        <button type="button" className="my-feedback-close" onClick={onClose} aria-label={t('common:button.close')}><X size={22} /></button>
                    </div>
                </header>
                <div ref={scrollBody} className="my-feedback-body">
                    {loading ? <p className="my-feedback-empty" role="status">{t('admin:feedback.polling')}</p>
                        : errorMessage ? <div className="my-feedback-error" role="alert">{errorMessage}</div>
                        : items.length === 0 ? <div className="my-feedback-empty"><CheckCircle2 size={28} aria-hidden="true" />
                            <strong>{t('auth:menu.myFeedbackEmpty')}</strong><p>{t('auth:menu.myFeedbackEmptyHint')}</p></div>
                        : <div className="my-feedback-list">{items.map(item => {
                            const Icon = TYPE_ICONS[item.type];
                            const expanded = expandedIds.has(item._id);
                            const excerpt = resolveFeedbackExcerpt(item, t('admin:feedback.content.onlyImage'), t('admin:feedback.content.empty'), expanded);
                            const result = item.status === 'closed' ? item.closedReason?.trim() || t('auth:menu.feedbackClosedReasonEmpty')
                                : item.status === 'resolved' ? item.resolvedMethod?.trim() || t('auth:menu.feedbackResolvedMethodEmpty') : '';
                            const resultLabel = item.status === 'closed' ? t('auth:menu.feedbackClosedReasonLabel') : t('auth:menu.feedbackResolvedMethodLabel');
                            const game = item.gameName ? getGameById(item.gameName) : undefined;
                            return <article className="my-feedback-row" data-testid="my-feedback-item" data-feedback-id={item._id} key={item._id}>
                                <div className="my-feedback-record">
                                    <button className="my-feedback-expand" type="button" data-testid="my-feedback-expand" aria-expanded={expanded}
                                        aria-controls={`feedback-detail-${item._id}`} onClick={event => {
                                            if (event.detail > 0 && window.getSelection()?.toString()) return;
                                            setExpandedIds(previous => { const next = new Set(previous); if (next.has(item._id)) next.delete(item._id); else next.add(item._id); return next; });
                                            if (!expanded) void loadItemDetail(item._id);
                                        }}>
                                        <span className={clsx('my-feedback-content', !expanded && 'my-feedback-clamp')}>{excerpt}</span>
                                        <ChevronDown size={18} aria-hidden="true" className={clsx(expanded && 'my-feedback-chevron-open')} />
                                    </button>
                                    <div className="my-feedback-meta">
                                        <span className={clsx('my-feedback-status', STATUS_STYLES[item.status])}>{statusLabels[item.status]}</span>
                                        <span className="my-feedback-type"><Icon size={14} aria-hidden="true" />{typeLabels[item.type]}</span>
                                        {item.gameName && <span>{game ? resolveGameDisplayName(game, t) : item.gameName}</span>}
                                        <time dateTime={item.createdAt}><Clock3 size={13} aria-hidden="true" />{formatFeedbackTime(item.createdAt)}</time>
                                        {!!item.rewardPoints && <RewardPointsBadge points={item.rewardPoints} signed />}
                                    </div>
                                    {detailLoadingIds.has(item._id) && <p data-testid="my-feedback-detail-loading" role="status">{t('admin:feedback.detail.loading')}</p>}
                                    <div id={`feedback-detail-${item._id}`} className="my-feedback-result" data-expanded={expanded || undefined}>
                                        {result && <p className={clsx(!expanded && 'my-feedback-clamp')}><strong>{resultLabel}</strong> {result}</p>}
                                    </div>
                                </div>
                                <button type="button" className="my-feedback-delete" data-testid="my-feedback-delete" aria-label={t('auth:menu.feedbackDeleteLabel')}
                                    title={t('admin:feedback.actions.delete')} onClick={() => void deleteItem(item._id)} disabled={deletingIds.has(item._id)}>
                                    <Trash2 size={17} aria-hidden="true" />
                                </button>
                            </article>;
                        })}</div>}
                </div>
                <footer className="my-feedback-footer">
                    <span>{t('auth:menu.feedbackTotal', { count: total })}</span>
                    <nav aria-label={t('auth:menu.feedbackPagination')}>
                        <button type="button" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>
                            <ChevronLeft size={17} aria-hidden="true" /><span>{t('auth:menu.feedbackPrevious')}</span>
                        </button>
                        <span aria-live="polite">{t('auth:menu.feedbackPage', { page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) })}</span>
                        <button type="button" disabled={loading || page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(value => value + 1)}>
                            <span>{t('auth:menu.feedbackNext')}</span><ChevronRight size={17} aria-hidden="true" />
                        </button>
                    </nav>
                </footer>
            </motion.div>
        </div>
    );
};
