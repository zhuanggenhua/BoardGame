type LegacyFullscreenDocument = Document & {
    msExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    webkitExitFullscreen?: () => Promise<void> | void;
};

type LegacyFullscreenElement = HTMLElement & {
    msRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    webkitRequestFullscreen?: (keyboardInput?: number) => Promise<void> | void;
};

const LEGACY_KEYBOARD_INPUT_ALLOWED = 1;

export type WebOrientationPreference = 'landscape' | 'portrait';

export type ToggleDocumentFullscreenResult =
    | { ok: true; state: 'entered' | 'exited'; orientationLocked: boolean }
    | { ok: false; reason: 'unsupported' | 'ios-web-limited' | 'enter-failed' | 'exit-failed' };

const isStandaloneNavigator = (navigatorObject: Navigator & { standalone?: boolean }) =>
    navigatorObject.standalone === true;

export const isStandaloneWebApp = () => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return false;
    }

    if (isStandaloneNavigator(navigator as Navigator & { standalone?: boolean })) {
        return true;
    }

    if (typeof window.matchMedia === 'function') {
        try {
            return window.matchMedia('(display-mode: standalone)').matches;
        } catch {
            return false;
        }
    }

    return false;
};

export const isIosWebBrowser = () => {
    if (typeof navigator === 'undefined') {
        return false;
    }

    const userAgent = navigator.userAgent || '';
    return /iPad|iPhone|iPod/i.test(userAgent);
};

export const tryLockScreenOrientation = async (orientation: WebOrientationPreference) => {
    if (typeof window === 'undefined') return false;

    const orientationApi = window.screen?.orientation as (ScreenOrientation & {
        lock?: (nextOrientation: WebOrientationPreference) => Promise<void>;
        unlock?: () => void;
    }) | undefined;

    if (typeof orientationApi?.lock !== 'function') {
        return false;
    }

    try {
        await orientationApi.lock(orientation);
        return true;
    } catch {
        return false;
    }
};

export const unlockScreenOrientation = () => {
    if (typeof window === 'undefined') return;

    const orientationApi = window.screen?.orientation as (ScreenOrientation & {
        unlock?: () => void;
    }) | undefined;

    try {
        orientationApi?.unlock?.();
    } catch {
        // ignore unlock failures
    }
};

export const toggleDocumentFullscreen = async (options?: {
    preferredOrientation?: WebOrientationPreference;
}): Promise<ToggleDocumentFullscreenResult> => {
    if (typeof document === 'undefined') {
        return { ok: false, reason: 'unsupported' };
    }

    const doc = document as LegacyFullscreenDocument;
    const elem = document.documentElement as LegacyFullscreenElement;

    if (!document.fullscreenElement) {
        const requestFullscreen = elem.requestFullscreen
            ?? elem.msRequestFullscreen
            ?? elem.mozRequestFullScreen
            ?? elem.webkitRequestFullscreen;

        if (!requestFullscreen) {
            return { ok: false, reason: isIosWebBrowser() ? 'ios-web-limited' : 'unsupported' };
        }

        try {
            if (requestFullscreen === elem.webkitRequestFullscreen) {
                await (requestFullscreen as NonNullable<LegacyFullscreenElement['webkitRequestFullscreen']>)
                    .call(elem, LEGACY_KEYBOARD_INPUT_ALLOWED);
            } else {
                await requestFullscreen.call(elem);
            }

            const orientationLocked = options?.preferredOrientation
                ? await tryLockScreenOrientation(options.preferredOrientation)
                : false;

            return { ok: true, state: 'entered', orientationLocked };
        } catch {
            return { ok: false, reason: 'enter-failed' };
        }
    }

    const exitFullscreen = document.exitFullscreen
        ?? doc.msExitFullscreen
        ?? doc.mozCancelFullScreen
        ?? doc.webkitExitFullscreen;

    if (!exitFullscreen) {
        return { ok: false, reason: 'unsupported' };
    }

    try {
        await exitFullscreen.call(doc);
        unlockScreenOrientation();
        return { ok: true, state: 'exited', orientationLocked: false };
    } catch {
        return { ok: false, reason: 'exit-failed' };
    }
};
