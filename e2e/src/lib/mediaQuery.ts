type LegacyMediaQueryListener = (this: MediaQueryList, event: MediaQueryListEvent) => void;

type CompatibleMediaQueryList = MediaQueryList & {
    addListener?: (listener: LegacyMediaQueryListener) => void;
    removeListener?: (listener: LegacyMediaQueryListener) => void;
};

const createFallbackMediaQueryList = (query: string): CompatibleMediaQueryList => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
}) as CompatibleMediaQueryList;

export const safeMatchMedia = (query: string): CompatibleMediaQueryList => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return createFallbackMediaQueryList(query);
    }

    return window.matchMedia(query) as CompatibleMediaQueryList;
};

export const subscribeMediaQueryChange = (
    mediaQuery: CompatibleMediaQueryList,
    listener: () => void,
): (() => void) => {
    const eventListener = listener as unknown as EventListener;

    if (typeof mediaQuery.addEventListener === 'function' && typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.addEventListener('change', eventListener);
        return () => mediaQuery.removeEventListener('change', eventListener);
    }

    if (typeof mediaQuery.addListener === 'function' && typeof mediaQuery.removeListener === 'function') {
        const legacyListener = listener as LegacyMediaQueryListener;
        mediaQuery.addListener(legacyListener);
        return () => mediaQuery.removeListener?.(legacyListener);
    }

    return () => undefined;
};
