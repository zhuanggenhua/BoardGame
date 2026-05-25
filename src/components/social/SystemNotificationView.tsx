import { useEffect, useState } from 'react';
import { NOTIFICATION_API_URL } from '../../config/server';
import { useTranslation } from 'react-i18next';
import { Bell, Pin } from 'lucide-react';

interface SystemNotification {
    _id: string;
    title: string;
    content: string;
    createdAt: string;
    pinned?: boolean;
}

export const SystemNotificationView = () => {
    const { t } = useTranslation(['social', 'common']);
    const [notifications, setNotifications] = useState<SystemNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        fetch(`${NOTIFICATION_API_URL}`)
            .then(res => res.ok ? res.json() : Promise.reject())
            .then(data => { if (active) setNotifications(data.notifications ?? []); })
            .catch(() => {})
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden bg-parchment-card-bg">
            {/* 顶部栏 */}
            <div className="shrink-0 h-14 flex items-center px-4 border-b border-parchment-card-border/30 bg-parchment-base-bg">
                <Bell size={18} className="text-parchment-base-text" />
                <span className="ml-3 font-bold text-sm text-parchment-base-text">{t('notification.title')}</span>
            </div>

            {/* 通知列表 */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {loading ? (
                    <div className="text-center text-xs text-parchment-light-text py-8">{t('common:loading')}</div>
                ) : notifications.length === 0 ? (
                    <div className="text-center text-parchment-light-text py-12 text-sm italic opacity-70">
                        {t('notification.empty')}
                    </div>
                ) : (
                    <div className="p-3 space-y-3">
                        {notifications.map(n => (
                            <div
                                key={n._id}
                                data-testid={`system-notification-card-${n._id}`}
                                data-pinned={n.pinned ? 'true' : 'false'}
                                className={[
                                    'relative overflow-hidden rounded-lg border p-4 shadow-sm transition-colors',
                                    n.pinned
                                        ? 'border-amber-300/70 bg-[linear-gradient(180deg,rgba(255,251,235,0.98)_0%,rgba(255,247,220,0.95)_100%)] shadow-[0_10px_24px_rgba(180,120,30,0.12)]'
                                        : 'border-parchment-card-border/20 bg-white',
                                ].join(' ')}
                            >
                                {n.pinned && (
                                    <div
                                        aria-hidden="true"
                                        className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,rgba(245,158,11,0)_0%,rgba(245,158,11,0.9)_18%,rgba(217,119,6,0.95)_82%,rgba(217,119,6,0)_100%)]"
                                    />
                                )}
                                <div className="flex items-start gap-2">
                                    <h4 className="flex-1 font-bold text-sm text-parchment-base-text">{n.title}</h4>
                                    {n.pinned && (
                                        <span
                                            data-testid={`system-notification-pinned-badge-${n._id}`}
                                            className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                                        >
                                            <Pin size={11} />
                                            {t('notification.pinnedBadge')}
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-parchment-light-text mt-1.5 whitespace-pre-wrap">{n.content}</p>
                                <p className="text-[10px] text-parchment-light-text/50 mt-2">
                                    {new Date(n.createdAt).toLocaleString('zh-CN')}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
