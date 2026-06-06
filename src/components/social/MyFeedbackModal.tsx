import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Clock3, Lightbulb, MessageSquareWarning, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { ADMIN_API_URL } from '../../config/server';
import { useAuth } from '../../contexts/AuthContext';
import { RewardPointsBadge } from '../common/labels/RewardPointsBadge';

interface MyFeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface MyFeedbackItem {
    _id: string;
    content: string;
    type: 'bug' | 'suggestion' | 'other';
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    gameName?: string;
    closedReason?: string | null;
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

const stripEmbeddedImages = (content: string) => content.replace(/!\[[^\]]*\]\((data:image\/[^)]+)\)/g, '').trim();

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
    const { token } = useAuth();
    const { t } = useTranslation(['auth', 'admin']);
    const [items, setItems] = useState<MyFeedbackItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

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
        if (!token) {
            setItems([]);
            return;
        }
        setLoading(true);
        setErrorMessage('');
        try {
            const response = await fetch(`${ADMIN_API_URL}/feedback?mineOnly=true&limit=50&sort=newest`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error(t('admin:feedback.messages.fetchFailed'));
            }
            const data = await response.json() as { items?: MyFeedbackItem[] };
            setItems(data.items ?? []);
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : t('admin:feedback.messages.fetchFailed'));
        } finally {
            setLoading(false);
        }
    }, [t, token]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        void fetchItems();
    }, [fetchItems, isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="modal-base-container fixed inset-0 z-50 flex items-center justify-center p-4"
            data-lock-layout-viewport="true"
            style={{
                '--modal-active-viewport-height': 'var(--layout-viewport-height, var(--runtime-viewport-height, 100vh))',
                '--modal-active-bottom-inset': 'var(--runtime-modal-bottom-inset)',
                '--modal-max-height': 'calc(var(--layout-viewport-height, var(--runtime-viewport-height, 100vh)) - max(1rem, var(--safe-area-top)) - max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset))))',
                paddingTop: 'max(1rem, var(--safe-area-top))',
                paddingRight: 'max(1rem, var(--safe-area-right))',
                paddingBottom: 'max(1rem, var(--modal-active-bottom-inset, var(--runtime-modal-bottom-inset)))',
                paddingLeft: 'max(1rem, var(--safe-area-left))',
            }}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(event) => event.stopPropagation()}
                className="relative flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-parchment-card-border/30 bg-parchment-card-bg shadow-2xl"
                style={{ maxHeight: 'min(760px, var(--modal-max-height, var(--runtime-modal-max-height)))' }}
            >
                <div className="flex items-center justify-between border-b border-parchment-card-border/30 bg-parchment-base-bg px-4 py-3">
                    <div className="flex items-center gap-3 text-parchment-base-text">
                        <MessageSquareWarning size={20} />
                        <div>
                            <h2 className="font-bold text-lg">{t('auth:menu.myFeedback')}</h2>
                            <p className="text-xs text-parchment-light-text">{t('auth:menu.myFeedbackSubtitle')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => void fetchItems()}
                            className="inline-flex items-center gap-1 rounded-md border border-parchment-card-border/40 px-2.5 py-1.5 text-xs font-semibold text-parchment-base-text transition-colors hover:bg-parchment-card-border/10"
                        >
                            <RefreshCw size={14} className={clsx(loading && 'animate-spin')} />
                            {t('admin:feedback.refresh')}
                        </button>
                        <button
                            onClick={onClose}
                            className="rounded-full p-1.5 text-parchment-base-text transition-colors hover:bg-parchment-card-border/20"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex min-h-48 items-center justify-center text-sm text-parchment-light-text">
                            {t('admin:feedback.polling')}
                        </div>
                    ) : errorMessage ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {errorMessage}
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-parchment-light-text">
                            <CheckCircle2 size={28} className="text-parchment-card-border" />
                            <div>
                                <p className="font-semibold text-parchment-base-text">{t('auth:menu.myFeedbackEmpty')}</p>
                                <p className="text-xs">{t('auth:menu.myFeedbackEmptyHint')}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {items.map((item) => {
                                const Icon = TYPE_ICONS[item.type];
                                const excerpt = stripEmbeddedImages(item.content) || t('admin:feedback.content.onlyImage');
                                return (
                                    <article
                                        key={item._id}
                                        className="rounded-lg border border-parchment-card-border/30 bg-white/80 px-4 py-3 shadow-sm"
                                    >
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-parchment-base-bg text-parchment-base-text">
                                                        <Icon size={14} />
                                                    </span>
                                                    <span className={clsx('rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_STYLES[item.status])}>
                                                        {statusLabels[item.status]}
                                                    </span>
                                                    <span className="text-[11px] font-semibold uppercase tracking-wide text-parchment-light-text">
                                                        {typeLabels[item.type]}
                                                    </span>
                                                    {item.gameName ? (
                                                        <span className="text-[11px] text-parchment-light-text">{item.gameName}</span>
                                                    ) : null}
                                                </div>
                                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-parchment-base-text">
                                                    {excerpt}
                                                </p>
                                            </div>

                                            <div className="flex flex-col items-end gap-2">
                                                {item.rewardPoints ? (
                                                    <RewardPointsBadge points={item.rewardPoints} signed />
                                                ) : null}
                                                <span className="inline-flex items-center gap-1 text-[11px] text-parchment-light-text">
                                                    <Clock3 size={12} />
                                                    {formatFeedbackTime(item.createdAt)}
                                                </span>
                                            </div>
                                        </div>

                                        {item.status === 'closed' ? (
                                            <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-700">
                                                <span className="font-semibold">{t('auth:menu.feedbackClosedReasonLabel')}</span>
                                                <span className="ml-1">{item.closedReason?.trim() || t('auth:menu.feedbackClosedReasonEmpty')}</span>
                                            </div>
                                        ) : null}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </div>
            </motion.div>
        </div>
    );
};
