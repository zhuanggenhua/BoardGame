import { useLayoutEffect, useRef, useState } from 'react';
import {
    MOBILE_MAX_VIEWPORT_WIDTH,
    detectMobileLayoutEngineCapabilities,
    resolveRuntimeLayoutScaleMetrics,
    resolveStableViewportSize,
    type RuntimeViewportSize,
} from '../../shared/mobileSupport';
import { isTextEntrySessionElement } from '../../lib/textEntry';

export interface RuntimeSafeAreaInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface RuntimeViewportMetrics extends RuntimeViewportSize {
    safeArea: RuntimeSafeAreaInsets;
    keyboardInsetBottom: number;
}

const EMPTY_SAFE_AREA: RuntimeSafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const EMPTY_VIEWPORT: RuntimeViewportMetrics = { width: 0, height: 0, safeArea: EMPTY_SAFE_AREA, keyboardInsetBottom: 0 };
const MIN_KEYBOARD_INSET_PX = 72;
const DEFAULT_ROOT_DESIGN_WIDTH = 1280;
const DEFAULT_BOARD_SHELL_DESIGN_WIDTH = 1280;

const parseCssPixels = (value: string) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const parsePositiveDatasetNumber = (value: string | undefined) => {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const readStableLayoutViewportHeight = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0;
    }
    return Math.max(
        Number.isFinite(window.innerHeight) ? window.innerHeight : 0,
        Number.isFinite(document.documentElement.clientHeight) ? document.documentElement.clientHeight : 0,
    );
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

interface RuntimeKeyboardInsetInput {
    visualViewportHeight?: number | null;
    visualViewportOffsetTop?: number | null;
    innerHeight?: number | null;
    documentClientHeight?: number | null;
    hasFocusedTextEntry?: boolean;
}

export const resolveRuntimeKeyboardInsetBottom = ({
    visualViewportHeight,
    visualViewportOffsetTop,
    innerHeight,
    documentClientHeight,
    hasFocusedTextEntry = false,
}: RuntimeKeyboardInsetInput): number => {
    if (!hasFocusedTextEntry) {
        return 0;
    }

    const resolvedVisualViewportHeight = typeof visualViewportHeight === 'number' && Number.isFinite(visualViewportHeight)
        ? visualViewportHeight
        : 0;
    const resolvedLayoutViewportHeight = Math.max(
        typeof innerHeight === 'number' && Number.isFinite(innerHeight) ? innerHeight : 0,
        typeof documentClientHeight === 'number' && Number.isFinite(documentClientHeight) ? documentClientHeight : 0,
    );
    if (resolvedVisualViewportHeight <= 0 || resolvedLayoutViewportHeight <= 0) {
        return 0;
    }

    const offsetTop = typeof visualViewportOffsetTop === 'number' && Number.isFinite(visualViewportOffsetTop)
        ? Math.max(0, visualViewportOffsetTop)
        : 0;
    const inset = Math.round(resolvedLayoutViewportHeight - (resolvedVisualViewportHeight + offsetTop));
    return inset >= MIN_KEYBOARD_INSET_PX ? inset : 0;
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
    const keyboardInsetBottom = resolveRuntimeKeyboardInsetBottom({
        visualViewportHeight: visualViewport?.height,
        visualViewportOffsetTop: visualViewport?.offsetTop,
        innerHeight: window.innerHeight,
        documentClientHeight: document.documentElement.clientHeight,
        hasFocusedTextEntry: isTextEntrySessionElement(document.activeElement),
    });

    return {
        ...viewport,
        safeArea: readRuntimeSafeAreaInsets(),
        keyboardInsetBottom,
    };
};

export const readLiveRuntimeKeyboardInsetBottom = (options: { hasFocusedTextEntry?: boolean } = {}): number => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return 0;
    }

    return resolveRuntimeKeyboardInsetBottom({
        visualViewportHeight: window.visualViewport?.height,
        visualViewportOffsetTop: window.visualViewport?.offsetTop,
        innerHeight: window.innerHeight,
        documentClientHeight: document.documentElement.clientHeight,
        hasFocusedTextEntry: options.hasFocusedTextEntry ?? isTextEntrySessionElement(document.activeElement),
    });
};

const areRuntimeViewportMetricsEqual = (
    left: RuntimeViewportMetrics,
    right: RuntimeViewportMetrics,
) => {
    return left.width === right.width
        && left.height === right.height
        && left.safeArea.top === right.safeArea.top
        && left.safeArea.right === right.safeArea.right
        && left.safeArea.bottom === right.safeArea.bottom
        && left.safeArea.left === right.safeArea.left
        && left.keyboardInsetBottom === right.keyboardInsetBottom;
};

const setLayoutEngineDataset = (layoutMode: 'legacy' | 'modern', enabled: boolean) => {
    if (typeof document === 'undefined') return;
    [document.documentElement, document.body].forEach((target) => {
        if (!target) return;
        if (!enabled) {
            target.removeAttribute('data-mobile-layout-engine');
            return;
        }
        target.dataset.mobileLayoutEngine = layoutMode;
    });
};

const clearRuntimeScaleVars = (root: HTMLElement) => {
    root.style.removeProperty('--mobile-root-design-width');
    root.style.removeProperty('--mobile-root-scale');
    root.style.removeProperty('--mobile-root-inverse-scale');
    root.style.removeProperty('--mobile-root-logical-height');
    root.style.removeProperty('--mobile-layout-inline-unit');
    root.style.removeProperty('--mobile-layout-block-unit');
};

const clearBoardShellVars = (root: HTMLElement) => {
    root.style.removeProperty('--mobile-board-shell-design-width');
    root.style.removeProperty('--mobile-board-shell-design-height');
    root.style.removeProperty('--mobile-board-shell-scale');
    root.style.removeProperty('--mobile-board-shell-inverse-scale');
    root.style.removeProperty('--mobile-board-shell-logical-height');
    root.style.removeProperty('--mobile-board-shell-inline-unit');
    root.style.removeProperty('--mobile-board-shell-block-unit');
    root.style.removeProperty('--mobile-board-shell-offset-x');
    root.style.removeProperty('--mobile-board-shell-offset-y');
};

const resolveBoardShellScaleMetrics = (
    viewport: RuntimeViewportSize,
    layout: {
        designWidth?: number;
        designHeight?: number;
        minLogicalHeight?: number;
        minReadableScale?: number;
    },
) => {
    const designWidth = layout.designWidth ?? DEFAULT_BOARD_SHELL_DESIGN_WIDTH;
    const designHeight = layout.designHeight;
    if (designHeight) {
        const safeDesignWidth = Math.max(1, designWidth);
        const safeDesignHeight = Math.max(1, designHeight);
        const scale = Math.max(0.01, Math.min(
            viewport.width / safeDesignWidth,
            viewport.height / safeDesignHeight,
        ));
        const inverseScale = 1 / scale;
        const renderedWidth = safeDesignWidth * scale;
        const renderedHeight = safeDesignHeight * scale;

        return {
            designWidth: safeDesignWidth,
            designHeight: safeDesignHeight,
            scale,
            inverseScale,
            logicalHeight: safeDesignHeight,
            inlineUnit: safeDesignWidth / 100,
            blockUnit: safeDesignHeight / 100,
            offsetX: Math.max(0, (viewport.width - renderedWidth) / 2),
            offsetY: Math.max(0, (viewport.height - renderedHeight) / 2),
        };
    }

    const widthMetrics = resolveRuntimeLayoutScaleMetrics(viewport, designWidth);
    const minLogicalHeight = layout.minLogicalHeight;
    if (!minLogicalHeight) {
        return { ...widthMetrics, designHeight: undefined, offsetX: 0, offsetY: 0 };
    }

    const heightScale = Math.max(0.01, viewport.height / minLogicalHeight);
    const minReadableScale = layout.minReadableScale ?? 0.01;
    const scale = Math.min(widthMetrics.scale, Math.max(minReadableScale, heightScale));
    const inverseScale = 1 / scale;
    const renderedWidth = widthMetrics.designWidth * scale;
    const renderedHeight = viewport.height;

    return {
        ...widthMetrics,
        designHeight: undefined,
        scale,
        inverseScale,
        logicalHeight: viewport.height * inverseScale,
        blockUnit: (viewport.height * inverseScale) / 100,
        offsetX: Math.max(0, (viewport.width - renderedWidth) / 2),
        offsetY: Math.max(0, (viewport.height - renderedHeight) / 2),
    };
};

export const applyRuntimeViewportCssVars = (
    viewport: RuntimeViewportSize | RuntimeViewportMetrics,
    options: {
        layoutEngineCapabilities?: ReturnType<typeof detectMobileLayoutEngineCapabilities>;
    } = {},
) => {
    if (typeof document === 'undefined') return;
    if (viewport.width <= 0 || viewport.height <= 0) return;

    const root = document.documentElement;
    const layoutEngineCapabilities = options.layoutEngineCapabilities ?? detectMobileLayoutEngineCapabilities();
    const keyboardInsetBottom = 'keyboardInsetBottom' in viewport
        ? Math.max(0, viewport.keyboardInsetBottom)
        : 0;
    const stableLayoutViewportHeight = readStableLayoutViewportHeight();
    const previousLayoutViewportHeight = parseCssPixels(root.style.getPropertyValue('--layout-viewport-height'));
    const nextLayoutViewportHeight = keyboardInsetBottom > 0
        ? Math.max(viewport.height, stableLayoutViewportHeight, previousLayoutViewportHeight)
        : Math.max(viewport.height, stableLayoutViewportHeight);
    root.style.setProperty('--runtime-viewport-width', `${viewport.width}px`);
    root.style.setProperty('--runtime-viewport-height', `${viewport.height}px`);
    root.style.setProperty('--layout-viewport-height', `${nextLayoutViewportHeight}px`);
    root.style.setProperty('--keyboard-inset-height', `${keyboardInsetBottom}px`);
    root.dataset.keyboardVisible = keyboardInsetBottom > 0 ? 'true' : 'false';

    const gamePageTarget = document.body?.dataset.gamePage === 'true'
        ? document.body
        : document.documentElement.dataset.gamePage === 'true'
            ? document.documentElement
            : document.querySelector<HTMLElement>('[data-game-page="true"]');
    setLayoutEngineDataset(layoutEngineCapabilities.layoutMode, Boolean(gamePageTarget));
    const isLandscapeMobileViewport = viewport.width <= MOBILE_MAX_VIEWPORT_WIDTH && viewport.width > viewport.height;

    if (gamePageTarget && isLandscapeMobileViewport) {
        const rootScaleMetrics = resolveRuntimeLayoutScaleMetrics(viewport, DEFAULT_ROOT_DESIGN_WIDTH);
        root.style.setProperty('--mobile-root-design-width', `${rootScaleMetrics.designWidth}px`);
        root.style.setProperty('--mobile-root-scale', rootScaleMetrics.scale.toFixed(6));
        root.style.setProperty('--mobile-root-inverse-scale', rootScaleMetrics.inverseScale.toFixed(6));
        root.style.setProperty('--mobile-root-logical-height', `${rootScaleMetrics.logicalHeight.toFixed(3)}px`);
        root.style.setProperty('--mobile-layout-inline-unit', `${rootScaleMetrics.inlineUnit.toFixed(4)}px`);
        root.style.setProperty('--mobile-layout-block-unit', `${rootScaleMetrics.blockUnit.toFixed(4)}px`);
    } else {
        clearRuntimeScaleVars(root);
    }

    const mobileLayoutPreset = gamePageTarget?.dataset.mobileLayoutPreset;
    const mobileProfile = gamePageTarget?.dataset.mobileProfile;
    const shouldUseBoardShellScale = mobileLayoutPreset === 'board-shell'
        && mobileProfile === 'landscape-adapted'
        && viewport.width <= MOBILE_MAX_VIEWPORT_WIDTH
        && isLandscapeMobileViewport;

    if (!shouldUseBoardShellScale) {
        clearBoardShellVars(root);
        return;
    }

    const shellScaleMetrics = resolveBoardShellScaleMetrics(viewport, {
        designWidth: parsePositiveDatasetNumber(gamePageTarget?.dataset.mobileBoardShellDesignWidth),
        designHeight: parsePositiveDatasetNumber(gamePageTarget?.dataset.mobileBoardShellDesignHeight),
        minLogicalHeight: parsePositiveDatasetNumber(gamePageTarget?.dataset.mobileBoardShellMinLogicalHeight),
        minReadableScale: parsePositiveDatasetNumber(gamePageTarget?.dataset.mobileBoardShellMinReadableScale),
    });
    root.style.setProperty('--mobile-board-shell-design-width', `${shellScaleMetrics.designWidth}px`);
    if (shellScaleMetrics.designHeight) {
        root.style.setProperty('--mobile-board-shell-design-height', `${shellScaleMetrics.designHeight}px`);
    } else {
        root.style.removeProperty('--mobile-board-shell-design-height');
    }
    root.style.setProperty('--mobile-board-shell-scale', shellScaleMetrics.scale.toFixed(6));
    root.style.setProperty('--mobile-board-shell-inverse-scale', shellScaleMetrics.inverseScale.toFixed(6));
    root.style.setProperty('--mobile-board-shell-logical-height', `${shellScaleMetrics.logicalHeight.toFixed(3)}px`);
    root.style.setProperty('--mobile-board-shell-inline-unit', `${shellScaleMetrics.inlineUnit.toFixed(4)}px`);
    root.style.setProperty('--mobile-board-shell-block-unit', `${shellScaleMetrics.blockUnit.toFixed(4)}px`);
    root.style.setProperty('--mobile-board-shell-offset-x', `${shellScaleMetrics.offsetX.toFixed(3)}px`);
    root.style.setProperty('--mobile-board-shell-offset-y', `${shellScaleMetrics.offsetY.toFixed(3)}px`);
    root.style.setProperty('--mobile-layout-inline-unit', `${shellScaleMetrics.inlineUnit.toFixed(4)}px`);
    root.style.setProperty('--mobile-layout-block-unit', `${shellScaleMetrics.blockUnit.toFixed(4)}px`);
};

interface UseRuntimeViewportOptions {
    syncCssVars?: boolean;
}

export const useRuntimeViewport = (
    options: UseRuntimeViewportOptions = {},
): RuntimeViewportMetrics => {
    const { syncCssVars = true } = options;
    const [viewport, setViewport] = useState<RuntimeViewportMetrics>(() => readRuntimeViewportMetrics());
    const pendingViewportUpdateTimerRef = useRef<number | null>(null);
    const delayedViewportUpdateTimerRefs = useRef<number[]>([]);

    useLayoutEffect(() => {
        if (!syncCssVars) {
            return;
        }
        applyRuntimeViewportCssVars(viewport);
    }, [syncCssVars, viewport]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const visualViewport = window.visualViewport;
        const flushViewportUpdate = () => {
            pendingViewportUpdateTimerRef.current = null;
            setViewport((previous) => {
                const next = readRuntimeViewportMetrics(previous);
                return areRuntimeViewportMetricsEqual(previous, next) ? previous : next;
            });
        };
        const scheduleViewportUpdate = () => {
            if (pendingViewportUpdateTimerRef.current != null) {
                return;
            }
            pendingViewportUpdateTimerRef.current = window.setTimeout(flushViewportUpdate, 0);
        };
        const scheduleDelayedViewportUpdate = () => {
            scheduleViewportUpdate();
            [80, 240, 600].forEach((delay) => {
                const timer = window.setTimeout(flushViewportUpdate, delay);
                delayedViewportUpdateTimerRefs.current.push(timer);
            });
        };

        scheduleViewportUpdate();
        window.addEventListener('resize', scheduleViewportUpdate);
        window.addEventListener('orientationchange', scheduleDelayedViewportUpdate);
        visualViewport?.addEventListener('resize', scheduleViewportUpdate);

        const attributeObserver = typeof MutationObserver === 'function'
            ? new MutationObserver((mutations) => {
                if (!mutations.some((mutation) => mutation.type === 'attributes')) {
                    return;
                }
                scheduleViewportUpdate();
            })
            : null;

        attributeObserver?.observe(document.documentElement, {
            attributes: true,
            attributeFilter: [
                'data-game-page',
                'data-game-id',
                'data-mobile-profile',
                'data-mobile-layout-preset',
                'data-preferred-orientation',
            ],
        });
        if (document.body) {
            attributeObserver?.observe(document.body, {
                attributes: true,
                attributeFilter: [
                    'data-game-page',
                    'data-game-id',
                    'data-mobile-profile',
                    'data-mobile-layout-preset',
                    'data-preferred-orientation',
                ],
            });
        }

        return () => {
            if (pendingViewportUpdateTimerRef.current != null) {
                window.clearTimeout(pendingViewportUpdateTimerRef.current);
                pendingViewportUpdateTimerRef.current = null;
            }
            delayedViewportUpdateTimerRefs.current.forEach((timer) => window.clearTimeout(timer));
            delayedViewportUpdateTimerRefs.current = [];
            window.removeEventListener('resize', scheduleViewportUpdate);
            window.removeEventListener('orientationchange', scheduleDelayedViewportUpdate);
            visualViewport?.removeEventListener('resize', scheduleViewportUpdate);
            attributeObserver?.disconnect();
        };
    }, []);

    return viewport;
};
