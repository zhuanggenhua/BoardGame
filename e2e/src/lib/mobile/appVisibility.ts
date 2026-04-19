export const BG_SHELL_APP_HIDDEN_EVENT = 'bg-shell-app-hidden';
export const BG_SHELL_APP_VISIBLE_EVENT = 'bg-shell-app-visible';

type AppVisibilityCallback = (isActive: boolean) => void;

let lastKnownShellActive = true;
let lastKnownDocumentVisible = typeof document === 'undefined'
    ? true
    : document.visibilityState !== 'hidden';

const resolveCompositeActiveState = () => lastKnownShellActive && lastKnownDocumentVisible;

export const __resetAppVisibilityForTests = () => {
    lastKnownShellActive = true;
    lastKnownDocumentVisible = typeof document === 'undefined'
        ? true
        : document.visibilityState !== 'hidden';
};

export const isAppCurrentlyActive = () => {
    return resolveCompositeActiveState();
};

export const dispatchAppVisibilityChange = (isActive: boolean) => {
    if (lastKnownShellActive === isActive) {
        return;
    }

    lastKnownShellActive = isActive;

    if (typeof window === 'undefined') {
        return;
    }

    const eventName = isActive ? BG_SHELL_APP_VISIBLE_EVENT : BG_SHELL_APP_HIDDEN_EVENT;
    window.dispatchEvent(new CustomEvent(eventName));
};

export const onAppVisibilityChange = (callback: AppVisibilityCallback): (() => void) => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return () => {};
    }

    let lastEmittedState = resolveCompositeActiveState();
    const emitIfChanged = () => {
        const nextActive = resolveCompositeActiveState();
        if (nextActive === lastEmittedState) {
            return;
        }
        lastEmittedState = nextActive;
        callback(nextActive);
    };

    const handleDocumentVisibilityChange = () => {
        lastKnownDocumentVisible = document.visibilityState !== 'hidden';
        emitIfChanged();
    };
    const handleShellVisible = () => {
        lastKnownShellActive = true;
        emitIfChanged();
    };
    const handleShellHidden = () => {
        lastKnownShellActive = false;
        emitIfChanged();
    };

    document.addEventListener('visibilitychange', handleDocumentVisibilityChange);
    window.addEventListener(BG_SHELL_APP_VISIBLE_EVENT, handleShellVisible as EventListener);
    window.addEventListener(BG_SHELL_APP_HIDDEN_EVENT, handleShellHidden as EventListener);

    return () => {
        document.removeEventListener('visibilitychange', handleDocumentVisibilityChange);
        window.removeEventListener(BG_SHELL_APP_VISIBLE_EVENT, handleShellVisible as EventListener);
        window.removeEventListener(BG_SHELL_APP_HIDDEN_EVENT, handleShellHidden as EventListener);
    };
};

export const onAppVisible = (callback: () => void): (() => void) => (
    onAppVisibilityChange((isActive) => {
        if (isActive) {
            callback();
        }
    })
);
