export type AudioRuntimeToastTone = 'success' | 'info' | 'warning' | 'error';

export type AudioRuntimeToastDetail = {
    tone?: AudioRuntimeToastTone;
    titleKey: string;
    messageKey: string;
    params?: Record<string, string | number>;
    dedupeKey?: string;
    ns?: string;
};

export const AUDIO_RUNTIME_TOAST_EVENT = 'bg:audio-runtime-toast';

export const notifyAudioRuntimeToast = (detail: AudioRuntimeToastDetail): void => {
    if (typeof window === 'undefined') {
        return;
    }
    window.dispatchEvent(new CustomEvent<AudioRuntimeToastDetail>(AUDIO_RUNTIME_TOAST_EVENT, {
        detail,
    }));
};

export const addAudioRuntimeToastListener = (
    listener: (detail: AudioRuntimeToastDetail) => void,
): (() => void) => {
    if (typeof window === 'undefined') {
        return () => undefined;
    }
    const handler = (event: Event) => {
        const customEvent = event as CustomEvent<AudioRuntimeToastDetail>;
        if (!customEvent.detail) {
            return;
        }
        listener(customEvent.detail);
    };
    window.addEventListener(AUDIO_RUNTIME_TOAST_EVENT, handler as EventListener);
    return () => {
        window.removeEventListener(AUDIO_RUNTIME_TOAST_EVENT, handler as EventListener);
    };
};
