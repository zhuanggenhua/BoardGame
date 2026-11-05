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

/** 桌面壳层用 vw/vh，等比壳层用 px；读取时保留长度单位的含义。 */
const readCssLengthInPixels = (value: string | null | undefined) => {
    const match = value?.trim().match(/^(\d+(?:\.\d+)?)(px|vw|vh)$/);
    if (!match) return undefined;
    const amount = Number(match[1]);
    if (match[2] === 'px') return amount;
    if (typeof window === 'undefined') return undefined;
    return amount * (match[2] === 'vw' ? window.innerWidth : window.innerHeight) / 100;
};

export const readBoardShellScaleValue = (fallback = 1) => {
    const parsed = parseCssNumber(readRootComputedStyle()?.getPropertyValue('--mobile-board-shell-scale'));
    return parsed && parsed > 0 ? parsed : fallback;
};

/** 壳层在屏幕上的原点；固定工具仍以屏幕坐标存储，绘制进壳时扣除一次。 */
export const readBoardShellOffsetPixelValue = () => {
    const style = readRootComputedStyle();
    return {
        x: parseCssNumber(style?.getPropertyValue('--mobile-board-shell-offset-x')) ?? 0,
        y: parseCssNumber(style?.getPropertyValue('--mobile-board-shell-offset-y')) ?? 0,
    };
};

/** 当前被缩放的壳层画布逻辑尺寸；可用于把壳内固定控件限制在实际可见画布内。 */
export const readBoardShellCanvasSizeValue = () => {
    const style = readRootComputedStyle();
    const width = parseCssNumber(style?.getPropertyValue('--mobile-board-shell-canvas-width'))
        ?? parseCssNumber(style?.getPropertyValue('--mobile-board-shell-design-width'));
    const height = parseCssNumber(style?.getPropertyValue('--mobile-board-shell-canvas-height'))
        ?? parseCssNumber(style?.getPropertyValue('--mobile-board-shell-design-height'))
        ?? parseCssNumber(style?.getPropertyValue('--mobile-board-shell-logical-height'));
    return {
        width: width && width > 0 ? width : undefined,
        height: height && height > 0 ? height : undefined,
    };
};

export const readBoardShellInlineUnitPixelValue = () => {
    const parsed = readCssLengthInPixels(readRootComputedStyle()?.getPropertyValue('--mobile-board-shell-inline-unit'));
    if (parsed && parsed > 0) {
        return parsed;
    }
    if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) {
        return window.innerWidth / 100;
    }
    return 1;
};

export const readBoardShellBlockUnitPixelValue = () => {
    const parsed = readCssLengthInPixels(readRootComputedStyle()?.getPropertyValue('--mobile-board-shell-block-unit'));
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
