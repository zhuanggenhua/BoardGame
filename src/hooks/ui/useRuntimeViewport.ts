import { useEffect, useState } from 'react';
import {
    resolveStableViewportSize,
    type RuntimeViewportSize,
} from '../../games/mobileSupport';

export interface RuntimeSafeAreaInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface RuntimeViewportMetrics extends RuntimeViewportSize {
    safeArea: RuntimeSafeAreaInsets;
}

const EMPTY_SAFE_AREA: RuntimeSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const EMPTY_VIEWPORT: RuntimeViewportMetrics = { width: 0, height: 0, safeArea: EMPTY_SAFE_AREA };

const parseCssPixels = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const readRuntimeSafeAreaInsets = (): RuntimeSafeAreaInsets => {
    if (typeof window === 'undefined') {
        return EMPTY_SAFE_AREA;
    }

    const rootStyles = window.getComputedStyle(document.documentElement);
    return {
        top: parseCssPixels(rootStyles.getPropertyValue('--safe-area-top')),
        right: parseCssPixels(rootStyles.getPropertyValue('--safe-area-right')),
        bottom: parseCssPixels(rootStyles.getPropertyValue('--safe-area-bottom')),
        left: parseCssPixels(rootStyles.getPropertyValue('--safe-area-left')),
    };
};

export const readRuntimeViewportMetrics = (
    previous: RuntimeViewportMetrics = EMPTY_VIEWPORT,
): RuntimeViewportMetrics => {
    if (typeof window === 'undefined') {
        return previous;
    }

    const visualViewport = window.visualViewport;
    const viewport = resolveStableViewportSize(
        previous,
        visualViewport ? { width: visualViewport.width, height: visualViewport.height } : undefined,
        { width: window.innerWidth, height: window.innerHeight },
        {
            width: document.documentElement.clientWidth,
            height: document.documentElement.clientHeight,
        },
    );

    return {
        ...viewport,
        safeArea: readRuntimeSafeAreaInsets(),
    };
};

export const applyRuntimeViewportCssVars = (viewport: RuntimeViewportSize) => {
    if (typeof document === 'undefined') return;
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const root = document.documentElement;
    root.style.setProperty('--runtime-viewport-width', `${viewport.width}px`);
    root.style.setProperty('--runtime-viewport-height', `${viewport.height}px`);
};

interface UseRuntimeViewportOptions {
    syncCssVars?: boolean;
}

export const useRuntimeViewport = (
    options: UseRuntimeViewportOptions = {},
): RuntimeViewportMetrics => {
    const { syncCssVars = true } = options;
    const [viewport, setViewport] = useState<RuntimeViewportMetrics>(() => readRuntimeViewportMetrics());

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const visualViewport = window.visualViewport;
        const updateViewport = () => {
            setViewport((previous) => {
                const next = readRuntimeViewportMetrics(previous);
                if (syncCssVars) {
                    applyRuntimeViewportCssVars(next);
                }

                if (
                    next.width === previous.width
                    && next.height === previous.height
                    && next.safeArea.top === previous.safeArea.top
                    && next.safeArea.right === previous.safeArea.right
                    && next.safeArea.bottom === previous.safeArea.bottom
                    && next.safeArea.left === previous.safeArea.left
                ) {
                    return previous;
                }

                return next;
            });
        };

        updateViewport();
        window.addEventListener('resize', updateViewport);
        window.addEventListener('orientationchange', updateViewport);
        visualViewport?.addEventListener('resize', updateViewport);

        return () => {
            window.removeEventListener('resize', updateViewport);
            window.removeEventListener('orientationchange', updateViewport);
            visualViewport?.removeEventListener('resize', updateViewport);
        };
    }, [syncCssVars]);

    return viewport;
};
