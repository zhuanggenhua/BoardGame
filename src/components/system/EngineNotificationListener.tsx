import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { ENGINE_NOTIFICATION_EVENT, type EngineNotificationDetail } from '../../engine/notifications';

export const EngineNotificationListener = () => {
    const toast = useToast();
    const { i18n } = useTranslation();

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<EngineNotificationDetail>).detail;
            if (!detail) return;

            const ns = `game-${detail.gameId}`;
            const key = `error.${detail.error}`;

            if (i18n.exists(key, { ns })) {
                toast.warning({ kind: 'i18n', key, ns }, undefined, { dedupeKey: `engine.${detail.gameId}.${detail.error}` });
                return;
            }

            toast.warning({ kind: 'text', text: detail.error }, undefined, { dedupeKey: `engine.${detail.gameId}.${detail.error}` });
        };

        window.addEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
        return () => window.removeEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
    }, [i18n, toast]);

    return null;
};
