import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { ENGINE_NOTIFICATION_EVENT, type EngineNotificationDetail } from '../../engine/notifications';
import { isUiHintOnlyError, resolveCommandError } from '../../engine/transport/errorI18n';

export const EngineNotificationListener = () => {
    const toast = useToast();
    const { i18n } = useTranslation();

    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<EngineNotificationDetail>).detail;
            if (!detail) return;
            if (isUiHintOnlyError(detail.error, i18n, detail.gameId)) return;

            const translated = resolveCommandError(i18n, detail.error, detail.gameId);
            toast.warning(translated, undefined, { dedupeKey: `engine.${detail.gameId}.${detail.error}` });
        };

        window.addEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
        return () => window.removeEventListener(ENGINE_NOTIFICATION_EVENT, handler as EventListener);
    }, [i18n, toast]);

    return null;
};
