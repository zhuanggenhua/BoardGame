import { useLayoutEffect, useState } from 'react';
import {
    detectMobileLayoutEngineCapabilities,
    resolveRuntimeLayoutScaleMetrics,
    resolveStableViewportSize,
    type RuntimeViewportSize,
} from '../../games/mobileSupport';
import { isTextEntryElement } from '../../lib/textEntry';

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
const BOARD_SHELL_DESIGN_WIDTH_BY_GAME: Record<string, number> = {
    dicethrone: 940,
    smashup: 1160,
    summonerwars: 900,
};

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
        hasFocusedTextEntry: isTextEntryElement(document.activeElement),
    });

    return {
        ...viewport,
        safeArea: readRuntimeSafeAreaInsets(),
        keyboardInsetBottom,
    };
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
    root.style.removeProperty('--mobile-board-shell-scale');
    root.style.removeProperty('--mobile-board-shell-inverse-scale');
    root.style.removeProperty('--mobile-board-shell-logical-height');
    root.style.removeProperty('--mobile-board-shell-inline-unit');
    root.style.removeProperty('--mobile-board-shell-block-unit');
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
    root.style.setProperty('--runtime-viewport-width', `${viewport.width}px`);
    root.style.setProperty('--runtime-viewport-height', `${viewport.height}px`);
    root.style.setProperty('--keyboard-inset-height', `${keyboardInsetBottom}px`);
    root.dataset.keyboardVisible = keyboardInsetBottom > 0 ? 'true' : 'false';

    const gamePageTarget = document.body?.dataset.gamePage === 'true'
        ? document.body
        : document.documentElement.dataset.gamePage === 'true'
            ? document.documentElement
            : null;
    setLayoutEngineDataset(layoutEngineCapabilities.layoutMode, Boolean(gamePageTarget));
    const isLandscapeMobileViewport = viewport.width <= 1023 && viewport.width > viewport.height;

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
    const gameId = gamePageTarget?.dataset.gameId?.trim().toLowerCase() ?? '';
    const shouldUseBoardShellScale = mobileLayoutPreset === 'board-shell'
        && mobileProfile === 'landscape-adapted'
        && viewport.width <= 1023
        && isLandscapeMobileViewport;

    if (!shouldUseBoardShellScale) {
        clearBoardShellVars(root);
        return;
    }

    const designWidth = BOARD_SHELL_DESIGN_WIDTH_BY_GAME[gameId] ?? DEFAULT_BOARD_SHELL_DESIGN_WIDTH;
    const shellScaleMetrics = resolveRuntimeLayoutScaleMetrics(viewport, designWidth);
    root.style.setProperty('--mobile-board-shell-design-width', `${shellScaleMetrics.designWidth}px`);
    root.style.setProperty('--mobile-board-shell-scale', shellScaleMetrics.scale.toFixed(6));
    root.style.setProperty('--mobile-board-shell-inverse-scale', shellScaleMetrics.inverseScale.toFixed(6));
    root.style.setProperty('--mobile-board-shell-logical-height', `${shellScaleMetrics.logicalHeight.toFixed(3)}px`);
    root.style.setProperty('--mobile-board-shell-inline-unit', `${shellScaleMetrics.inlineUnit.toFixed(4)}px`);
    root.style.setProperty('--mobile-board-shell-block-unit', `${shellScaleMetrics.blockUnit.toFixed(4)}px`);
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

    useLayoutEffect(() => {
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
                    && next.keyboardInsetBottom === previous.keyboardInsetBottom
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

        const attributeObserver = typeof MutationObserver === 'function'
            ? new MutationObserver((mutations) => {
                if (!mutations.some((mutation) => mutation.type === 'attributes')) {
                    return;
                }
                updateViewport();
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
            window.removeEventListener('resize', updateViewport);
            window.removeEventListener('orientationchange', updateViewport);
            visualViewport?.removeEventListener('resize', updateViewport);
            attributeObserver?.disconnect();
        };
    }, [syncCssVars]);

    return viewport;
};
