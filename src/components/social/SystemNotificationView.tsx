import { useEffect, useState } from 'react';
import { NOTIFICATION_API_URL } from '../../config/server';
import { useTranslation } from 'react-i18next';
import { Bell } from 'lucide-react';

interface SystemNotification {
    _id: string;
    title: string;
    content: string;
    createdAt: string;
}

export const SystemNotificationView = () => {
    const { t } = useTranslation('social');
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
        <div className="flex flex-col h-full bg-parchment-card-bg">
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
                            <div key={n._id} className="bg-white border border-parchment-card-border/20 rounded-lg p-4 shadow-sm">
                                <h4 className="font-bold text-sm text-parchment-base-text">{n.title}</h4>
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
