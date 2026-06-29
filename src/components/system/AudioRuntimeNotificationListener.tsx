import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../contexts/ToastContext';
import { addAudioRuntimeToastListener } from '../../lib/audio/audioRuntimeNotifications';

export const AudioRuntimeNotificationListener = () => {
    const toast = useToast();
    const { t } = useTranslation('lobby');

    useEffect(() => addAudioRuntimeToastListener((detail) => {
        const title = t(detail.titleKey, detail.params);
        const message = t(detail.messageKey, detail.params);
        const options = detail.dedupeKey ? { dedupeKey: detail.dedupeKey } : undefined;
        switch (detail.tone ?? 'error') {
            case 'success':
                toast.success(message, title, options);
                break;
            case 'info':
                toast.info(message, title, options);
                break;
            case 'warning':
                toast.warning(message, title, options);
                break;
            case 'error':
            default:
                toast.error(message, title, options);
                break;
        }
    }), [t, toast]);

    return null;
};
