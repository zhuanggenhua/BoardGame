const formatRuntimeUnitMultiplier = (value: number) => {
    if (!Number.isFinite(value)) {
        return '0';
    }

    const normalized = Number.parseFloat(value.toFixed(4));
    return Number.isInteger(normalized) ? String(normalized) : String(normalized);
};

export const buildRuntimeInlineUnitValue = (multiplier: number, fallback = '1vw') =>
    `calc(var(--mobile-layout-inline-unit, ${fallback}) * ${formatRuntimeUnitMultiplier(multiplier)})`;

export const buildRuntimeBlockUnitValue = (multiplier: number, fallback = '1vh') =>
    `calc(var(--mobile-layout-block-unit, ${fallback}) * ${formatRuntimeUnitMultiplier(multiplier)})`;

export const buildBoardShellInlineUnitValue = (multiplier: number, fallback = '1vw') =>
    `calc(var(--mobile-board-shell-inline-unit, ${fallback}) * ${formatRuntimeUnitMultiplier(multiplier)})`;

export const buildBoardShellBlockUnitValue = (multiplier: number, fallback = '1vh') =>
    `calc(var(--mobile-board-shell-block-unit, ${fallback}) * ${formatRuntimeUnitMultiplier(multiplier)})`;

const formatCssPixelValue = (value: number) => {
    if (!Number.isFinite(value)) {
        return '0px';
    }

    const normalized = Number.parseFloat(value.toFixed(4));
    return `${Number.isInteger(normalized) ? normalized : normalized}px`;
};

export const buildBoardShellScreenPixelValue = (pixels: number, fallbackScale = '1') =>
    `calc(${formatCssPixelValue(pixels)} / var(--mobile-board-shell-scale, ${fallbackScale}))`;

const parseCssNumber = (value: string | null | undefined) => {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : undefined;
};

const readRootComputedStyle = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return null;
    }
    return window.getComputedStyle(document.documentElement);
};

export const readBoardShellScaleValue = (fallback = 1) => {
    const parsed = parseCssNumber(readRootComputedStyle()?.getPropertyValue('--mobile-board-shell-scale'));
    return parsed && parsed > 0 ? parsed : fallback;
};

export const readBoardShellInlineUnitPixelValue = () => {
    const parsed = parseCssNumber(readRootComputedStyle()?.getPropertyValue('--mobile-board-shell-inline-unit'));
    if (parsed && parsed > 0) {
        return parsed;
    }
    if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
        return window.innerWidth / 100;
    }
    return 1;
};

export const readBoardShellBlockUnitPixelValue = () => {
    const parsed = parseCssNumber(readRootComputedStyle()?.getPropertyValue('--mobile-board-shell-block-unit'));
    if (parsed && parsed > 0) {
        return parsed;
    }
    if (typeof window !== 'undefined' && Number.isFinite(window.innerHeight) && window.innerHeight > 0) {
        return window.innerHeight / 100;
    }
    return 1;
};

export const convertScreenPixelsToBoardShellPixels = (pixels: number) => {
    if (!Number.isFinite(pixels)) {
        return 0;
    }
    return pixels / readBoardShellScaleValue();
};
